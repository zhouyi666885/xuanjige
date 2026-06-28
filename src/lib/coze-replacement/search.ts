/**
 * 替换 coze-coding-dev-sdk SearchClient
 * 兼容原 SDK 接口：webSearch(query, count) -> { web_items: [...] }
 *
 * 支持 Provider：
 * - serper.dev（推荐，每月 2500 次免费）
 * - Bing Web Search（Azure）
 * - Tavily Search
 * - none（返回空，禁用搜索功能）
 */
import axios from 'axios';
import type { Config } from './config';
import { aggregateBookSearch, toWebSearchItems } from './book-search-api';
import { localPublicDomainSearch } from './local-search';

export interface WebSearchItem {
  url: string;
  title: string;
  snippet: string;
  source?: string;
}

export interface WebSearchResponse {
  web_items: WebSearchItem[];
}

// 旧的对外签名兼容保留
export type SearchResultItem = WebSearchItem;
export interface SearchOptions {
  query: string;
  count?: number;
}

export class SearchClient {
  private apiKey: string;
  private provider: 'serper' | 'bing' | 'tavily' | 'local' | 'none';

  constructor(config: Config) {
    this.apiKey = config.searchApiKey;
    this.provider = config.searchProvider;
  }

  /** 原 SDK 兼容入口：webSearch(query, count) -> { web_items } */
  async webSearch(query: string, count = 20): Promise<WebSearchResponse> {
    if (this.provider === 'none') return { web_items: [] };

    let items: WebSearchItem[] = [];

    // 1. 先尝试配置的 provider（serper/bing/tavily 需要 API Key）
    if (this.provider !== 'local' && this.apiKey) {
      try {
        switch (this.provider) {
          case 'serper': items = await this.searchSerper(query, count); break;
          case 'bing':   items = await this.searchBing(query, count); break;
          case 'tavily': items = await this.searchTavily(query, count); break;
        }
        console.log(`[SearchClient][${this.provider}] 返回 ${items.length} 条`);
      } catch (err) {
        console.error(`[SearchClient][${this.provider}] 失败:`, (err as Error).message);
      }
    }

    // 2. 🔴 兜底：只要主 provider 返 0 条（或本就是 local），叠加 local 搜索
    //    大陆 VPS 即使没配/key 失效/api 被墙，也能稳定拿到结果
    if (items.length === 0 || this.provider === 'local') {
      try {
        const localItems = await localPublicDomainSearch(query, count);
        const seen = new Set(items.map((x) => x.url));
        for (const it of localItems) {
          if (it.url && !seen.has(it.url)) {
            items.push(it);
            seen.add(it.url);
          }
        }
        console.log(
          `[SearchClient][local-fallback] 叠加 ${localItems.length} 条，最终 ${items.length} 条`,
        );
      } catch (err) {
        console.error(`[SearchClient][local-fallback] 失败:`, (err as Error).message);
      }
    }

    // 3. 🟢 终极兜底：Open Library + Google Books 聚合（免费公开 API，无反爬）
    //    搜索引擎已彻底移除，这是当前唯一稳定能拿到书籍元数据的真实来源
    if (items.length < count) {
      try {
        const books = await aggregateBookSearch(query, count - items.length);
        const apiItems = toWebSearchItems(books);
        const seen = new Set(items.map((x) => x.url));
        for (const it of apiItems) {
          if (it.url && !seen.has(it.url)) {
            items.push(it);
            seen.add(it.url);
          }
        }
        console.log(
          `[SearchClient][book-api-fallback] 叠加 ${apiItems.length} 条（Open Library + Google Books），最终 ${items.length} 条`,
        );
      } catch (err) {
        console.error(
          `[SearchClient][book-api-fallback] 失败:`,
          (err as Error).message,
        );
      }
    }

    return { web_items: items };
  }

  /** 新的对象式签名，与上面的 webSearch 等价 */
  async search(options: SearchOptions): Promise<WebSearchItem[]> {
    const r = await this.webSearch(options.query, options.count || 20);
    return r.web_items;
  }

  private async searchSerper(query: string, count: number): Promise<WebSearchItem[]> {
    const resp = await axios.post(
      'https://google.serper.dev/search',
      { q: query, num: count },
      {
        headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
        timeout: 12_000,
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organic = (resp.data?.organic || []) as any[];
    return organic.map((r) => ({
      title: String(r.title || ''),
      url: String(r.link || ''),
      snippet: String(r.snippet || ''),
      source: 'serper',
    }));
  }

  private async searchBing(query: string, count: number): Promise<WebSearchItem[]> {
    const resp = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      params: { q: query, count, mkt: 'zh-CN' },
      headers: { 'Ocp-Apim-Subscription-Key': this.apiKey },
      timeout: 12_000,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = (resp.data?.webPages?.value || []) as any[];
    return pages.map((r) => ({
      title: String(r.name || ''),
      url: String(r.url || ''),
      snippet: String(r.snippet || ''),
      source: 'bing',
    }));
  }

  private async searchTavily(query: string, count: number): Promise<WebSearchItem[]> {
    const resp = await axios.post(
      'https://api.tavily.com/search',
      { api_key: this.apiKey, query, max_results: count },
      { timeout: 12_000 },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (resp.data?.results || []) as any[];
    return results.map((r) => ({
      title: String(r.title || ''),
      url: String(r.url || ''),
      snippet: String(r.content || ''),
      source: 'tavily',
    }));
  }
}
