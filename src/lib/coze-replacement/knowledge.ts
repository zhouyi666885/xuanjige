/**
 * 替换 coze-coding-dev-sdk KnowledgeClient
 *
 * 原 SDK 是云端向量库。独立部署后由 fulltext-search 接管全文检索。
 * 本 stub 接受所有原方法签名但返回空，确保业务代码无需改动。
 *
 * 兼容原 SDK 接口：
 *   - addDocuments(documents, tableName, options?) -> {success, count}
 *   - search(query, tableNames, topK?, minScore?) -> {code, chunks: [...]}
 */
import type { Config } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KnowledgeDocument = any;

export interface AddDocumentsOptions {
  separator?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  max_tokens?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface KnowledgeSearchChunk {
  doc_id?: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchResponse {
  code: number;
  chunks: KnowledgeSearchChunk[];
  message?: string;
}

export interface KnowledgeSearchOptions {
  query: string;
  topK?: number;
  scoreThreshold?: number;
}

export interface KnowledgeSearchHit {
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class KnowledgeClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: Config) {
    // no-op
  }

  /** 兼容签名 stub：实际入库由 fulltext-search 接管 */
  async addDocuments(
    documents: KnowledgeDocument[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tableName: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: AddDocumentsOptions,
  ): Promise<{ success: boolean; count: number }> {
    return { success: true, count: documents.length };
  }

  /**
   * 兼容签名：search(query, tableNames, topK?, minScore?) -> { code, chunks }
   * 返回空 chunks，让上游 fallback 到 fulltext-search
   */
  async search(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _query: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tableNames?: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _topK?: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _minScore?: number,
  ): Promise<KnowledgeSearchResponse> {
    return { code: 0, chunks: [] };
  }
}
