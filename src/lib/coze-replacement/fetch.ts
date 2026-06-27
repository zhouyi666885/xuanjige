/**
 * 替换 coze-coding-dev-sdk FetchClient
 * 兼容原 SDK 接口：fetch(url) -> { content: Array<FetchContentItem> }
 *
 * 支持：HTML / PDF / DOCX / TXT
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

// 注：PDF / DOCX 解析依赖 pdf-parse / pdfjs-dist / mammoth 等大体积包，
// 会让 Netlify Function zip 超 50MB 上限，故在 serverless 部署时一律降级跳过；
// 本来这部分逻辑就有 try/catch 兜底返回 ''，不会影响主流程。
// 如未来需要 PDF/DOCX 真解析，请改用对象存储 + 离线 worker 完成。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PDF_PARSE = async (_buf: Buffer): Promise<string> => {
  console.warn('[FetchClient] PDF 解析在当前部署环境已禁用（serverless 体积限制）');
  return '';
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DOCX_PARSE = async (_buf: Buffer): Promise<string> => {
  console.warn('[FetchClient] DOCX 解析在当前部署环境已禁用（serverless 体积限制）');
  return '';
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
