/**
 * 本地搜索 Provider —— 零外部 API Key，真正"穷尽全网"
 *
 * 改造前：仅查 CText / 维基文库 / Gutenberg 3 个公版书源
 *         绝大多数玄学书（三命通会、紫微斗数等）搜不到
 *
 * 改造后：3 路并行 + 全部支持 site: 限定
 *   A. DuckDuckGo HTML（不需要 API Key、支持 site: 操作符、全球索引）
 *   B. Bing HTML（不需要 API Key、支持 site: 操作符、中文索引强）
 *   C. 公版书直连（CText / WikisourceZh / Gutenberg）：site: 限定的高质量补充
 *
 * 命中策略：query 含 `site:domain` → 走 A+B（搜索引擎天然支持 site:）
 *           query 不含 site:        → 走 A+B+C（搜索引擎 + 公版书源全开）
 *
 * 不依赖任何 API Key，符合"完全脱离扣子 / 0 成本部署"目标。
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { WebSearchItem } from './search';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const TIMEOUT_MS = 10_000;

/** 入口：按书名/查询并行搜索多源，合并去重返回 */
export async function localPublicDomainSearch(
  query: string,
  count = 20,
): Promise<WebSearchItem[]> {
  const hasSite = /\bsite:/i.test(query);
  // 通用查询：搜索引擎 + 公版书源全开
  // site: 限定查询：只走支持 site: 操作符的搜索引擎（DuckDuckGo + Bing）
  const tasks: Array<Promise<WebSearchItem[]>> = [
    searchDuckDuckGoHtml(query, count).catch((e) => {
      console.warn('[local-search][duckduckgo] 失败:', (e as Error).message);
      return [];
    }),
    searchBingHtml(query, count).catch((e) => {
      console.warn('[local-search][bing-html] 失败:', (e as Error).message);
      return [];
    }),
  ];

  if (!hasSite) {
    // 通用查询时再叠加 3 个公版书源（直接走站内 API/搜索）
    tasks.push(
      searchCText(query).catch(() => []),
      searchWikisourceZh(query).catch(() => []),
      searchGutenberg(query).catch(() => []),
    );
  }

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

/**
 * DuckDuckGo HTML 搜索（零 API Key）
 * - 端点：https://html.duckduckgo.com/html/?q=...
 * - 原生支持 site:domain 操作符
 * - 返回 HTML，需 cheerio 解析
 */
async function searchDuckDuckGoHtml(query: string, count: number): Promise<WebSearchItem[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await axios.get<string>(url, {
    headers: DEFAULT_HEADERS,
    timeout: TIMEOUT_MS,
    // DDG 偶尔重定向，跟随它
    maxRedirects: 3,
  });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
  // DDG 经典结果选择器：.result__a 是结果标题链接
  $('a.result__a').each((_, el) => {
    if (items.length >= count) return;
    const $el = $(el);
    const title = $el.text().trim();
    let href = $el.attr('href') || '';
    if (!title || !href) return;
    // DDG 用 /l/?uddg= 包装外链，解析出真实 URL
    if (href.startsWith('//') ) href = 'https:' + href;
    if (href.includes('uddg=')) {
      try {
        const u = new URL(href.startsWith('http') ? href : 'https:' + href);
        const real = u.searchParams.get('uddg');
        if (real) href = decodeURIComponent(real);
      } catch { /* 保留原始 href */ }
    }
    // snippet 在同级 .result__snippet
    const snippet = $el.closest('.result').find('.result__snippet').text().trim();
    items.push({
      title,
      url: href,
      snippet: snippet || title,
      source: 'duckduckgo-html',
    });
  });
  return items;
}

/**
 * Bing HTML 搜索（零 API Key）
 * - 端点：https://cn.bing.com/search?q=...&mkt=zh-CN（直连 cn.bing.com 避免 302 重定向丢失参数）
 * - 大陆 VPS 访问 www.bing.com 会自动 302 跳到 cn.bing.com，直接打 cn 端点最稳
 * - 原生支持 site:domain
 * - 对中文索引强
 */
async function searchBingHtml(query: string, count: number): Promise<WebSearchItem[]> {
  // 直接打 cn.bing.com（VPS 在大陆出口时 www.bing.com 会强制 302 到这里，HTML 结构兼容）
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&mkt=zh-CN&FORM=ANSPA1`;
  const resp = await axios.get<string>(url, {
    headers: {
      ...DEFAULT_HEADERS,
      // 加上 Accept-Language 确保返回中文结果
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: TIMEOUT_MS,
    maxRedirects: 5,
    validateStatus: (s) => s < 500,
  });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
  // Bing 经典结果：#b_results > li.b_algo > h2 > a
  $('#b_results li.b_algo').each((_, el) => {
    if (items.length >= count) return;
    const $li = $(el);
    const $a = $li.find('h2 a').first();
    const title = $a.text().trim();
    const href = $a.attr('href') || '';
    if (!title || !href || !href.startsWith('http')) return;
    const snippet = $li.find('.b_caption p, .b_snippet').text().trim();
    items.push({
      title,
      url: href,
      snippet: snippet || title,
      source: 'bing-html',
    });
  });
  return items;
}

/** CText 搜索：API 形如 /searchbooks.pl?if=gb&searchu=渊海子平 */
async function searchCText(query: string): Promise<WebSearchItem[]> {
  const url = `https://ctext.org/searchbooks.pl?if=gb&searchu=${encodeURIComponent(query)}`;
  const resp = await axios.get<string>(url, { headers: DEFAULT_HEADERS, timeout: TIMEOUT_MS });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
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
