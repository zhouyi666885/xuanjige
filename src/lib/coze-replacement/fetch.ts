/**
 * 替换 coze-coding-dev-sdk FetchClient
 * 兼容原 SDK 接口：fetch(url) -> { content: Array<FetchContentItem> }
 *
 * 支持：HTML / PDF / DOCX / TXT
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

const PDF_PARSE = async (buf: Buffer): Promise<string> => {
  try {
    // pdf-parse 2.x 是 ESM，default 可能不存在，做兼容
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('pdf-parse') as any;
    const fn = mod.default || mod.PDFParse || mod;
    const out = typeof fn === 'function' ? await fn(buf) : await fn.parse(buf);
    return out?.text || '';
  } catch (err) {
    console.warn('[FetchClient] PDF 解析失败:', (err as Error).message);
    return '';
  }
};

const DOCX_PARSE = async (buf: Buffer): Promise<string> => {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || '';
  } catch (err) {
    console.warn('[FetchClient] DOCX 解析失败:', (err as Error).message);
    return '';
  }
};

/**
 * 兼容原 SDK 的 FetchContentItem 结构：
 *   { type: 'text', text: string }
 */
export interface FetchContentItem {
  type: 'text';
  text: string;
}

export interface FetchResponse {
  url?: string;
  title?: string;
  content: FetchContentItem[];
  contentType?: string;
}

export interface FetchOptions {
  timeout?: number;
  userAgent?: string;
}

export class FetchClient {
  private timeout: number;
  private userAgent: string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config?: unknown, options: FetchOptions = {}) {
    this.timeout = options.timeout || 15_000;
    this.userAgent = options.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /** 抓取单个 URL，返回兼容原 SDK 的结构 */
  async fetch(url: string): Promise<FetchResponse | null> {
    try {
      const resp = await axios.get(url, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent, 'Accept': '*/*' },
        responseType: 'arraybuffer',
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const contentType = String(resp.headers['content-type'] || '').toLowerCase();
      const buffer = Buffer.from(resp.data as ArrayBuffer);
      let text = '';
      let title = '';

      if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        text = await PDF_PARSE(buffer);
      } else if (
        contentType.includes('officedocument.wordprocessing') ||
        url.toLowerCase().endsWith('.docx')
      ) {
        text = await DOCX_PARSE(buffer);
      } else if (contentType.includes('text/plain') || url.toLowerCase().endsWith('.txt')) {
        text = buffer.toString('utf-8');
      } else {
        const html = buffer.toString('utf-8');
        const $ = cheerio.load(html);
        title = $('title').first().text().trim();
        $('script,style,noscript,iframe').remove();
        const main = $('main, article, .content, #content, .main, body').first();
        text = (main.length ? main : $('body'))
          .text()
          .replace(/\s+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      return {
        url,
        title,
        contentType,
        content: text ? [{ type: 'text', text }] : [],
      };
    } catch (err) {
      console.warn(`[FetchClient] 抓取失败 ${url}: ${(err as Error).message}`);
      return null;
    }
  }
}
