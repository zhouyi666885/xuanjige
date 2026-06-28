/**
 * Coze Knowledge Base 集成 - 你在 Coze 平台录入的「AI 宗师方法论 / 分析框架」知识库
 *
 * 这层是「分析方法论 / 思维框架」层，与 APP 本地 fulltext-search（典籍原文层）互补：
 *  - Coze KB：怎么分析、什么是宗师能力边界、哪些维度、对标哪个准确度
 *  - 本地典籍：按什么分析、《滴天髓》《渊海子平》等原文
 *
 * 默认走「不限制 dataset」即搜索用户在 Coze 平台创建的全部 Knowledge Base。
 * 失败/超时一律降级为空数组，绝不影响主流程。
 */

import {
  KnowledgeClient,
  Config,
  DataSourceType,
  type KnowledgeDocument,
  type ChunkConfig,
} from 'coze-coding-dev-sdk';

/** APP 上传典籍写入到 Coze KB 时统一使用这个 dataset，方便检索时区分"典籍 vs 方法论" */
export const COZE_KB_BOOKS_DATASET = 'xuanjige_books';

export interface CozeKnowledgeChunk {
  score: number;
  content: string;
  docId?: string;
  chunkId?: string;
}

let _client: KnowledgeClient | null = null;
function getClient(): KnowledgeClient {
  if (_client) return _client;
  const config = new Config();
  _client = new KnowledgeClient(config);
  return _client;
}

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

  try {
    const client = getClient();
    // tableNames 不传 → 搜索用户所有 Coze Knowledge Base
    const resp = await client.search(query.trim(), undefined, topK, minScore);
    if (!resp || resp.code !== 0 || !Array.isArray(resp.chunks)) {
      return [];
    }
    return resp.chunks.map(c => ({
      score: typeof c.score === 'number' ? c.score : 0,
      content: typeof c.content === 'string' ? c.content : '',
      docId: c.doc_id,
      chunkId: c.chunk_id,
    })).filter(c => c.content.trim().length > 0);
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

  try {
    const client = getClient();
    const doc: KnowledgeDocument = {
      source: DataSourceType.TEXT,
      raw_data: fullText,
    };
    // 每段 ~500 tokens，自动按段落/换行切分（符合典籍章节结构）
    const chunkConfig: ChunkConfig = {
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
