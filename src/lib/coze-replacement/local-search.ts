/**
 * 本地搜索 Provider —— 零外部 API Key，真正"穷尽全网"
 *
 * 🔴 大陆 VPS 网络环境定制版（v3）：
 *   - 移除墙外源（DuckDuckGo / Gutenberg / WikisourceZh）—— 在阿里云大陆出口根本走不通
 *   - 主力源：百度 + 搜狗 + 360 + cn.bing，全部在大陆能直连
 *   - 保留 CText（公版古籍，对玄学老书有效）
 *   - 每个源失败独立 catch，互不影响
 *   - 详细日志输出每个源的真实结果数，便于 PM2 logs 排查
 *
 * 不依赖任何 API Key，符合"完全脱离扣子 / 0 成本部署"目标。
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { WebSearchItem } from './search';

// 真实浏览器 UA（百度/搜狗对 axios 默认 UA 反爬严，必须伪装成 Edge/Chrome）
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const TIMEOUT_MS = 12_000;

/** 入口：按书名/查询并行搜索多源，合并去重返回
 *
 * 🟢 2025-Q4 用户规则：去掉搜索引擎抓取，所有搜索都直接返回空。
 *    搜索引擎被 VPS 出口 IP 反爬封禁，长期返 0 条，徒增延迟。
 *    现在改为直接走 LLM 知识兜底（book-task-manager 内置）。
 *    保留下面 searchBaidu/Sogou/360/CnBing/CText 函数定义不删，
 *    便于将来切换 provider 或本地测试时随时启用。
 */
export async function localPublicDomainSearch(
  _query: string,
  _count = 20,
): Promise<WebSearchItem[]> {
  // 直接返回空，让上层 SearchClient 走 LLM 知识兜底
  console.log('[LocalSearch] 搜索引擎已停用，由 LLM 知识兜底接管');
  return [];
}

/** 旧入口保留（暂未删除，预留切回搜索引擎抓取的能力）。
 *  ⚠️ 这个函数当前在生产中不会被调用。
 */
export async function localPublicDomainSearchLegacy(
  query: string,
  count = 20,
): Promise<WebSearchItem[]> {
  const hasSite = /\bsite:/i.test(query);

  // 大陆能直连的搜索引擎（site: 操作符均支持）
  const tasks: Array<Promise<WebSearchItem[]>> = [
    safeSearch('baidu', () => searchBaidu(query, count)),
    safeSearch('sogou', () => searchSogou(query, count)),
    safeSearch('so360', () => search360(query, count)),
    safeSearch('cnbing', () => searchCnBing(query, count)),
  ];

  if (!hasSite) {
    // 通用查询时叠加 CText（公版古籍，对玄学老书有命中率）
    tasks.push(safeSearch('ctext', () => searchCText(query)));
  }

  const lists = await Promise.all(tasks);
  const merged: WebSearchItem[] = [];
  const seen = new Set<string>();
  let totalRaw = 0;
  for (const list of lists) {
    totalRaw += list.length;
    for (const item of list) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      merged.push(item);
      if (merged.length >= count) {
        console.log(
          `[LocalSearch] query="${query.slice(0, 30)}" 各源原始结果=${totalRaw} 去重后=${merged.length}（达上限早返回）`,
        );
        return merged;
      }
    }
  }
  console.log(
    `[LocalSearch] query="${query.slice(0, 30)}" 各源原始结果=${totalRaw} 去重后=${merged.length}`,
  );
  return merged;
}

/** 包裹失败 catch + 日志，确保单源 fail 不影响整体 */
async function safeSearch(
  name: string,
  fn: () => Promise<WebSearchItem[]>,
): Promise<WebSearchItem[]> {
  try {
    const list = await fn();
    console.log(`[LocalSearch][${name}] 返回 ${list.length} 条`);
    return list;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[LocalSearch][${name}] 失败:`, msg.slice(0, 200));
    return [];
  }
}

/**
 * 百度搜索（HTML 抓取）
 * - 端点：https://www.baidu.com/s?wd=...&rn=20
 * - 大陆 VPS 必通
 * - 结果链接是百度跳转 URL，但 title/snippet 是真实的，足够用作来源指引
 */
async function searchBaidu(query: string, count: number): Promise<WebSearchItem[]> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=${Math.min(count, 50)}`;
  const resp = await axios.get<string>(url, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://www.baidu.com/' },
    timeout: TIMEOUT_MS,
    maxRedirects: 3,
    validateStatus: (s) => s < 500,
    responseType: 'text',
  });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
  // 百度新旧两套结果容器：.c-container（新版 PC）+ .result（旧版）
  $('.c-container, .result.c-container, div.result').each((_, el) => {
    if (items.length >= count) return;
    const $el = $(el);
    const $a = $el.find('h3 a, .t a').first();
    const title = $a.text().trim();
    const href = $a.attr('href') || '';
    if (!title || !href || !href.startsWith('http')) return;
    const snippet = $el
      .find('.c-abstract, .content-right_2s-H4, .c-span9, .c-span-last')
      .text()
      .trim();
    items.push({
      title,
      url: href,
      snippet: snippet || title,
      source: 'baidu',
    });
  });
  return items;
}

