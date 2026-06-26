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
 * 构建多搜索引擎 + 多数据源的种子 URL 列表（100+ 个数据源）
 * 注意：query 一律只用书名（按用户要求）
 *
 * 分组：
 * 1) 通用搜索引擎（10）
 * 2) 中文古籍/国学（30）
 * 3) 现代书/小说/网文（20）
 * 4) 文库/在线文档（10）
 * 5) 电子书/阅读平台（10）
 * 6) 图书馆/学术（10）
 * 7) 海外/英文（15）
 * 8) 百科（5）
 * 合计 110 个 seed
 */
export function buildSeedUrls(bookName: string): string[] {
  const q = encodeURIComponent(bookName);
  return [
    // ① 通用搜索引擎（10）
    `https://www.bing.com/search?q=${q}`,
    `https://cn.bing.com/search?q=${q}`,
    `https://www.sogou.com/web?query=${q}`,
    `https://www.so.com/s?q=${q}`,
    `https://duckduckgo.com/?q=${q}`,
    `https://search.brave.com/search?q=${q}`,
    `https://yandex.com/search/?text=${q}`,
    `https://www.ecosia.org/search?q=${q}`,
    `https://www.startpage.com/do/search?q=${q}`,
    `https://www.qwant.com/?q=${q}`,
    // ② 中文古籍 / 国学（30）
    `https://ctext.org/search?searchu=${q}`,
    `https://so.gushiwen.cn/guwen/search?value=${q}`,
    `https://so.gushiwen.cn/search.aspx?value=${q}`,
    `https://www.gushiwen.com/search.aspx?value=${q}`,
    `https://www.guoxuedashi.net/s.php?keyword=${q}`,
    `https://www.cidianwang.com/search?q=${q}`,
    `https://www.shicimingju.com/search.html?keyword=${q}`,
    `https://www.zhonghuadiancang.com/search.php?q=${q}`,
    `https://www.guoxuemeng.com/search.php?keyword=${q}`,
    `https://zh.wikisource.org/w/index.php?search=${q}`,
    `https://www.daizhige.org/search?q=${q}`,
    `https://www.guoxue123.com/search?q=${q}`,
    `https://www.guoxue.com/search/?q=${q}`,
    `https://www.zdic.net/hans/${q}`,
    `https://www.shujuku.org/search?wd=${q}`,
    `https://www.shuyiyan.com/search?q=${q}`,
    `https://www.shengshicang.com/search?key=${q}`,
    `https://www.gushici.net/search?wd=${q}`,
    `https://www.shigeku.org/search?wd=${q}`,
    `https://sou-yun.cn/QueryAllPoems.aspx?key=${q}`,
    `https://shici.5000yan.com/search/?wd=${q}`,
    `https://www.kekeshici.com/search?wd=${q}`,
    `https://www.gushibaike.cn/search?wd=${q}`,
    `https://www.yuwenxue.com/search?wd=${q}`,
    `https://gj.zdic.net/search.html?q=${q}`,
    `https://www.zhonghuashici.com/search?wd=${q}`,
    `https://www.chinesewords.org/search?q=${q}`,
    `https://www.zhonghuadiancang.com/sousuo.php?q=${q}`,
    `https://baike.baidu.com/item/${q}`,
    `https://zh.wikipedia.org/wiki/${q}`,
    // ③ 现代书 / 小说 / 网文（20）
    `https://www.dingdiannew.com/searchbook.php?keyword=${q}`,
    `https://www.guidaye.cn/search.php?searchkey=${q}`,
    `https://www.25zw.com/search.html?searchkey=${q}`,
    `https://www.xbiquge.so/modules/article/waps.php?searchkey=${q}`,
    `https://www.quanben5.com/index.php?c=book&a=search&keywords=${q}`,
    `https://www.shuhai.tw/s?wd=${q}`,
    `https://www.biquge.com.cn/search?keyword=${q}`,
    `https://www.biqugew.com/modules/article/search.php?searchkey=${q}`,
    `https://www.biquzw.com/search.php?searchkey=${q}`,
    `https://www.bbiquge.net/modules/article/search.php?searchkey=${q}`,
    `https://so.qidian.com/?kw=${q}`,
    `https://search.zongheng.com/search.html?keyword=${q}`,
    `https://www.17k.com/search/?Searchkey=${q}`,
    `https://www.hongxiu.com/search?q=${q}`,
    `https://www.fanqienovel.com/search?q=${q}`,
    `https://www.qiyixs.com/search?wd=${q}`,
    `https://www.7kxs.com/search.php?keyword=${q}`,
    `https://www.kanshu.com/search?keyword=${q}`,
    `https://www.txt80.com/search.php?keyword=${q}`,
    `https://www.qb5.tw/search.php?searchkey=${q}`,
    // ④ 文库 / 在线文档（10）
    `https://wenku.baidu.com/search?word=${q}`,
    `https://www.docin.com/search.do?searchcat=2&keyword=${q}`,
    `https://www.doc88.com/search/${q}`,
    `https://ishare.iask.sina.com.cn/search.php?key=${q}`,
    `https://www.360doc.com/search.aspx?q=${q}`,
    `https://www.book118.com/search.html?keyword=${q}`,
    `https://www.docer.com/s?q=${q}`,
    `https://wenku.so.com/search?q=${q}`,
    `https://www.wendangwang.com/search?w=${q}`,
    `https://www.renrendoc.com/search.aspx?q=${q}`,
    // ⑤ 电子书 / 阅读平台（10）
    `https://book.douban.com/subject_search?search_text=${q}`,
    `https://weread.qq.com/web/search?key=${q}`,
    `https://www.duokan.com/search?keyword=${q}`,
    `https://e.jd.com/search?keyword=${q}`,
    `https://book.dangdang.com/search.aspx?keyword=${q}`,
    `https://www.amazon.cn/s?k=${q}`,
    `https://www.zhangyue.com/search?wd=${q}`,
    `https://book.ifeng.com/search?q=${q}`,
    `https://www.zongheng.com/search.html?keyword=${q}`,
    `https://www.weiyuedu.com/search?q=${q}`,
    // ⑥ 图书馆 / 学术（10）
    `https://archive.org/search.php?query=${q}`,
    `https://openlibrary.org/search?q=${q}`,
    `https://books.google.com/books?q=${q}`,
    `https://scholar.google.com/scholar?q=${q}`,
    `https://www.cnki.net/kns8s/search?q=${q}`,
    `https://www.wanfangdata.com.cn/search?q=${q}`,
    `https://find.nlc.cn/search?q=${q}`,
    `https://www.library.sh.cn/search?q=${q}`,
    `https://opac.lib.tsinghua.edu.cn/search?q=${q}`,
    `https://www.cadal.zju.edu.cn/search?q=${q}`,
    // ⑦ 海外 / 英文（15）
    `https://www.gutenberg.org/ebooks/search/?query=${q}`,
    `https://en.wikisource.org/w/index.php?search=${q}`,
    `https://www.worldcat.org/search?q=${q}`,
    `https://www.loc.gov/search/?q=${q}`,
    `https://www.bl.uk/search?q=${q}`,
    `https://arxiv.org/search/?query=${q}`,
    `https://www.jstor.org/action/doBasicSearch?Query=${q}`,
    `https://www.researchgate.net/search?q=${q}`,
    `https://www.academia.edu/search?q=${q}`,
    `https://www.scribd.com/search?query=${q}`,
    `https://www.goodreads.com/search?q=${q}`,
    `https://www.barnesandnoble.com/s/${q}`,
    `https://manybooks.net/search?q=${q}`,
    `https://standardebooks.org/search?q=${q}`,
    `https://www.feedbooks.com/search?query=${q}`,
    // ⑧ 百科（5）
    `https://baike.so.com/doc/${q}.html`,
    `https://baike.sogou.com/v.htm?ch=ch.bk.amb&fr=ch.bk.amb&keyword=${q}`,
    `https://www.britannica.com/search?query=${q}`,
    `https://www.encyclopedia.com/searchresults?q=${q}`,
    `https://www.britishmuseum.org/collection/search?keyword=${q}`,
  ];
}
