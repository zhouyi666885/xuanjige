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
    // local provider 不需要 API Key，其他 provider 必须有 Key
    if (this.provider !== 'local' && !this.apiKey) return { web_items: [] };
    try {
      let items: WebSearchItem[] = [];
      switch (this.provider) {
        case 'serper': items = await this.searchSerper(query, count); break;
        case 'bing':   items = await this.searchBing(query, count); break;
        case 'tavily': items = await this.searchTavily(query, count); break;
        case 'local':  items = await localPublicDomainSearch(query, count); break;
      }
      return { web_items: items };
    } catch (err) {
      console.error(`[SearchClient][${this.provider}] 失败:`, (err as Error).message);
      return { web_items: [] };
    }
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