/**
 * 搜狗搜索（HTML 抓取）
 * - 端点：https://www.sogou.com/web?query=...
 * - 大陆 VPS 必通
 */
async function searchSogou(query: string, count: number): Promise<WebSearchItem[]> {
  const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}&num=${Math.min(count, 50)}`;
  const resp = await axios.get<string>(url, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://www.sogou.com/' },
    timeout: TIMEOUT_MS,
    maxRedirects: 3,
    validateStatus: (s) => s < 500,
    responseType: 'text',
  });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
  // 搜狗结果：.results > .vrwrap / .rb / .result
  $('.results .vrwrap, .results .rb, .results .result, .vrwrap, .rb').each((_, el) => {
    if (items.length >= count) return;
    const $el = $(el);
    const $a = $el.find('h3 a, .vr-title a, .pt a').first();
    let title = $a.text().trim();
    let href = $a.attr('href') || '';
    if (!title) {
      const $b = $el.find('a').first();
      title = $b.text().trim();
      href = $b.attr('href') || '';
    }
    if (!title || !href) return;
    // 搜狗用相对路径跳转
    if (href.startsWith('/')) href = 'https://www.sogou.com' + href;
    if (!href.startsWith('http')) return;
    const snippet = $el.find('.str_info, .ft, .star-wiki, .fz-mid').text().trim();
    items.push({
      title,
      url: href,
      snippet: snippet || title,
      source: 'sogou',
    });
  });
  return items;
}

/**
 * 360 搜索（HTML 抓取）
 * - 端点：https://www.so.com/s?q=...
 * - 大陆 VPS 必通
 */
async function search360(query: string, count: number): Promise<WebSearchItem[]> {
  const url = `https://www.so.com/s?q=${encodeURIComponent(query)}&rn=${Math.min(count, 50)}`;
  const resp = await axios.get<string>(url, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://www.so.com/' },
    timeout: TIMEOUT_MS,
    maxRedirects: 3,
    validateStatus: (s) => s < 500,
    responseType: 'text',
  });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
  // 360 结果：.res-list > .res-rich / .result
  $('.res-list, .result, li.res-list').each((_, el) => {
    if (items.length >= count) return;
    const $el = $(el);
    const $a = $el.find('h3.res-title a, .res-title a, h3 a').first();
    const title = $a.text().trim();
    const href = $a.attr('href') || '';
    if (!title || !href || !href.startsWith('http')) return;
    const snippet = $el.find('.res-desc, .res-rich-text, p.res-desc').text().trim();
    items.push({
      title,
      url: href,
      snippet: snippet || title,
      source: '360',
    });
  });
  return items;
}

/**
 * cn.bing.com 搜索（HTML 抓取）
 * - 端点：https://cn.bing.com/search?q=...&mkt=zh-CN
 * - 大陆 VPS 直连最稳（避开 www.bing.com 302 重定向丢失参数）
 */
async function searchCnBing(query: string, count: number): Promise<WebSearchItem[]> {
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&mkt=zh-CN&ensearch=0`;
  const resp = await axios.get<string>(url, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://cn.bing.com/' },
    timeout: TIMEOUT_MS,
    maxRedirects: 5,
    validateStatus: (s) => s < 500,
    responseType: 'text',
  });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
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
      source: 'cnbing',
    });
  });
  return items;
}

/** CText 搜索：API 形如 /searchbooks.pl?if=gb&searchu=渊海子平 */
async function searchCText(query: string): Promise<WebSearchItem[]> {
  const url = `https://ctext.org/searchbooks.pl?if=gb&searchu=${encodeURIComponent(query)}`;
  const resp = await axios.get<string>(url, {
    headers: BROWSER_HEADERS,
    timeout: TIMEOUT_MS,
    responseType: 'text',
  });
  const $ = cheerio.load(resp.data);
  const items: WebSearchItem[] = [];
  $('a').each((_, el) => {
    const $el = $(el);
    const title = $el.text().trim();
    const href = $el.attr('href') || '';
    if (!title || !href) return;
    if (!title.includes(query) && !looseMatch(title, query)) return;
    const absUrl = href.startsWith('http')
      ? href
      : `https://ctext.org${href.startsWith('/') ? '' : '/'}${href}`;
    items.push({
      title,
      url: absUrl,
      snippet: `CText 公版古籍：${title}`,
      source: 'ctext',
    });
  });
  return dedupByUrl(items).slice(0, 8);
}

function looseMatch(text: string, query: string): boolean {
  const norm = (s: string) =>
    s.replace(/[\s·・·.,，。：:;；'"《》()（）]/g, '').toLowerCase();
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
