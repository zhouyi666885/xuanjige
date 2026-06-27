/**
 * 本地公版书搜索 Provider —— 零外部 API Key
 *
 * 数据源：
 *  - CText（中国哲学书电子化计划）：中国古籍最全，命理/术数书优先来源
 *  - 维基文库（zh.wikisource.org）：公版中文书
 *  - Project Gutenberg：全球公版书
 *
 * 不依赖 Serper / Bing / 扣子搜索接口，符合"完全脱离扣子"目标。
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { WebSearchItem } from './search';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

const TIMEOUT_MS = 10_000;

/** 入口：按书名在多个公版书源并行搜索，合并去重返回 */
export async function localPublicDomainSearch(
  query: string,
  count = 20,
): Promise<WebSearchItem[]> {
  const tasks = [
    searchCText(query).catch(() => []),
    searchWikisourceZh(query).catch(() => []),
    searchGutenberg(query).catch(() => []),
  ];
  const lists = await Promise.all(tasks);
  const merged: WebSearchItem[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      merged.push(item);
      if (merged.length >= count) return merged;
    }
  }
  return merged;
}

/** CText 搜索：API 形如 /searchbooks.pl?if=gb&searchu=渊海子平 */
async function searchCText(query: string): Promise<WebSearchItem[]> {
  const url = `https://ctext.org/searchbooks.pl?if=gb&searchu=${encodeURIComponent(query)}`;
  const resp = await axios.get<string>(url, { headers: DEFAULT_HEADERS, timeout: TIMEOUT_MS });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
  // 结果通常在 a 标签里，href 形如 /xxx 或 /xxx/zh
  $('a').each((_, el) => {
    const $el = $(el);
    const title = $el.text().trim();
    const href = $el.attr('href') || '';
    if (!title || !href) return;
    if (!title.includes(query) && !looseMatch(title, query)) return;
    const absUrl = href.startsWith('http') ? href : `https://ctext.org${href.startsWith('/') ? '' : '/'}${href}`;
    items.push({
      title,
      url: absUrl,
      snippet: `CText 公版古籍：${title}`,
      source: 'ctext',
    });
  });
  return dedupByUrl(items).slice(0, 8);
}

/** 维基文库搜索 */
async function searchWikisourceZh(query: string): Promise<WebSearchItem[]> {
  const apiUrl = `https://zh.wikisource.org/w/api.php?action=opensearch&search=${encodeURIComponent(
    query,
  )}&limit=8&namespace=0&format=json`;
  const resp = await axios.get(apiUrl, { headers: DEFAULT_HEADERS, timeout: TIMEOUT_MS });
  // opensearch 返回 [query, titles[], descriptions[], urls[]]
  const data = resp.data as [string, string[], string[], string[]];
  if (!Array.isArray(data) || data.length < 4) return [];
  const titles = data[1] || [];
  const descs = data[2] || [];
  const urls = data[3] || [];
  return titles.map((t, i) => ({
    title: t,
    url: urls[i] || '',
    snippet: descs[i] || `维基文库公版：${t}`,
    source: 'wikisource',
  }));
}

/** Project Gutenberg 搜索（Gutendex API） */
async function searchGutenberg(query: string): Promise<WebSearchItem[]> {
  const apiUrl = `https://gutendex.com/books?search=${encodeURIComponent(query)}`;
  const resp = await axios.get(apiUrl, { headers: DEFAULT_HEADERS, timeout: TIMEOUT_MS });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (resp.data?.results || []) as any[];
  return results.slice(0, 8).map((b) => {
    const formats = b.formats || {};
    const textUrl: string =
      formats['text/plain; charset=utf-8'] ||
      formats['text/plain'] ||
      formats['text/html'] ||
      formats['text/html; charset=utf-8'] ||
      '';
    const author = Array.isArray(b.authors) && b.authors[0] ? b.authors[0].name : '';
    return {
      title: String(b.title || ''),
      url: textUrl || `https://www.gutenberg.org/ebooks/${b.id}`,
      snippet: `Gutenberg 公版：${b.title}${author ? ` / ${author}` : ''}`,
      source: 'gutenberg',
    };
  });
}

function looseMatch(text: string, query: string): boolean {
  // 简易模糊匹配：去空白、去标点后包含
  const norm = (s: string) => s.replace(/[\s·・·.,，。：:;；'"《》()（）]/g, '').toLowerCase();
  return norm(text).includes(norm(query));
}

function dedupByUrl(items: WebSearchItem[]): WebSearchItem[] {
  const seen = new Set<string>();
  const out: WebSearchItem[] = [];
  for (const it of items) {
    if (it.url && !seen.has(it.url)) {
      seen.add(it.url);
      out.push(it);
    }
  }
  return out;
}
