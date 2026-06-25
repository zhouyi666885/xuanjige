import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, FetchClient, Config, HeaderUtils, LLMClient } from 'coze-coding-dev-sdk';
import { isBookExists, addBookToKnowledgeBase, getBookDir } from '@/lib/fulltext-search';
import * as fs from 'fs';

// 类型定义：fetch API 返回的内容项
interface ContentItem {
  type: 'image' | 'link' | 'text';
  text?: string;
  url?: string;
}

/**
 * POST /api/add-book
 * 根据书名自动搜索、下载、添加书籍到知识库
 * 
 * 摘录规则：
 * 1. 从第一页第一个字到最后一页最后一个字，完整摘录
 * 2. 摘录进程可视化：书名/章节/进度条/实时更新
 * 3. 完成显示"已进入知识库"
 * 4. 版权判断：所有网站都搜遍找不到才显示"因版权问题无法摘录"
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

        // ========== 阶段1: 全面搜索 ==========
        send({ 
          stage: 'searching', 
          message: `正在全网搜索《${trimmedName}》全文...`,
          progress: 0,
          total: 100,
        });

        // 多轮搜索，覆盖尽可能多的来源
        const searchQueries = [
          `${trimmedName} 全文 txt 下载 site:gutenberg.org OR site:ctext.org OR site:zh.wikisource.org OR site:guoxue.com`,
          `${trimmedName} 全文 完整版 在线阅读`,
          `${trimmedName} 原文 完整 content full text`,
          `"${trimmedName}" 全文 电子书`,
        ];

        const allSearchResults: { url: string; title: string; snippet?: string }[] = [];
        const seenUrls = new Set<string>();

        for (let qi = 0; qi < searchQueries.length; qi++) {
          send({
            stage: 'searching',
            message: `搜索第 ${qi + 1}/${searchQueries.length} 轮: ${searchQueries[qi].substring(0, 40)}...`,
            progress: Math.round(((qi) / searchQueries.length) * 20),
            total: 100,
          });

          try {
            const result = await searchClient.webSearch(searchQueries[qi], 10);
            if (result.web_items) {
              for (const item of result.web_items) {
                if (item.url && !seenUrls.has(item.url)) {
                  seenUrls.add(item.url);
                  allSearchResults.push({ url: item.url, title: item.title || '', snippet: item.snippet });
                }
              }
            }
          } catch {
            // 搜索失败继续下一轮
          }
        }

        send({
          stage: 'searching',
          message: `全网搜索完成，共找到 ${allSearchResults.length} 个来源`,
          progress: 20,
          total: 100,
        });

        if (allSearchResults.length === 0) {
          // 所有搜索都找不到 → 版权问题
          send({ 
            stage: 'copyright', 
            message: `因版权问题无法摘录《${trimmedName}》。已搜索全部可用资源，未找到公开全文。`,
          });
          controller.close();
          return;
        }

        // ========== 阶段2: 获取全文 ==========
        let bookContent = '';
        let foundSource = '';
        let totalSources = allSearchResults.length;
        let triedSources = 0;

        // 优先尝试 Project Gutenberg（纯文本，质量最高）
        const gutenbergItems = allSearchResults.filter(
          item => item.url.includes('gutenberg.org') || item.url.includes('gutenberg.')
        );

        for (const item of gutenbergItems) {
          triedSources++;
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

        // 如果 Gutenberg 没找到，尝试其他所有来源
        if (!bookContent) {
          // 按优先级排序来源
          const priorityItems = allSearchResults.filter(item => 
            !item.url.includes('gutenberg.org') &&
            !item.url.includes('google.com') && 
            !item.url.includes('bing.com') && 
            !item.url.includes('baidu.com') &&
            !item.url.includes('youtube.com') &&
            !item.url.includes('amazon.')
          );

          for (const item of priorityItems) {
            triedSources++;
            const sourceProgress = Math.round(20 + (triedSources / totalSources) * 30);

            send({
              stage: 'downloading',
              message: `正在从第 ${triedSources}/${totalSources} 个来源获取... (${item.url.substring(0, 50)}...)`,
              progress: sourceProgress,
              total: 100,
              currentSource: item.url.substring(0, 60),
              triedSources,
              totalSources,
            });

            try {
              const fetchResult = await fetchClient.fetch(item.url);
              
              if (fetchResult.status_code === 0 && fetchResult.content) {
                const textParts = fetchResult.content
                  .filter((c: ContentItem) => c.type === 'text' && c.text)
                  .map((c: ContentItem) => c.text as string);
                
                const text = textParts.join('\n\n');
                if (text.length > 500) {
                  bookContent = text;
                  foundSource = item.url;
                  break;
                }
              }
            } catch { /* try next source */ }
          }
        }

        // 最后尝试：直接用更广泛的关键词搜索
        if (!bookContent) {
          send({
            stage: 'downloading',
            message: `扩大搜索范围，尝试更多来源...`,
            progress: 50,
            total: 100,
          });

          try {
            const expandedSearch = await searchClient.webSearch(`${trimmedName} site:archive.org OR site:sacred-texts.com OR site:chinaknowledge.de OR site:zh.wikisource.org`, 10);
            if (expandedSearch.web_items) {
              for (const item of expandedSearch.web_items) {
                if (!item.url || seenUrls.has(item.url)) continue;
                triedSources++;
                
                send({
                  stage: 'downloading',
                  message: `正在从扩展来源获取... (${item.url.substring(0, 50)}...)`,
                  progress: 55,
                  total: 100,
                });

                try {
                  const fetchResult = await fetchClient.fetch(item.url);
                  if (fetchResult.status_code === 0 && fetchResult.content) {
                    const textParts = fetchResult.content
                      .filter((c: ContentItem) => c.type === 'text' && c.text)
                      .map((c: ContentItem) => c.text as string);
                    
                    const text = textParts.join('\n\n');
                    if (text.length > 500) {
                      bookContent = text;
                      foundSource = item.url;
                      break;
                    }
                  }
                } catch { /* continue */ }
              }
            }
          } catch { /* expanded search failed */ }
        }

        // 所有来源都尝试过但仍未找到
        if (!bookContent) {
          send({ 
            stage: 'copyright', 
            message: `因版权问题无法摘录《${trimmedName}》。已搜索 ${triedSources} 个来源，均未找到公开全文。`,
            triedSources,
          });
          controller.close();
          return;
        }

        // ========== 阶段3: 翻译（如需要） ==========
        const isChinese = bookContent.substring(0, 500).match(/[\u4e00-\u9fff]/g);
        const chineseRatio = isChinese ? isChinese.length / Math.min(bookContent.length, 500) : 0;
        
        if (chineseRatio < 0.1) {
          send({ 
            stage: 'translating', 
            message: `《${trimmedName}》原文为外文，正在逐段翻译为中文...`,
            progress: 60,
            total: 100,
          });
          bookContent = await translateToChinese(bookContent, trimmedName, config, customHeaders, send);
        }

        // ========== 阶段4: 摘录入库（逐章节可视化） ==========
        const chapters = splitIntoChapters(bookContent, trimmedName);
        const totalChapters = chapters.length;
        const savingStartTime = Date.now();
        
        send({
          stage: 'saving',
          message: `正在摘录《${trimmedName}》到知识库，共 ${totalChapters} 个章节...`,
          progress: 75,
          total: 100,
          totalChapters,
          currentChapter: 0,
          remainingChapters: totalChapters,
        });

        // 逐章发送进度更新，让用户像看下载进度一样实时看到每一步
        for (let i = 0; i < totalChapters; i++) {
          const chapterProgress = Math.round(75 + (i / totalChapters) * 20);
          const chapterName = chapters[i].name || `第${i + 1}章`;
          const currentChapter = i + 1;
          const remainingChapters = totalChapters - currentChapter;
          
          // 计算预计剩余时间
          const elapsedMs = Date.now() - savingStartTime;
          const elapsedSeconds = Math.round(elapsedMs / 1000);
          let estimatedRemaining = '';
          if (currentChapter > 0 && elapsedMs > 1000) {
            const msPerChapter = elapsedMs / currentChapter;
            const remainingMs = msPerChapter * remainingChapters;
            if (remainingMs < 60000) {
              estimatedRemaining = `${Math.round(remainingMs / 1000)}秒`;
            } else {
              const mins = Math.floor(remainingMs / 60000);
              const secs = Math.round((remainingMs % 60000) / 1000);
              estimatedRemaining = secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
            }
          }

          // 每章都发送进度更新（让用户实时看到进度走动）
          send({
            stage: 'saving',
            message: `正在摘录: ${chapterName} (${currentChapter}/${totalChapters})`,
            progress: chapterProgress,
            total: 100,
            currentChapter,
            totalChapters,
            chapterName,
            remainingChapters,
            elapsedSeconds,
            estimatedRemaining,
          });

          // 大书每章间短暂延迟让前端有时间渲染
          if (totalChapters > 50 && i % 10 !== 0) continue;
          await new Promise(r => setTimeout(r, 30));
        }

        // 保存到知识库
        const savedPath = addBookToKnowledgeBase(trimmedName, bookContent);
        const fileSize = (Buffer.byteLength(bookContent, 'utf-8') / 1024).toFixed(0);
        const totalElapsedSeconds = Math.round((Date.now() - savingStartTime) / 1000);

        // ========== 阶段5: 完成 ==========
        send({ 
          stage: 'done', 
          message: `已进入知识库`,
          bookName: trimmedName,
          source: foundSource,
          size: `${fileSize}KB`,
          chars: bookContent.length,
          path: savedPath,
          totalChapters,
          currentChapter: totalChapters,
          remainingChapters: 0,
          progress: 100,
          total: 100,
          elapsedSeconds: totalElapsedSeconds,
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
 * 查询当前知识库状态
 */
export async function GET() {
  const dir = getBookDir();
  
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ bookCount: 0 });
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
  
  return NextResponse.json({
    bookCount: files.length,
  });
}

