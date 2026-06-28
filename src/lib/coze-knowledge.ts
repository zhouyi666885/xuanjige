/**
 * Coze Knowledge Base 集成 - 你在 Coze 平台录入的「AI 宗师方法论 / 分析框架」知识库
 *
 * 这层是「分析方法论 / 思维框架」层，与 APP 本地 fulltext-search（典籍原文层）互补：
 *  - Coze KB：怎么分析、什么是宗师能力边界、哪些维度、对标哪个准确度
 *  - 本地典籍：按什么分析、《滴天髓》《渊海子平》等原文
 *
 * 默认走「不限制 dataset」即搜索用户在 Coze 平台创建的全部 Knowledge Base。
 * 失败/超时/SDK 不存在 一律降级为空结果，绝不影响主流程。
 *
 * ⚠️ 注意：`coze-coding-dev-sdk` 是 Coze 开发沙箱专属 SDK，VPS 部署环境通常没有此包，
 * 所以这里用 **运行时动态加载 + try/catch 兜底**，让 build 不会因为缺包失败。
 */

/** APP 上传典籍写入到 Coze KB 时统一使用这个 dataset，方便检索时区分"典籍 vs 方法论" */
export const COZE_KB_BOOKS_DATASET = 'xuanjige_books';

export interface CozeKnowledgeChunk {
  score: number;
  content: string;
  docId?: string;
  chunkId?: string;
}

/* ----------- 运行时动态加载 SDK（绕过 webpack/turbopack 静态分析） ----------- */

interface KbChunkRaw {
  score?: number;
  content?: string;
  doc_id?: string;
  chunk_id?: string;
}

interface KbSearchResp {
  code?: number;
  chunks?: KbChunkRaw[];
}

interface KbAddResp {
  code?: number;
}

interface KbClient {
  search: (
    query: string,
    tableNames: string[] | undefined,
    topK: number,
    minScore: number,
  ) => Promise<KbSearchResp>;
  addDocuments: (
    docs: Array<Record<string, unknown>>,
    tableName: string,
    chunkConfig: Record<string, unknown>,
  ) => Promise<KbAddResp>;
}

interface LooseSdk {
  KnowledgeClient: new (config: unknown) => KbClient;
  Config: new () => unknown;
  DataSourceType: { TEXT: string | number };
}

let _sdkCache: LooseSdk | null | 'unavailable' = null;

function loadSdk(): LooseSdk | null {
  if (_sdkCache === 'unavailable') return null;
  if (_sdkCache) return _sdkCache;

  try {
    // 用 eval('require') 阻止 webpack/turbopack 把这个 require 解析进 build 依赖图
    // 这样即使 VPS 上没装 coze-coding-dev-sdk，build 也不会失败
    // 仅在 Coze 沙箱环境下运行时会真正加载到 SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: NodeRequire = (eval('require') as any) as NodeRequire;
    const sdk = req('coze-coding-dev-sdk') as LooseSdk;
    if (!sdk || !sdk.KnowledgeClient) {
      _sdkCache = 'unavailable';
      return null;
    }
    _sdkCache = sdk;
    return sdk;
  } catch {
    _sdkCache = 'unavailable';
    return null;
  }
}

/* ----------- 客户端实例缓存 ----------- */

let _client: KbClient | null = null;

function getClient(): KbClient | null {
  if (_client) return _client;
  const sdk = loadSdk();
  if (!sdk) return null;
  try {
    const config = new sdk.Config();
    _client = new sdk.KnowledgeClient(config);
    return _client;
  } catch {
    return null;
  }
}

/* ----------- 对外 API ----------- */

/**
 * 在 Coze Knowledge Base 中做语义检索
 * @param query 用户问题或关键词
 * @param topK 返回结果数（默认 8，覆盖多维度方法论）
 * @param minScore 最低相似度（默认 0.3，确保兜底召回方法论框架）
 */
export async function cozeKnowledgeSearch(
  query: string,
  topK = 8,
  minScore = 0.3,
): Promise<CozeKnowledgeChunk[]> {
  if (!query || !query.trim()) return [];

  const client = getClient();
  if (!client) return []; // SDK 不可用（VPS 环境），静默降级

  try {
    // tableNames 不传 → 搜索用户所有 Coze Knowledge Base
    const resp = await client.search(query.trim(), undefined, topK, minScore);
    if (!resp || resp.code !== 0 || !Array.isArray(resp.chunks)) {
      return [];
    }
    return resp.chunks
      .map(c => ({
        score: typeof c.score === 'number' ? c.score : 0,
        content: typeof c.content === 'string' ? c.content : '',
        docId: c.doc_id,
        chunkId: c.chunk_id,
      }))
      .filter(c => c.content.trim().length > 0);
  } catch (err) {
    // 网络失败 / 未配置 / 权限 → 静默降级，让主流程继续
    console.warn('[CozeKB] 搜索失败，已降级为空结果:', (err as Error).message);
    return [];
  }
}

/**
 * 把召回到的方法论 chunks 整理成 markdown 段落，用于直接拼接给用户
 * 或者作为 LLM system prompt 注入的「分析框架」上下文
 */
export function formatCozeChunks(chunks: CozeKnowledgeChunk[]): string {
  if (chunks.length === 0) return '';
  const blocks = chunks
    .map((c, i) => {
      const head = `### 方法论 ${i + 1}（相关度 ${c.score.toFixed(2)}）`;
      return `${head}\n${c.content.trim()}`;
    })
    .join('\n\n');
  return blocks;
}

/**
 * 把一本完整典籍写入到用户的 Coze Knowledge Base
 * Coze KB 会自动完成：切片 → 768 维向量化 → 建语义/关键词混合索引 → 云端持久化
 *
 * @param bookName 书名（用作 metadata.title）
 * @param fullText 全文内容（一字不漏，由 KB 自动切片）
 * @returns true=成功，false=失败（不抛错，让主流程继续）
 */
export async function addBookToCozeKB(
  bookName: string,
  fullText: string,
): Promise<boolean> {
  if (!bookName || !fullText || !fullText.trim()) return false;

  const sdk = loadSdk();
  const client = getClient();
  if (!sdk || !client) return false; // VPS 环境降级

  try {
    const doc = {
      source: sdk.DataSourceType.TEXT,
      raw_data: fullText,
    };
    // 每段 ~500 tokens，自动按段落/换行切分（符合典籍章节结构）
    const chunkConfig = {
      separator: '\n',
      max_tokens: 500,
      remove_extra_spaces: false,
    };
    const resp = await client.addDocuments(
      [doc],
      COZE_KB_BOOKS_DATASET,
      chunkConfig,
    );
    return !!resp && (resp.code === 0 || resp.code === undefined);
  } catch (err) {
    console.warn(
      `[CozeKB] 上传《${bookName}》失败，已降级（不影响本地知识库）：`,
      (err as Error).message,
    );
    return false;
  }
}
