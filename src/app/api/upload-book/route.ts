/**
 * 上传书籍文件 API
 *
 * POST /api/upload-book
 * - 接收 multipart/form-data
 * - 字段：files[]（支持多文件，txt/pdf/doc/docx）
 * - 解析文件内容 → 自动识别书名 → 入库
 *
 * 返回：每个文件的处理结果（成功/失败/字数）
 */
import { NextRequest, NextResponse } from 'next/server';
import { addBookToKnowledgeBase, isBookExists } from '@/lib/fulltext-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type UploadResult = {
  fileName: string;
  bookName?: string;
  status: 'success' | 'failed' | 'duplicate';
  message: string;
  charCount?: number;
};

/** 从文件名提取书名：去掉扩展名 + 常见后缀 */
function extractBookNameFromFile(fileName: string): string {
  let name = fileName.replace(/\.[a-zA-Z0-9]+$/, ''); // 去扩展名
  // 去掉常见前后缀：(简体)、[完整版]、_v2 等
  name = name
    .replace(/[\[\(（【].*?[\]\)）】]/g, '') // 去括号内容
    .replace(/[_\-—]\s*(完整版|简体|繁体|高清|清晰|文字版|扫描版|v\d+)$/gi, '')
    .replace(/^\d+[\.\-_]\s*/, '') // 去开头编号
    .trim();
  return name || fileName;
}

/** 从正文前 N 行提取书名（如果文件名提取失败） */
function extractBookNameFromContent(content: string): string | null {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10);
  for (const line of lines) {
    // 形如 "《滴天髓》" 或 "滴天髓"（< 20 字）
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
  // pdf-parse 在新版本中默认导出从 'pdf-parse/lib/pdf-parse.js' 引入避免 debug mode
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
    // 尝试 UTF-8 解析，失败则尝试 GBK
    let text = buffer.toString('utf-8');
    // 检测乱码（UTF-8 失败标记 �）
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
    const content = await parsePdf(buffer);
    return { content, ext: 'pdf' };
  }

  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    const content = await parseDocx(buffer);
    return { content, ext: 'docx' };
  }

  throw new Error(`不支持的文件类型：${file.name}`);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '请选择至少一个文件' }, { status: 400 });
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      const result: UploadResult = {
        fileName: file.name,
        status: 'failed',
        message: '',
      };

      try {
        // 1. 解析文件内容
        const { content } = await parseFile(file);

        if (!content || content.trim().length < 100) {
          result.status = 'failed';
          result.message = `内容过短（${content?.length || 0} 字），无法入库`;
          results.push(result);
          continue;
        }

        // 2. 识别书名：优先从文件名，回退到正文
        let bookName = extractBookNameFromFile(file.name);
        if (!bookName || bookName.length < 2) {
          bookName = extractBookNameFromContent(content) || file.name;
        }
        result.bookName = bookName;

        // 3. 检查重复
        if (isBookExists(bookName)) {
          result.status = 'duplicate';
          result.message = `《${bookName}》已存在于知识库`;
          results.push(result);
          continue;
        }

        // 4. 入库
        const cleaned = content.replace(/\r\n/g, '\n').trim();
        addBookToKnowledgeBase(bookName, cleaned);

        result.status = 'success';
        result.charCount = cleaned.length;
        result.message = `《${bookName}》已入库，共 ${cleaned.length} 字`;
      } catch (err) {
        result.status = 'failed';
        result.message = err instanceof Error ? err.message : '处理失败';
      }

      results.push(result);
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const duplicateCount = results.filter((r) => r.status === 'duplicate').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      total: results.length,
      successCount,
      duplicateCount,
      failedCount,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '上传失败' },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/upload-book',
    method: 'POST',
    description: '上传 txt/pdf/docx 书籍文件，自动入库',
    supported: ['.txt', '.md', '.pdf', '.docx', '.doc'],
    maxFiles: 50,
  });
}
