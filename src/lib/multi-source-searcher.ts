/**
 * 多源搜索调度器 - 真实接入 8 个公开数据源
 *
 * 落实铁规则六（用户原话最高权威版本）：
 *   "搜索书籍的时候，如果一个网站搜不到这本书，就换下一个网站继续搜，
 *    不能因为一个网站没有就放弃，要穷尽所有能搜的网站。"
 *
 * 当前接入的源：
 *   1. ctext.org      - 中国哲学书电子化计划（古籍首选，API 友好）
 *   2. zh.wikisource.org - 中文维基文库（MediaWiki API）
 *   3. archive.org    - Internet Archive（开放搜索 API）
 *   4. gutenberg.org  - Project Gutenberg（公版书）
 *   5. gushiwen.cn    - 古诗文网（HTML 抓取）
 *   6. guoxuedashi.com - 国学大师（HTML 抓取）
 *   7. zhonghuadiancang.com - 中华典藏（HTML 抓取）
 *   8. DuckDuckGo HTML - 通用兜底搜索引擎
 *
 * 调度策略：
 *   - 并发调用全部源（Promise.allSettled，任何源失败不影响其他）
 *   - 实时回调进度
 *   - 返回所有 found=true 的源结果
 *   - 不做拼接（交给 cross-site-merger.ts）
 */

export interface ChapterFragment {
  index: number;        // 章节序号（按源内顺序，可能为 0 起；拼接时重排）
  title: string;        // 章节标题（如"乾卦"、"第一章"、"序"）
  content: string;      // 章节正文
  source: string;       // 来源标识（如 "ctext"）
  url?: string;         // 该章节在该源的具体 URL
}

export interface SourceResult {
  source: string;       // 源 ID
  sourceName: string;   // 源中文名（展示用）
  found: boolean;
  bookName: string;
  fragments: ChapterFragment[];
  rawContent?: string;  // 备用：原始整本内容（无章节切分时用）
  url?: string;
  totalChars: number;
  error?: string;
  fetchedAt: number;    // 时间戳
}

export interface MultiSourceSearchResult {
  bookName: string;
  totalSources: number;
  successSources: number;
  results: SourceResult[];     // 所有源的结果（含失败）
  totalFragments: number;
  totalChars: number;
  searchedAt: number;
}

// ============= 工具函数 =============

const DEFAULT_FETCH_TIMEOUT = 15000;

async function safeFetch(url: string, opts: RequestInit = {}, timeout = DEFAULT_FETCH_TIMEOUT): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XuanjigeBot/1.0; +https://8.139.254.205)',
        ...(opts.headers || {}),
      },
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitleFromHtml(html: string, pattern: RegExp): string {
  const m = html.match(pattern);
  return m ? stripHtml(m[1]).trim() : '';
}

// ============= 1. ctext.org（中国哲学书电子化计划） =============

