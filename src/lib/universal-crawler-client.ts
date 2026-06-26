/**
 * Universal Crawler 客户端封装
 * 调用 /skills/user/universal-crawler/scripts/crawler.py
 * 这是 APP 唯一的搜索/爬取工具。
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

const CRAWLER_PATH = "/skills/user/universal-crawler/scripts/crawler.py";
const DEFAULT_TIMEOUT_MS = 120_000;

export interface CrawlerPage {
  url: string;
  title: string;
  content_text: string;
  content_html?: string;
  word_count: number;
  links: { url: string; text: string }[];
  images?: string[];
  documents?: string[];
  status_code: number;
  error: string | null;
}

export interface CrawlerOutput {
  status: string;
  mode: string;
  pages: CrawlerPage[];
  stats?: {
    total_pages_crawled: number;
    total_pages_failed: number;
    total_words: number;
    total_links_found: number;
    elapsed_seconds: number;
  };
}

interface RunOptions {
  urls?: string[];
  domain?: string;
  url?: string;
  maxPages?: number;
  maxDepth?: number;
  delay?: number;
  timeoutMs?: number;
}

/**
 * 执行 universal-crawler，返回 JSON 结果
 * - urls: 批量爬指定 URL 列表
 * - domain: 域名递归爬
 * - url: 单页爬
 */
export async function runCrawler(opts: RunOptions): Promise<CrawlerOutput> {
  if (!opts.urls && !opts.domain && !opts.url) {
    throw new Error("runCrawler 需要 urls/domain/url 中至少一个");
  }
  const outputFile = path.join(
    os.tmpdir(),
    `crawler_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`,
  );
  const args: string[] = [CRAWLER_PATH];

  if (opts.urls && opts.urls.length > 0) {
    args.push("--urls", opts.urls.join(","));
  } else if (opts.domain) {
    args.push("--domain", opts.domain);
    args.push("--max-pages", String(opts.maxPages ?? 50));
    args.push("--max-depth", String(opts.maxDepth ?? 3));
  } else if (opts.url) {
    args.push("--url", opts.url);
  }

  args.push("--output", outputFile);
  args.push("--delay", String(opts.delay ?? 0.8));

  try {
    await execFileAsync("python3", args, {
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });
    const raw = await fs.readFile(outputFile, "utf-8");
    return JSON.parse(raw) as CrawlerOutput;
  } catch (err) {
    return {
      status: "error",
      mode: "error",
      pages: [],
    };
  } finally {
    fs.unlink(outputFile).catch(() => {});
  }
}

/**
 * 从一组页面中提取所有可能与书相关的 URL（候选目录页 / 候选章节页）
 * 启发式规则：
 *   - 链接文本含书名
 *   - 或 URL 含书名拼音/英文
 *   - 或 URL 路径含 /book/ /chapter/ /guoxue/ /art/ 等典型路径段
 */
export function extractCandidateLinks(
  output: CrawlerOutput,
  bookName: string,
  limit = 200,
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const bookKey = bookName.trim();
  const pathHints = [
    "/book/",
    "/books/",
    "/chapter/",
    "/guoxue/",
    "/wenxue/",
    "/art/",
    "/article/",
    "/content/",
    "/wiki/",
    "/text/",
    "/n/",
    "/xs/",
    "/info/",
    "/read/",
    "/zh/",
    ".shtml",
  ];

  for (const p of output.pages || []) {
    for (const lk of p.links || []) {
      const url = (lk.url || "").trim();
      const text = (lk.text || "").trim();
      if (!url || !url.startsWith("http")) continue;
      if (seen.has(url)) continue;

      const textHit = bookKey && text.includes(bookKey);
      const pathHit = pathHints.some((h) => url.includes(h));

      if (textHit || pathHit) {
        seen.add(url);
        candidates.push(url);
        if (candidates.length >= limit) return candidates;
      }
    }
  }
  return candidates;
}

/**
 * 从一组目录页中提取章节链接（链接文本含"第X章/卦/卷/篇/回"）
 */
export function extractChapterLinks(
  output: CrawlerOutput,
  bookName: string,
  limit = 500,
): string[] {
  const seen = new Set<string>();
  const chapters: string[] = [];
  const chapterPattern =
    /第[一二三四五六七八九十百零０-９0-9]+(章|卦|卷|篇|回|节|品)/;

  for (const p of output.pages || []) {
    // 只从含书名的页面取章节，避免干扰
    if (bookName && p.title && !p.title.includes(bookName) && !(p.content_text || "").includes(bookName)) {
      // 如果首页正文带书名也算
    }
    for (const lk of p.links || []) {
      const url = (lk.url || "").trim();
      const text = (lk.text || "").trim();
      if (!url || !url.startsWith("http")) continue;
      if (seen.has(url)) continue;
      if (text && (chapterPattern.test(text) || /^[一二三四五六七八九十]+[、.]/.test(text))) {
        seen.add(url);
        chapters.push(url);
        if (chapters.length >= limit) return chapters;
      }
    }
  }
  return chapters;
}

/**
 * 构建多搜索引擎 + 多数据源的种子 URL 列表
 * 注意：query 一律只用书名（按用户要求）
 */
export function buildSeedUrls(bookName: string): string[] {
  const q = encodeURIComponent(bookName);
  return [
    // 搜索引擎
    `https://www.bing.com/search?q=${q}`,
    `https://www.sogou.com/web?query=${q}`,
    `https://www.so.com/s?q=${q}`,
    // 中文古籍源
    `https://ctext.org/search?searchu=${q}`,
    `https://so.gushiwen.cn/guwen/search?value=${q}`,
    `https://www.guoxuedashi.net/s.php?keyword=${q}`,
    `https://www.cidianwang.com/search?q=${q}`,
    `https://www.shicimingju.com/search.html?keyword=${q}`,
    `https://www.zhonghuadiancang.com/search.php?q=${q}`,
    `https://www.guoxuemeng.com/search.php?keyword=${q}`,
    `https://zh.wikisource.org/w/index.php?search=${q}`,
    // 现代书/小说源
    `https://www.dingdiannew.com/searchbook.php?keyword=${q}`,
    `https://www.guidaye.cn/search.php?searchkey=${q}`,
    `https://www.25zw.com/search.html?searchkey=${q}`,
    `https://www.xbiquge.so/modules/article/waps.php?searchkey=${q}`,
    `https://www.quanben5.com/index.php?c=book&a=search&keywords=${q}`,
    `https://www.shuhai.tw/s?wd=${q}`,
  ];
}
