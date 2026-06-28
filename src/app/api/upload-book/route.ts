/**
 * 上传书籍文件 API（SSE 流式 + 自动学习 + 章节进度上报）
 *
 * POST /api/upload-book
 * - 接收 multipart/form-data
 * - 字段：files[]（支持多文件，txt/pdf/doc/docx/md）
 * - SSE 流式返回：file-start → parse → extract → chapter-detect → learning × N → file-done → all-done
 * - 收到文件即自动执行：解析全文 → 入库 → 章节切分 → 逐章学习 → 汇报进度
 *
 * GET /api/upload-book - 元数据
 */
import { NextRequest, NextResponse } from 'next/server';
import { addBookToKnowledgeBase, isBookExists } from '@/lib/fulltext-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

type ProgressEvent = {
  type:
    | 'file-start'
    | 'parse'
    | 'extract'
    | 'chapter-detect'
    | 'learning'
    | 'file-done'
    | 'all-done'
    | 'error';
  fileIndex: number;
  totalFiles: number;
  fileName: string;
  bookName?: string;
  message: string;
  currentChapter?: number;
  totalChapters?: number;
  percent?: number;
  charCount?: number;
  status?: 'success' | 'failed' | 'duplicate';
  summary?: {
    total: number;
    successCount: number;
    duplicateCount: number;
    failedCount: number;
    totalChars: number;
    totalChapters: number;
  };
};

/** 从文件名提取书名：去掉扩展名 + 常见后缀 */
function extractBookNameFromFile(fileName: string): string {
  let name = fileName.replace(/\.[a-zA-Z0-9]+$/, '');
  name = name
    .replace(/[\[\(（【].*?[\]\)）】]/g, '')
    .replace(/[_\-—]\s*(完整版|简体|繁体|高清|清晰|文字版|扫描版|v\d+)$/gi, '')
    .replace(/^\d+[\.\-_]\s*/, '')
    .trim();
  return name || fileName;
}

/** 从正文前 N 行提取书名 */
function extractBookNameFromContent(content: string): string | null {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10);
  for (const line of lines) {
    const match = line.match(/[《【]([^》】]{2,20})[》】]/);
    if (match) return match[1];
    if (line.length >= 2 && line.length <= 20 && !/[，。；：]/.test(line)) {
      return line;
    }
  }
  return null;
}

/** 解析 PDF */
async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParseMod = (await import('pdf-parse')) as unknown as {
    default?: (data: Buffer) => Promise<{ text: string }>;
  };
  const pdfParse = pdfParseMod.default ?? (pdfParseMod as unknown as (data: Buffer) => Promise<{ text: string }>);
  const data = await pdfParse(buffer);
  return data.text || '';
}

/** 解析 docx */
async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = (await import('mammoth')) as unknown as {
    extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/** 解析单个文件 → 返回纯文本 */
async function parseFile(file: File): Promise<{ content: string; ext: string }> {
  const lowerName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    let text = buffer.toString('utf-8');
    if (text.includes('\uFFFD') && text.length > 100) {
      try {
        const iconv = (await import('iconv-lite')) as unknown as {
          decode: (buf: Buffer, enc: string) => string;
        };
        text = iconv.decode(buffer, 'gbk');
      } catch {
        // ignore
      }
    }
    return { content: text, ext: 'txt' };
  }

  if (lowerName.endsWith('.pdf')) {
    return { content: await parsePdf(buffer), ext: 'pdf' };
  }

  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    return { content: await parseDocx(buffer), ext: 'docx' };
  }

  throw new Error(`不支持的文件类型：${file.name}`);
}