async function searchCText(bookName: string): Promise<SourceResult> {
  const sourceName = 'ctext.org（中国哲学书电子化计划）';
  const start = Date.now();
  try {
    // ctext 的中文搜索：/zhs?searchu=书名
    const searchUrl = `https://ctext.org/zhs?searchu=${encodeURIComponent(bookName)}`;
    const res = await safeFetch(searchUrl);
    if (!res || !res.ok) {
      return { source: 'ctext', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '搜索接口无响应', fetchedAt: start };
    }
    const html = await res.text();
    // 提取结果链接：寻找 href="/zhs/xxx" 包含书名的
    const linkPattern = new RegExp(`href="(\\/zhs\\/[^"]+)"[^>]*>([^<]*${bookName}[^<]*)<`, 'g');
    const matches = Array.from(html.matchAll(linkPattern));
    if (matches.length === 0) {
      return { source: 'ctext', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '未匹配到书名', fetchedAt: start };
    }
    // 取第一个匹配的书籍页面
    const bookPath = matches[0][1];
    const bookUrl = `https://ctext.org${bookPath}`;
    const bookRes = await safeFetch(bookUrl);
    if (!bookRes || !bookRes.ok) {
      return { source: 'ctext', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '书籍详情页无响应', fetchedAt: start };
    }
    const bookHtml = await bookRes.text();
    // 提取章节列表
    const chapterPattern = new RegExp(`href="(\\/zhs\\/[^"]+)"[^>]*>([^<]+)<\\/a>`, 'g');
    const chapterMatches = Array.from(bookHtml.matchAll(chapterPattern))
      .filter(m => !m[1].includes('searchu=') && !m[1].includes('#'))
      .slice(0, 200); // 防止抓爆
    const fragments: ChapterFragment[] = [];
    // 抓最多前 50 章（避免单源耗时过长，剩余可后续补抓）
    const limit = Math.min(chapterMatches.length, 50);
    for (let i = 0; i < limit; i++) {
      const [, chapPath, chapTitle] = chapterMatches[i];
      const chapUrl = `https://ctext.org${chapPath}`;
      const chapRes = await safeFetch(chapUrl, {}, 8000);
      if (!chapRes || !chapRes.ok) continue;
      const chapHtml = await chapRes.text();
      // ctext 的正文在 class="ctext" 的元素里
      const contentMatch = chapHtml.match(/<div[^>]+class="[^"]*ctext[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const content = contentMatch ? stripHtml(contentMatch[1]) : stripHtml(chapHtml).slice(0, 5000);
      if (content.length < 20) continue;
      fragments.push({
        index: i,
        title: stripHtml(chapTitle).trim(),
        content,
        source: 'ctext',
        url: chapUrl,
      });
    }
    const totalChars = fragments.reduce((s, f) => s + f.content.length, 0);
    return {
      source: 'ctext',
      sourceName,
      found: fragments.length > 0,
      bookName,
      fragments,
      url: bookUrl,
      totalChars,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'ctext', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 2. zh.wikisource.org（中文维基文库） =============

async function searchWikisource(bookName: string): Promise<SourceResult> {
  const sourceName = 'zh.wikisource.org（中文维基文库）';
  const start = Date.now();
  try {
    // MediaWiki search API
    const apiUrl = `https://zh.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(bookName)}&format=json&srlimit=10`;
    const res = await safeFetch(apiUrl);
    if (!res || !res.ok) {
      return { source: 'wikisource', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '搜索API无响应', fetchedAt: start };
    }
    const data = await res.json();
    const hits: Array<{ title: string }> = data?.query?.search || [];
    if (hits.length === 0) {
      return { source: 'wikisource', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '未搜到', fetchedAt: start };
    }
    // 取第一个最相关的页面，假定它包含书的主页（章节列表）
    const titlePrefix = hits[0].title;
    // 拉这个主页面看是否有章节链接
    const mainUrl = `https://zh.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(titlePrefix)}&format=json&prop=text|links`;
    const mainRes = await safeFetch(mainUrl);
    if (!mainRes || !mainRes.ok) {
      return { source: 'wikisource', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '主页面无响应', fetchedAt: start };
    }
    const mainData = await mainRes.json();
    const mainHtml: string = mainData?.parse?.text?.['*'] || '';
    const links: Array<{ ns: number; '*': string }> = mainData?.parse?.links || [];
    // 章节链接通常是 titlePrefix/卷一、titlePrefix/序 这样
    const chapterTitles = links
      .filter(l => l.ns === 0 && l['*'].startsWith(titlePrefix + '/'))
      .map(l => l['*'])
      .slice(0, 200);
    const fragments: ChapterFragment[] = [];
    if (chapterTitles.length === 0) {
      // 无子页面，全书就在主页面
      const content = stripHtml(mainHtml);
      if (content.length > 100) {
        fragments.push({
          index: 0,
          title: titlePrefix,
          content,
          source: 'wikisource',
          url: `https://zh.wikisource.org/wiki/${encodeURIComponent(titlePrefix)}`,
        });
      }
    } else {
      const limit = Math.min(chapterTitles.length, 50);
      for (let i = 0; i < limit; i++) {
        const chapTitle = chapterTitles[i];
        const chapUrl = `https://zh.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(chapTitle)}&format=json&prop=text`;
        const chapRes = await safeFetch(chapUrl, {}, 8000);
        if (!chapRes || !chapRes.ok) continue;
        const chapData = await chapRes.json();
        const html: string = chapData?.parse?.text?.['*'] || '';
        const content = stripHtml(html);
        if (content.length < 20) continue;
        fragments.push({
          index: i,
          title: chapTitle.replace(titlePrefix + '/', ''),
          content,
          source: 'wikisource',
          url: `https://zh.wikisource.org/wiki/${encodeURIComponent(chapTitle)}`,
        });
      }
    }
    const totalChars = fragments.reduce((s, f) => s + f.content.length, 0);
    return {
      source: 'wikisource',
      sourceName,
      found: fragments.length > 0,
      bookName,
      fragments,
      url: `https://zh.wikisource.org/wiki/${encodeURIComponent(titlePrefix)}`,
      totalChars,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'wikisource', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 3. archive.org（Internet Archive） =============

async function searchInternetArchive(bookName: string): Promise<SourceResult> {
  const sourceName = 'archive.org（Internet Archive）';
  const start = Date.now();
  try {
    const searchUrl = `https://archive.org/advancedsearch.php?q=title%3A(${encodeURIComponent(bookName)})+AND+mediatype%3Atexts&fl[]=identifier&fl[]=title&fl[]=language&rows=5&output=json`;
    const res = await safeFetch(searchUrl);
    if (!res || !res.ok) {
      return { source: 'archive', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '搜索接口无响应', fetchedAt: start };
    }
    const data = await res.json();
    const docs: Array<{ identifier: string; title: string }> = data?.response?.docs || [];
    if (docs.length === 0) {
      return { source: 'archive', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '未搜到', fetchedAt: start };
    }
    // 取第一个，下载它的 _djvu.txt 全文
    const id = docs[0].identifier;
    const txtUrl = `https://archive.org/download/${id}/${id}_djvu.txt`;
    const txtRes = await safeFetch(txtUrl, {}, 25000);
    if (!txtRes || !txtRes.ok) {
      return { source: 'archive', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '全文文件不存在', fetchedAt: start };
    }
    const fullText = await txtRes.text();
    if (fullText.length < 200) {
      return { source: 'archive', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '内容太短', fetchedAt: start };
    }
    // 按章节分（找"第N章"/"卷X"等模式）
    const chapterSplit = /(?=第[一二三四五六七八九十百千零〇\d]+[章卷篇回]|卷[一二三四五六七八九十\d]+|第\d+章)/g;
    const parts = fullText.split(chapterSplit).filter(p => p.trim().length > 50);
    const fragments: ChapterFragment[] = parts.length > 1
      ? parts.slice(0, 200).map((p, i) => ({
          index: i,
          title: p.split('\n')[0].slice(0, 30).trim(),
          content: p.trim(),
          source: 'archive',
        }))
      : [{ index: 0, title: docs[0].title, content: fullText, source: 'archive' }];
    const totalChars = fragments.reduce((s, f) => s + f.content.length, 0);
    return {
      source: 'archive',
      sourceName,
      found: true,
      bookName,
      fragments,
      rawContent: fullText,
      url: `https://archive.org/details/${id}`,
      totalChars,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'archive', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 4. gutenberg.org（Project Gutenberg） =============

async function searchGutenberg(bookName: string): Promise<SourceResult> {
  const sourceName = 'gutenberg.org（Project Gutenberg）';
  const start = Date.now();
  try {
    // 用 gutendex API（gutenberg 的非官方 JSON API，更稳定）
    const apiUrl = `https://gutendex.com/books/?search=${encodeURIComponent(bookName)}`;
    const res = await safeFetch(apiUrl);
    if (!res || !res.ok) {
      return { source: 'gutenberg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: 'API无响应', fetchedAt: start };
    }
    const data = await res.json();
    const results: Array<{ id: number; title: string; formats: Record<string, string> }> = data?.results || [];
    if (results.length === 0) {
      return { source: 'gutenberg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '未搜到', fetchedAt: start };
    }
    const book = results[0];
    // 优先要纯文本格式
    const txtUrl =
      book.formats['text/plain; charset=utf-8'] ||
      book.formats['text/plain; charset=us-ascii'] ||
      book.formats['text/plain'] ||
      Object.entries(book.formats).find(([k]) => k.startsWith('text/plain'))?.[1];
    if (!txtUrl) {
      return { source: 'gutenberg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '无纯文本格式', fetchedAt: start };
    }
    const txtRes = await safeFetch(txtUrl, {}, 25000);
    if (!txtRes || !txtRes.ok) {
      return { source: 'gutenberg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '全文下载失败', fetchedAt: start };
    }
    const fullText = await txtRes.text();
    // 去除 Gutenberg 头尾的"START OF PROJECT"/"END OF PROJECT"边界
    const startMark = fullText.search(/\*\*\*\s*START OF [A-Z\s]*PROJECT GUTENBERG/i);
    const endMark = fullText.search(/\*\*\*\s*END OF [A-Z\s]*PROJECT GUTENBERG/i);
    const cleanText = (startMark > 0 ? fullText.slice(startMark) : fullText).slice(0, endMark > 0 ? endMark - startMark : undefined);
    // 按 "CHAPTER" 切分
    const chapterSplit = /(?=CHAPTER\s+[IVXLCDM\d]+|Chapter\s+[IVXLCDM\d]+|第[一二三四五六七八九十百千\d]+章)/g;
    const parts = cleanText.split(chapterSplit).filter(p => p.trim().length > 50);
    const fragments: ChapterFragment[] = parts.length > 1
      ? parts.slice(0, 200).map((p, i) => ({
          index: i,
          title: p.split('\n')[0].slice(0, 40).trim(),
          content: p.trim(),
          source: 'gutenberg',
        }))
      : [{ index: 0, title: book.title, content: cleanText, source: 'gutenberg' }];
    const totalChars = fragments.reduce((s, f) => s + f.content.length, 0);
    return {
      source: 'gutenberg',
      sourceName,
      found: true,
      bookName,
      fragments,
      rawContent: cleanText,
      url: `https://www.gutenberg.org/ebooks/${book.id}`,
      totalChars,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'gutenberg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 5. gushiwen.cn（古诗文网） =============

async function searchGushiwen(bookName: string): Promise<SourceResult> {
  const sourceName = 'gushiwen.cn（古诗文网）';
  const start = Date.now();
  try {
    const searchUrl = `https://so.gushiwen.cn/search.aspx?type=guji&page=1&value=${encodeURIComponent(bookName)}`;
    const res = await safeFetch(searchUrl);
    if (!res || !res.ok) {
      return { source: 'gushiwen', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '搜索页无响应', fetchedAt: start };
    }
    const html = await res.text();
    // 提取古籍链接
    const linkMatch = html.match(new RegExp(`href="(\\/guwen\\/book[^"]*)"[^>]*>([^<]*${bookName}[^<]*)<`));
    if (!linkMatch) {
      return { source: 'gushiwen', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '未匹配', fetchedAt: start };
    }
    const bookUrl = `https://so.gushiwen.cn${linkMatch[1]}`;
    const bookRes = await safeFetch(bookUrl);
    if (!bookRes || !bookRes.ok) {
      return { source: 'gushiwen', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '书目页无响应', fetchedAt: start };
    }
    const bookHtml = await bookRes.text();
    // 各章节链接
    const chapPattern = /href="(\/guwen\/bfanyi[^"]+)"[^>]*>([^<]+)</g;
    const chapMatches = Array.from(bookHtml.matchAll(chapPattern)).slice(0, 50);
    const fragments: ChapterFragment[] = [];
    for (let i = 0; i < chapMatches.length; i++) {
      const [, chapPath, chapTitle] = chapMatches[i];
      const chapUrl = `https://so.gushiwen.cn${chapPath}`;
      const chapRes = await safeFetch(chapUrl, {}, 8000);
      if (!chapRes || !chapRes.ok) continue;
      const chapHtml = await chapRes.text();
      const contentMatch = chapHtml.match(/<div[^>]+class="contson"[^>]*>([\s\S]*?)<\/div>/);
      const content = contentMatch ? stripHtml(contentMatch[1]) : '';
      if (content.length < 20) continue;
      fragments.push({ index: i, title: stripHtml(chapTitle).trim(), content, source: 'gushiwen', url: chapUrl });
    }
    const totalChars = fragments.reduce((s, f) => s + f.content.length, 0);
    return {
      source: 'gushiwen',
      sourceName,
      found: fragments.length > 0,
      bookName,
      fragments,
      url: bookUrl,
      totalChars,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'gushiwen', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 6. guoxuedashi.com（国学大师） =============

async function searchGuoxueDashi(bookName: string): Promise<SourceResult> {
  const sourceName = 'guoxuedashi.com（国学大师）';
  const start = Date.now();
  try {
    const searchUrl = `https://www.guoxuedashi.net/search/?keyword=${encodeURIComponent(bookName)}`;
    const res = await safeFetch(searchUrl);
    if (!res || !res.ok) {
      return { source: 'guoxuedashi', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '搜索页无响应', fetchedAt: start };
    }
    const html = await res.text();
    // 提取最相关的链接
    const m = html.match(new RegExp(`href="(\\/[^"]*${encodeURIComponent(bookName).replace(/%[0-9A-F]{2}/g, '.')}[^"]*\\.html)"`, 'i'));
    if (!m) {
      return { source: 'guoxuedashi', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '未匹配', fetchedAt: start };
    }
    const bookUrl = `https://www.guoxuedashi.net${m[1]}`;
    const bookRes = await safeFetch(bookUrl);
    if (!bookRes || !bookRes.ok) {
      return { source: 'guoxuedashi', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '书目页无响应', fetchedAt: start };
    }
    const bookHtml = await bookRes.text();
    const content = stripHtml(bookHtml);
    if (content.length < 100) {
      return { source: 'guoxuedashi', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '内容过短', fetchedAt: start };
    }
    return {
      source: 'guoxuedashi',
      sourceName,
      found: true,
      bookName,
      fragments: [{ index: 0, title: bookName, content, source: 'guoxuedashi', url: bookUrl }],
      rawContent: content,
      url: bookUrl,
      totalChars: content.length,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'guoxuedashi', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 7. zhonghuadiancang.com（中华典藏） =============

async function searchZhonghuaDiancang(bookName: string): Promise<SourceResult> {
  const sourceName = 'zhonghuadiancang.com（中华典藏）';
  const start = Date.now();
  try {
    const searchUrl = `https://www.zhonghuadiancang.com/search.html?searchword=${encodeURIComponent(bookName)}`;
    const res = await safeFetch(searchUrl);
    if (!res || !res.ok) {
      return { source: 'zhdc', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '搜索页无响应', fetchedAt: start };
    }
    const html = await res.text();
    const m = html.match(/<a[^>]+href="(\/[^"]+)"[^>]*>([^<]+)<\/a>/g);
    const firstBookLink = m?.find(s => s.includes(bookName));
    if (!firstBookLink) {
      return { source: 'zhdc', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '未匹配', fetchedAt: start };
    }
    const urlM = firstBookLink.match(/href="(\/[^"]+)"/);
    if (!urlM) {
      return { source: 'zhdc', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '链接解析失败', fetchedAt: start };
    }
    const bookUrl = `https://www.zhonghuadiancang.com${urlM[1]}`;
    const bookRes = await safeFetch(bookUrl);
    if (!bookRes || !bookRes.ok) {
      return { source: 'zhdc', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '书目页无响应', fetchedAt: start };
    }
    const bookHtml = await bookRes.text();
    const content = stripHtml(bookHtml);
    if (content.length < 100) {
      return { source: 'zhdc', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '内容过短', fetchedAt: start };
    }
    return {
      source: 'zhdc',
      sourceName,
      found: true,
      bookName,
      fragments: [{ index: 0, title: bookName, content, source: 'zhdc', url: bookUrl }],
      rawContent: content,
      url: bookUrl,
      totalChars: content.length,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'zhdc', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 8. DuckDuckGo HTML（兜底通用搜索） =============

async function searchDuckDuckGo(bookName: string): Promise<SourceResult> {
  const sourceName = 'DuckDuckGo（通用兜底搜索）';
  const start = Date.now();
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(bookName + ' 全文')}`;
    const res = await safeFetch(searchUrl);
    if (!res || !res.ok) {
      return { source: 'ddg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '搜索引擎无响应', fetchedAt: start };
    }
    const html = await res.text();
    // 提取结果链接
    const linkPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const matches = Array.from(html.matchAll(linkPattern)).slice(0, 5);
    if (matches.length === 0) {
      return { source: 'ddg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: '无结果', fetchedAt: start };
    }
    // 取前 3 个非黑名单链接，每个抓取摘要
    const blacklist = ['google.com', 'baidu.com', 'youtube.com'];
    const fragments: ChapterFragment[] = [];
    for (let i = 0; i < Math.min(matches.length, 3); i++) {
      const url = matches[i][1].startsWith('//') ? `https:${matches[i][1]}` : matches[i][1];
      if (blacklist.some(bl => url.includes(bl))) continue;
      try {
        const pageRes = await safeFetch(url, {}, 8000);
        if (!pageRes || !pageRes.ok) continue;
        const pageHtml = await pageRes.text();
        const content = stripHtml(pageHtml).slice(0, 8000);
        if (content.length < 50) continue;
        if (!content.includes(bookName) && !content.includes(bookName.slice(0, 2))) continue;
        fragments.push({
          index: i,
          title: stripHtml(matches[i][2]).trim().slice(0, 40),
          content,
          source: 'ddg',
          url,
        });
      } catch {
        // 个别链接失败跳过
      }
    }
    const totalChars = fragments.reduce((s, f) => s + f.content.length, 0);
    return {
      source: 'ddg',
      sourceName,
      found: fragments.length > 0,
      bookName,
      fragments,
      totalChars,
      fetchedAt: start,
    };
  } catch (e) {
    return { source: 'ddg', sourceName, found: false, bookName, fragments: [], totalChars: 0, error: e instanceof Error ? e.message : String(e), fetchedAt: start };
  }
}

// ============= 主调度器 =============

export interface SearchProgressEvent {
  type: 'start' | 'source_start' | 'source_done' | 'source_failed' | 'all_done';
  source?: string;
  sourceName?: string;
  message: string;
  totalSources?: number;
  doneSources?: number;
  foundSources?: number;
  totalChars?: number;
  totalFragments?: number;
}

const ALL_SEARCHERS: Array<{ id: string; name: string; fn: (n: string) => Promise<SourceResult> }> = [
  { id: 'ctext', name: 'ctext.org', fn: searchCText },
  { id: 'wikisource', name: 'zh.wikisource.org', fn: searchWikisource },
  { id: 'archive', name: 'archive.org', fn: searchInternetArchive },
  { id: 'gutenberg', name: 'gutenberg.org', fn: searchGutenberg },
  { id: 'gushiwen', name: 'gushiwen.cn', fn: searchGushiwen },
  { id: 'guoxuedashi', name: 'guoxuedashi.com', fn: searchGuoxueDashi },
  { id: 'zhdc', name: 'zhonghuadiancang.com', fn: searchZhonghuaDiancang },
  { id: 'ddg', name: 'DuckDuckGo', fn: searchDuckDuckGo },
];

export async function searchAllSources(
  bookName: string,
  onProgress?: (event: SearchProgressEvent) => void,
): Promise<MultiSourceSearchResult> {
  const startedAt = Date.now();
  const totalSources = ALL_SEARCHERS.length;
  let doneSources = 0;
  let foundSources = 0;
  onProgress?.({
    type: 'start',
    message: `开始穷尽搜索：${totalSources} 个数据源`,
    totalSources,
    doneSources: 0,
  });
  const results: SourceResult[] = [];
  // 并发执行，但每个源完成后单独回调进度
  await Promise.all(
    ALL_SEARCHERS.map(async ({ id, name, fn }) => {
      onProgress?.({
        type: 'source_start',
        source: id,
        sourceName: name,
        message: `[${id}] ${name} 开始搜索`,
        totalSources,
        doneSources,
      });
      const result = await fn(bookName).catch(
        (e): SourceResult => ({
          source: id,
          sourceName: name,
          found: false,
          bookName,
          fragments: [],
          totalChars: 0,
          error: e instanceof Error ? e.message : String(e),
          fetchedAt: Date.now(),
        }),
      );
      results.push(result);
      doneSources += 1;
      if (result.found) {
        foundSources += 1;
        onProgress?.({
          type: 'source_done',
          source: id,
          sourceName: name,
          message: `[${id}] ✅ 找到 ${result.fragments.length} 章/段，${result.totalChars} 字`,
          totalSources,
          doneSources,
          foundSources,
        });
      } else {
        onProgress?.({
          type: 'source_failed',
          source: id,
          sourceName: name,
          message: `[${id}] ❌ ${result.error || '未找到'}`,
          totalSources,
          doneSources,
          foundSources,
        });
      }
    }),
  );
  const totalFragments = results.reduce((s, r) => s + r.fragments.length, 0);
  const totalChars = results.reduce((s, r) => s + r.totalChars, 0);
  onProgress?.({
    type: 'all_done',
    message: `穷尽搜索完成：${foundSources}/${totalSources} 个源找到内容，共 ${totalFragments} 段，${totalChars} 字`,
    totalSources,
    doneSources,
    foundSources,
    totalChars,
    totalFragments,
  });
  return {
    bookName,
    totalSources,
    successSources: foundSources,
    results,
    totalFragments,
    totalChars,
    searchedAt: startedAt,
  };
}
