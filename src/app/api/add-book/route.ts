import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, FetchClient, Config, HeaderUtils, LLMClient } from 'coze-coding-dev-sdk';
import { isBookExists, addBookToKnowledgeBase, getBookDir } from '@/lib/fulltext-search';
import * as fs from 'fs';
import * as path from 'path';

/**
 * POST /api/add-book
 * 根据书名自动搜索、下载、添加书籍到知识库
 * 
 * 请求体: { bookName: string }
 * 返回: SSE 流式响应，实时反馈搜索进度
 */
export async function POST(request: NextRequest) {
  const { bookName } = await request.json();

  if (!bookName || typeof bookName !== 'string' || bookName.trim().length === 0) {
    return NextResponse.json({ error: '请提供书名' }, { status: 400 });
  }

  const trimmedName = bookName.trim();

  // 检查是否已存在
  if (isBookExists(trimmedName)) {
    return NextResponse.json({ 
      status: 'exists', 
      message: `《${trimmedName}》已添加`,
      bookName: trimmedName 
    });
  }

  // 使用 SSE 流式返回进度
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const config = new Config();
        const searchClient = new SearchClient(config, customHeaders);
        const fetchClient = new FetchClient(config, customHeaders);

        send({ stage: 'searching', message: `正在搜索《${trimmedName}》...` });

        // 搜索书籍全文来源
        const searchQuery = `${trimmedName} 全文 txt 下载 site:gutenberg.org OR site:ctext.org OR site:zh.wikisource.org OR site:guoxue.com`;
        let searchResult;
        try {
          searchResult = await searchClient.webSearch(searchQuery, 10);
        } catch {
          // 降级搜索
          searchResult = await searchClient.webSearch(`${trimmedName} 全文`, 10);
        }

        if (!searchResult.web_items || searchResult.web_items.length === 0) {
          send({ stage: 'error', message: `未找到《${trimmedName}》的相关资源` });
          controller.close();
          return;
        }

        send({ stage: 'downloading', message: `找到 ${searchResult.web_items.length} 个来源，正在获取内容...` });

        // 尝试从搜索结果中获取书籍全文
        let bookContent = '';
        let foundSource = '';

        // 优先尝试 Project Gutenberg
        const gutenbergUrls = searchResult.web_items.filter(
          item => item.url && (item.url.includes('gutenberg.org') || item.url.includes('gutenberg.'))
        );

        // 尝试获取 Gutenberg 纯文本
        for (const item of gutenbergUrls) {
          if (!item.url) continue;
          // Gutenberg 的纯文本 URL 格式: https://www.gutenberg.org/files/ID/ID-0.txt
          const pgMatch = item.url.match(/\/(\d+)/);
          if (pgMatch) {
            const bookId = pgMatch[1];
            const txtUrls = [
              `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
              `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`,
              `https://www.gutenberg.org/files/${bookId}/${bookId}.txt`,
            ];
            for (const txtUrl of txtUrls) {
              try {
                const response = await fetch(txtUrl, { 
                  signal: AbortSignal.timeout(15000),
                  headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (response.ok) {
                  const text = await response.text();
                  if (text.length > 500) {
                    bookContent = text;
                    foundSource = `Project Gutenberg #${bookId}`;
                    break;
                  }
                }
              } catch { /* try next */ }
            }
            if (bookContent) break;
          }
        }

        // 如果 Gutenberg 没找到，尝试其他来源
        if (!bookContent) {
          for (const item of searchResult.web_items) {
            if (!item.url) continue;
            // 跳过非内容页面
            if (item.url.includes('google.com') || item.url.includes('bing.com') || item.url.includes('baidu.com')) continue;
            
            try {
              send({ stage: 'fetching', message: `正在从 ${item.url.substring(0, 60)} 获取...` });
              const fetchResult = await fetchClient.fetch(item.url);
              
              if (fetchResult.status_code === 0 && fetchResult.content) {
                const textParts = fetchResult.content
                  .filter(c => c.type === 'text' && c.text)
                  .map(c => c.text!);
                
                const text = textParts.join('\n\n');
                if (text.length > 500) {
                  bookContent = text;
                  foundSource = item.url;
                  break;
                }
              }
            } catch { /* try next */ }
          }
        }

        // 如果仍未找到，尝试用 LLM 生成引导
        if (!bookContent) {
          send({ 
            stage: 'not_found', 
            message: `未能自动获取《${trimmedName}》的全文内容。该书籍可能需要手动录入或不在公开资源库中。`,
            searchResults: searchResult.web_items.slice(0, 5).map(item => ({
              title: item.title,
              url: item.url,
              snippet: item.snippet?.substring(0, 100),
            }))
          });
          controller.close();
          return;
        }

        // 如果原文是英文，翻译为中文
        const isChinese = bookContent.substring(0, 500).match(/[\u4e00-\u9fff]/g);
        const chineseRatio = isChinese ? isChinese.length / Math.min(bookContent.length, 500) : 0;
        
        if (chineseRatio < 0.1) {
          send({ stage: 'translating', message: `《${trimmedName}》原文为外文，正在翻译为中文...` });
          bookContent = await translateToChinese(bookContent, trimmedName, config, customHeaders, send);
        }

        // 保存到知识库
        send({ stage: 'saving', message: `正在保存《${trimmedName}》到知识库...` });
        const savedPath = addBookToKnowledgeBase(trimmedName, bookContent);
        const fileSize = (Buffer.byteLength(bookContent, 'utf-8') / 1024).toFixed(0);

        send({ 
          stage: 'done', 
          message: `《${trimmedName}》已成功添加到知识库！`,
          bookName: trimmedName,
          source: foundSource,
          size: `${fileSize}KB`,
          chars: bookContent.length,
          path: savedPath,
        });

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        send({ stage: 'error', message: `添加失败: ${errMsg.substring(0, 200)}` });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * GET /api/add-book
 * 查询当前知识库状态和书籍列表
 */
export async function GET(request: NextRequest) {
  const dir = getBookDir();
  
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ bookCount: 0 });
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
  
  // 只返回书籍数量，不返回完整列表（列表太大）
  return NextResponse.json({
    bookCount: files.length,
  });
}

/**
 * 翻译英文书籍为中文（分段翻译，保留完整内容）
 */
async function translateToChinese(
  content: string, 
  bookName: string,
  config: Config,
  customHeaders: Record<string, string>,
  send: (data: Record<string, unknown>) => void
): Promise<string> {
  const client = new LLMClient(config, customHeaders);
  
  const CHUNK_SIZE = 4000;
  const MAX_PARAS = 12;
  
  const SYSTEM_PROMPT = `你是一位世界顶级翻译大师。将英文完整翻译为中文，从第一个字到最后一个字，一字不漏。
段落编号铁律：原文每个段落前已标注【段N】，翻译后必须保留相同的【段N】编号，一段不漏，一段不合。
禁止以任何理由省略、合并、精简段落。输出带【段N】编号的翻译结果，不加引导语。`;

  // 分段
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  const chunks: { text: string; paraCount: number }[] = [];
  let currentParas: string[] = [];

  for (const para of paragraphs) {
    if ((currentParas.join('\n\n').length + para.length + 2 > CHUNK_SIZE || currentParas.length >= MAX_PARAS) && currentParas.length > 0) {
      chunks.push({ text: currentParas.join('\n\n'), paraCount: currentParas.length });
      currentParas = [para];
    } else {
      currentParas.push(para);
    }
  }
  if (currentParas.length > 0) {
    chunks.push({ text: currentParas.join('\n\n'), paraCount: currentParas.length });
  }

  send({ stage: 'translating', message: `《${bookName}》共 ${chunks.length} 段需翻译...` });

  const translations: string[] = [];
  const CONCURRENT = 5;

  for (let i = 0; i < chunks.length; i += CONCURRENT) {
    const batch = chunks.slice(i, Math.min(i + CONCURRENT, chunks.length));
    
    const batchResults = await Promise.all(batch.map(async (chunk) => {
      const paras = chunk.text.split(/\n\n+/).filter(p => p.trim());
      const numbered = paras.map((p, idx) => `【段${idx + 1}】${p.trim()}`).join('\n\n');
      
      const userPrompt = `翻译：原文有${paras.length}个段落。\n\n${numbered}`;
      
      try {
        const response = await client.invoke(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          { model: 'doubao-seed-2-0-pro-260215', temperature: 0.3 }
        );

        let translated = (response.content || '').trim();
        // 去除【段N】标记
        translated = translated.replace(/【段\d+】/g, '');
        return translated;
      } catch {
        // 翻译失败则保留原文
        return chunk.text;
      }
    }));

    translations.push(...batchResults);

    const progress = Math.min(i + CONCURRENT, chunks.length);
    if (progress % 10 === 0 || progress === chunks.length) {
      send({ stage: 'translating', message: `翻译进度: ${progress}/${chunks.length}` });
    }
  }

  return translations.join('\n\n');
}
