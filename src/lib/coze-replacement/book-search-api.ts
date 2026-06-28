/**
 * Book Search API 聚合层
 *
 * 接入用户提供的 book-search 技能涉及的两大免费公开 API：
 *   1. Open Library  https://openlibrary.org/search.json
 *   2. Google Books  https://www.googleapis.com/books/v1/volumes
 *
 * 两个 API 都：
 *   - 完全免费、无需 API Key
 *   - 是 REST JSON 接口（不是 HTML 爬虫），不存在常规反爬
 *   - 返回**元数据**（标题/作者/ISBN/简介/封面/分类），不返回全文
 *
 * 用途：
 *   - 在 SearchClient.webSearch() 中作为兜底数据源（取代被反爬的搜索引擎）
 *   - 在 book-task-manager 录书前调用，验证书存在 + 拿到标准书名/作者/简介
 *     供 LLM 兜底背诵正文时使用，提升 LLM 生成质量
 *
 * 注意：
 *   - openlibrary.org 在国内访问较慢但通常能连
 *   - googleapis.com 在国内偶尔不稳定，所以两个 API 并发请求并各自 catch
 */
import axios from 'axios';
import * as iconv from 'iconv-lite';

import type { WebSearchItem } from './search';

const TIMEOUT_MS = 15_000;
const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

export interface BookMetadata {
  title: string;
  authors: string[];
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  pages?: number;
  description?: string;
  coverUrl?: string;
  subjects?: string[];
  source:
    | 'openlibrary'
    | 'google-books'
    | 'douban'
    | 'dangdang'
    | 'jd-books';
  detailUrl: string;
}

/** 聚合搜索：并发查 Open Library + Google Books + 国内图书源（豆瓣/当当/京东），合并去重
 *
 * - 海外源（Open Library + Google Books）：海外服务器上跑能用，国内 VPS 通常超时（已实测）
 * - 国内源（豆瓣/当当/京东）：国内 VPS 直连可用，HTML 解析获取元数据
 * - 单源失败不影响其他源
 */
export async function aggregateBookSearch(
  query: string,
  limit = 20,
): Promise<BookMetadata[]> {
  const tasks = [
    // 海外（连不上自动跳过）
    safeRun('openlibrary', () => searchOpenLibrary(query, limit)),
    safeRun('google-books', () => searchGoogleBooks(query, limit)),
    // 国内（大陆 VPS 直连可用）
    safeRun('douban', () => searchDouban(query, limit)),
    safeRun('dangdang', () => searchDangdang(query, limit)),
    safeRun('jd-books', () => searchJDBooks(query, limit)),
  ];
  const results = await Promise.all(tasks);
  const merged: BookMetadata[] = [];
  const seen = new Set<string>();
  for (const list of results) {
    for (const item of list) {
      // 去重：以 isbn 为主，没 isbn 用 title+作者
      const key = item.isbn || `${item.title}__${item.authors.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= limit) break;
    }
    if (merged.length >= limit) break;
  }
  console.log(
    `[BookSearchAPI] query="${query.slice(0, 30)}" 海外+国内聚合后 ${merged.length} 条`,
  );
  return merged;
}

/** 把 BookMetadata 转成 WebSearchItem，供 SearchClient 拼装结果 */
export function toWebSearchItems(books: BookMetadata[]): WebSearchItem[] {
  return books.map((b) => ({
    url: b.detailUrl,
    title: b.authors.length > 0 ? `${b.title} - ${b.authors.join(', ')}` : b.title,
    snippet: buildSnippet(b),
    source: b.source,
  }));
}

function buildSnippet(b: BookMetadata): string {
  const parts: string[] = [];
  if (b.publisher) parts.push(`出版社：${b.publisher}`);
  if (b.publishDate) parts.push(`出版：${b.publishDate}`);
  if (b.pages) parts.push(`${b.pages} 页`);
  if (b.isbn) parts.push(`ISBN：${b.isbn}`);
  if (b.description) parts.push(b.description.slice(0, 200));
  else if (b.subjects && b.subjects.length > 0) {
    parts.push(`主题：${b.subjects.slice(0, 5).join('、')}`);
  }
  return parts.join('｜');
}

async function safeRun<T>(
  name: string,
  fn: () => Promise<T[]>,
): Promise<T[]> {
  try {
    const list = await fn();
    console.log(`[BookSearchAPI][${name}] 返回 ${list.length} 条`);
    return list;
  } catch (err) {
    console.error(`[BookSearchAPI][${name}] 失败:`, (err as Error).message);
    return [];
  }
}

/* -------------------------------- Open Library -------------------------------- */
/**
 * Open Library Search API
 * https://openlibrary.org/search.json?q=...&limit=...
 */
export async function searchOpenLibrary(
  query: string,
  limit = 20,
): Promise<BookMetadata[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
  const { data } = await axios.get(url, {
    headers: COMMON_HEADERS,
    timeout: TIMEOUT_MS,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docs: any[] = data?.docs || [];
  return docs.map((d): BookMetadata => {
    const key = d.key || ''; // /works/OL...W
    const coverId = d.cover_i;
    const isbn = Array.isArray(d.isbn) && d.isbn.length > 0 ? d.isbn[0] : undefined;
    return {
      title: d.title || '',
      authors: Array.isArray(d.author_name) ? d.author_name : [],
      isbn,
      publisher: Array.isArray(d.publisher) ? d.publisher[0] : undefined,
      publishDate: d.first_publish_year ? String(d.first_publish_year) : undefined,
      pages: typeof d.number_of_pages_median === 'number' ? d.number_of_pages_median : undefined,
      coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined,
      subjects: Array.isArray(d.subject) ? d.subject.slice(0, 10) : undefined,
      source: 'openlibrary',
      detailUrl: key ? `https://openlibrary.org${key}` : 'https://openlibrary.org',
    };
  });
}