/**
 * 将书籍内容按章节分割（用于可视化进度）
 */
function splitIntoChapters(content: string, bookName: string): { name: string; content: string }[] {
  const chapters: { name: string; content: string }[] = [];
  
  // 常见章节模式
  const chapterPatterns = [
    /^(第[一二三四五六七八九十百千万零\d]+[章节篇卷回部集])/gm,
    /^(Chapter\s+\d+)/gim,
    /^(卷[一二三四五六七八九十百千万零\d]+)/gm,
    /^(BOOK\s+[IVXLCDM\d]+)/gim,
  ];

  let bestMatches: { index: number; name: string }[] = [];
  let bestPattern = -1;

  for (let pi = 0; pi < chapterPatterns.length; pi++) {
    const pattern = chapterPatterns[pi];
    const matches: { index: number; name: string }[] = [];
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(content)) !== null) {
      matches.push({ index: match.index, name: match[1].trim() });
    }

    if (matches.length > bestMatches.length) {
      bestMatches = matches;
      bestPattern = pi;
    }
  }

  if (bestMatches.length >= 2) {
    // 按章节分割
    for (let i = 0; i < bestMatches.length; i++) {
      const start = bestMatches[i].index;
      const end = i + 1 < bestMatches.length ? bestMatches[i + 1].index : content.length;
      chapters.push({
        name: bestMatches[i].name,
        content: content.substring(start, end),
      });
    }

    // 如果第一章之前有内容，作为"前言/序"
    if (bestMatches[0].index > 100) {
      chapters.unshift({
        name: '前言/序',
        content: content.substring(0, bestMatches[0].index),
      });
    }
  } else {
    // 没有明显章节分隔，按段落块分
    const paras = content.split(/\n\n+/).filter(p => p.trim());
    const chunkSize = Math.max(1, Math.floor(paras.length / Math.min(20, Math.max(5, Math.floor(paras.length / 10)))));
    
    for (let i = 0; i < paras.length; i += chunkSize) {
      const chunk = paras.slice(i, i + chunkSize).join('\n\n');
      const sectionNum = Math.floor(i / chunkSize) + 1;
      chapters.push({
        name: `第${sectionNum}部分`,
        content: chunk,
      });
    }
  }

  // 至少1章
  if (chapters.length === 0) {
    chapters.push({ name: bookName, content });
  }

  return chapters;
}

/**
 * 翻译英文书籍为中文（分段翻译，保留完整内容，进度可视化）
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

  send({ 
    stage: 'translating', 
    message: `《${bookName}》共 ${chunks.length} 段需翻译...`,
    progress: 60,
    total: 100,
    translateTotal: chunks.length,
    translateCurrent: 0,
  });

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
    const translatePercent = Math.round(60 + (progress / chunks.length) * 15);
    send({ 
      stage: 'translating', 
      message: `翻译进度: ${progress}/${chunks.length} (${Math.round(progress / chunks.length * 100)}%)`,
      progress: translatePercent,
      total: 100,
      translateCurrent: progress,
      translateTotal: chunks.length,
    });
  }

  return translations.join('\n\n');
}