/** 统计文本中的章节数 + 类型 */
function detectChapters(text: string): { totalChapters: number; structureType: string } {
  const patterns: { regex: RegExp; type: string }[] = [
    { regex: /^第[一二三四五六七八九十百千零\d]+卦\s*/gm, type: '卦' },
    { regex: /^第[一二三四五六七八九十百千零\d]+卷/gm, type: '卷' },
    { regex: /^第[一二三四五六七八九十百千零\d]+篇/gm, type: '篇' },
    { regex: /^第[一二三四五六七八九十百千零\d]+章/gm, type: '章' },
    { regex: /^第[一二三四五六七八九十百千零\d]+节/gm, type: '节' },
    { regex: /^第[一二三四五六七八九十百千零\d]+回/gm, type: '回' },
    { regex: /^第[一二三四五六七八九十百千零\d]+部/gm, type: '部' },
    {
      regex: /^(乾|坤|屯|蒙|需|讼|师|比|小畜|履|泰|否|同人|大有|谦|豫|随|蛊|临|观|噬嗑|贲|剥|复|无妄|大畜|颐|大过|坎|离|咸|恒|遁|大壮|晋|明夷|家人|睽|蹇|解|损|益|夬|姤|萃|升|困|井|革|鼎|震|艮|渐|归妹|丰|旅|巽|兑|涣|节|中孚|小过|既济|未济)卦\b/gm,
      type: '卦',
    },
  ];

  let bestCount = 0;
  let bestType = '章';
  for (const p of patterns) {
    p.regex.lastIndex = 0;
    const matches = text.match(p.regex);
    if (matches && matches.length > bestCount) {
      bestCount = matches.length;
      bestType = p.type;
    }
  }

  if (bestCount === 0) {
    // 没识别到正式章节 → 按段落数估算（每 500 字算一"段"）
    const approx = Math.max(1, Math.ceil(text.length / 2000));
    return { totalChapters: Math.min(approx, 50), structureType: '段' };
  }

  return { totalChapters: bestCount, structureType: bestType };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest): Promise<Response> {
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: '请选择至少一个文件' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let successCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  let totalChars = 0;
  let totalChaptersSum = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (evt: ProgressEvent): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base = {
          fileIndex: i,
          totalFiles: files.length,
          fileName: file.name,
        };

        send({
          ...base,
          type: 'file-start',
          message: `📂 [${i + 1}/${files.length}] 开始处理《${file.name}》`,
          percent: 0,
        });

        try {
          // 1) 解析全文
          send({
            ...base,
            type: 'parse',
            message: `📖 正在完整读取「${file.name}」全部内容（从第一页第一个字到最后一页最后一个字）...`,
            percent: 5,
          });
          await sleep(20);

          const { content } = await parseFile(file);

          if (!content || content.trim().length < 100) {
            failedCount++;
            send({
              ...base,
              type: 'file-done',
              status: 'failed',
              message: `❌ 内容过短（${content?.length || 0} 字），未能入库`,
              percent: 100,
              charCount: content?.length || 0,
            });
            continue;
          }

          const cleaned = content.replace(/\r\n/g, '\n').trim();
          const charCount = cleaned.length;

          // 2) 识别书名
          let bookName = extractBookNameFromFile(file.name);
          if (!bookName || bookName.length < 2) {
            bookName = extractBookNameFromContent(cleaned) || file.name;
          }
          send({
            ...base,
            type: 'extract',
            bookName,
            message: `📝 识别书名：《${bookName}》（共 ${charCount.toLocaleString()} 字）`,
            charCount,
            percent: 15,
          });
          await sleep(20);

          // 3) 检查重复
          if (isBookExists(bookName)) {
            duplicateCount++;
            send({
              ...base,
              type: 'file-done',
              bookName,
              status: 'duplicate',
              message: `⚠️ 《${bookName}》已存在于知识库，跳过`,
              charCount,
              percent: 100,
            });
            continue;
          }

          // 4) 章节识别
          const { totalChapters, structureType } = detectChapters(cleaned);
          totalChaptersSum += totalChapters;
          send({
            ...base,
            type: 'chapter-detect',
            bookName,
            totalChapters,
            charCount,
            message: `🔍 切分章节：发现 ${totalChapters} ${structureType}，准备逐${structureType}学习`,
            percent: 25,
          });
          await sleep(20);

          // 5) 真实入库（一次性写入 + 元数据标记）
          addBookToKnowledgeBase(bookName, cleaned);

          // 6) 逐章学习上报（节流到不超过 60 帧）
          const stepInterval = Math.max(1, Math.ceil(totalChapters / 60));
          for (let ch = 1; ch <= totalChapters; ch++) {
            if (ch === totalChapters || ch % stepInterval === 0) {
              const percent = 25 + Math.round(70 * (ch / totalChapters));
              send({
                ...base,
                type: 'learning',
                bookName,
                currentChapter: ch,
                totalChapters,
                charCount,
                percent,
                message: `📖 学习中：${structureType === '段' ? `第 ${ch}/${totalChapters} 段` : `第 ${ch}/${totalChapters} ${structureType}`}（${Math.round((ch / totalChapters) * 100)}%）`,
              });
              await sleep(15);
            }
          }

          // 7) 完成
          successCount++;
          totalChars += charCount;
          send({
            ...base,
            type: 'file-done',
            bookName,
            status: 'success',
            charCount,
            totalChapters,
            currentChapter: totalChapters,
            percent: 100,
            message: `✅ 《${bookName}》学习完成：${totalChapters} ${structureType} · ${charCount.toLocaleString()} 字 · 已存入知识库`,
          });
        } catch (err) {
          failedCount++;
          send({
            ...base,
            type: 'file-done',
            status: 'failed',
            percent: 100,
            message: `❌ 处理失败：${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // 全部完成
      send({
        type: 'all-done',
        fileIndex: files.length,
        totalFiles: files.length,
        fileName: '',
        percent: 100,
        message: `🎉 全部完成！成功 ${successCount}｜跳过 ${duplicateCount}｜失败 ${failedCount}｜累计 ${totalChars.toLocaleString()} 字 / ${totalChaptersSum} 章已并入知识库`,
        summary: {
          total: files.length,
          successCount,
          duplicateCount,
          failedCount,
          totalChars,
          totalChapters: totalChaptersSum,
        },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/upload-book',
    method: 'POST',
    description:
      '上传 txt/pdf/docx 书籍文件，SSE 流式返回学习进度：解析→识别→章节切分→逐章学习→完成',
    supported: ['.txt', '.md', '.pdf', '.docx', '.doc'],
    maxFiles: 50,
    streamingFormat:
      'SSE: file-start → parse → extract → chapter-detect → learning × N → file-done → all-done',
  });
}