/* -------------------------------- Google Books -------------------------------- */
/**
 * Google Books API (Volumes search)
 * https://www.googleapis.com/books/v1/volumes?q=...&maxResults=...
 */
export async function searchGoogleBooks(
  query: string,
  limit = 20,
): Promise<BookMetadata[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${Math.min(limit, 40)}`;
  const { data } = await axios.get(url, {
    headers: COMMON_HEADERS,
    timeout: TIMEOUT_MS,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = data?.items || [];
  return items.map((it): BookMetadata => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = it.volumeInfo || ({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isbnObj = (v.industryIdentifiers || []).find((x: any) =>
      ['ISBN_13', 'ISBN_10'].includes(x?.type),
    );
    return {
      title: v.title || '',
      authors: Array.isArray(v.authors) ? v.authors : [],
      isbn: isbnObj?.identifier,
      publisher: v.publisher,
      publishDate: v.publishedDate,
      pages: typeof v.pageCount === 'number' ? v.pageCount : undefined,
      description: typeof v.description === 'string' ? v.description : undefined,
      coverUrl: v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail,
      subjects: Array.isArray(v.categories) ? v.categories : undefined,
      source: 'google-books',
      detailUrl: v.canonicalVolumeLink || v.infoLink || 'https://books.google.com',
    };
  });
}

/* -------------------------------- 豆瓣读书（HTML 解析） -------------------------------- */
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

/**
 * 豆瓣读书搜索（HTML 抓取）
 * https://book.douban.com/subject_search?search_text=三体
 *
 * 注意：豆瓣搜索结果页有 JS 渲染，但 H5 版 search 接口返回的 HTML 含标题/作者/出版社
 */
export async function searchDouban(
  query: string,
  limit = 20,
): Promise<BookMetadata[]> {
  const url = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(query)}&cat=1001`;
  const { data: html } = await axios.get<string>(url, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://book.douban.com/' },
    timeout: TIMEOUT_MS,
    responseType: 'text',
  });
  // 豆瓣 H5 把数据嵌入 window.__DATA__ 或直接在 HTML 中。
  // 兜底用正则匹配 item 区块：标题 + 作者 + 链接
  const items: BookMetadata[] = [];

  // 尝试从 window.__DATA__ 抽 JSON
  const dataMatch = html.match(/window\.__DATA__\s*=\s*"([^"]+)"/);
  if (dataMatch) {
    // 豆瓣对 JSON 做了 base64 + escape，简单解析失败时回退
    try {
      const decoded = decodeURIComponent(dataMatch[1].replace(/\+/g, ' '));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = JSON.parse(decoded);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = obj?.payload?.items || obj?.items || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const it of list as any[]) {
        if (items.length >= limit) break;
        items.push({
          title: it.title || '',
          authors: Array.isArray(it.abstract_2)
            ? it.abstract_2
            : it.abstract
              ? [String(it.abstract).split('/')[0]]
              : [],
          publisher: it.abstract ? String(it.abstract).split('/')[2] : undefined,
          publishDate: it.year || undefined,
          coverUrl: it.cover_url || it.pic,
          source: 'douban',
          detailUrl: it.url || `https://book.douban.com/subject/${it.id}/`,
        });
      }
    } catch {
      // 落到正则兜底
    }
  }

  // 正则兜底：从 HTML 直接提取 a.title-text + meta
  if (items.length === 0) {
    const itemRegex =
      /<a[^>]*href="(https?:\/\/book\.douban\.com\/subject\/(\d+)\/?)"[^>]*>([^<]{2,60})<\/a>[\s\S]{0,400}?<div class="meta abstract">([^<]+)<\/div>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(html)) !== null && items.length < limit) {
      const [, url, , title, meta] = m;
      const metaParts = meta.split('/').map((s) => s.trim());
      items.push({
        title: title.trim(),
        authors: metaParts[0] ? [metaParts[0]] : [],
        publisher: metaParts[2],
        publishDate: metaParts[3],
        source: 'douban',
        detailUrl: url,
      });
    }
  }

  return items;
}

/* -------------------------------- 当当网（HTML 解析） -------------------------------- */
/**
 * 当当网图书搜索（HTML 抓取）
 * http://search.dangdang.com/?key=三体&category_path=01.00.00.00.00.00
 *
 * 当当返回 GBK 编码，需要用 iconv 解码
 */
export async function searchDangdang(
  query: string,
  limit = 20,
): Promise<BookMetadata[]> {
  const url = `https://search.dangdang.com/?key=${encodeURIComponent(query)}&category_path=01.00.00.00.00.00`;
  const { data: buf } = await axios.get<ArrayBuffer>(url, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://www.dangdang.com/' },
    timeout: TIMEOUT_MS,
    responseType: 'arraybuffer',
  });
  const html = iconv.decode(Buffer.from(buf), 'gbk');
  const items: BookMetadata[] = [];

  // 当当列表项结构：<a title="书名" href="..."> ... <p class="search_book_author"><a>作者</a> ... /出版社/...</p>
  const liRegex =
    /<li[^>]*id="p\d+"[\s\S]{0,4000}?<a[^>]*title="([^"]+)"[^>]*href="([^"]+)"[^>]*>[\s\S]{0,2000}?class="search_book_author"[^>]*>([\s\S]{0,500}?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = liRegex.exec(html)) !== null && items.length < limit) {
    const [, title, href, authorBlock] = m;
    // 解析作者块：<a>作者</a>/<span>日期</span>/<a>出版社</a>
    const plain = authorBlock.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
    const parts = plain.split('|').map((s) => s.trim()).filter(Boolean);
    items.push({
      title: title.trim(),
      authors: parts[0] && !/加入购物车|放入收藏/.test(parts[0]) ? [parts[0]] : [],
      publishDate: parts.find((p) => /^\d{4}/.test(p)),
      publisher:
        parts[parts.length - 1] !== parts[0] &&
        !/加入购物车|放入收藏/.test(parts[parts.length - 1])
          ? parts[parts.length - 1]
          : undefined,
      source: 'dangdang',
      detailUrl: href.startsWith('//') ? `https:${href}` : href,
    });
  }
  return items;
}

/* -------------------------------- 京东图书（HTML 解析） -------------------------------- */
/**
 * 京东图书搜索（HTML 抓取）
 * https://search.jd.com/Search?keyword=三体&book=y&enc=utf-8
 */
export async function searchJDBooks(
  query: string,
  limit = 20,
): Promise<BookMetadata[]> {
  const url = `https://search.jd.com/Search?keyword=${encodeURIComponent(query)}&book=y&enc=utf-8`;
  const { data: html } = await axios.get<string>(url, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://www.jd.com/' },
    timeout: TIMEOUT_MS,
    responseType: 'text',
  });
  const items: BookMetadata[] = [];

  // 京东列表项：<li class="gl-item" data-sku="..."> ... <em>书名</em> ... <i>作者</i> ...
  const liRegex =
    /<li[^>]*class="gl-item"[^>]*data-sku="(\d+)"[\s\S]{0,5000}?<em>([\s\S]{1,200}?)<\/em>[\s\S]{0,3000}?<span class="p-bi-name">([\s\S]{0,300}?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = liRegex.exec(html)) !== null && items.length < limit) {
    const [, sku, titleHtml, authorHtml] = m;
    const title = titleHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const author = authorHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    items.push({
      title,
      authors: author ? [author] : [],
      source: 'jd-books',
      detailUrl: `https://item.jd.com/${sku}.html`,
    });
  }
  return items;
}
