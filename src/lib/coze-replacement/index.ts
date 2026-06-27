/**
 * coze-coding-dev-sdk 的独立替换层入口
 *
 * 业务代码只需把：
 *   import { ... } from 'coze-coding-dev-sdk';
 * 改为：
 *   import { ... } from '@/lib/coze-replacement';
 *
 * 即可完全脱离扣子平台运行
 */
export { Config } from './config';
export { LLMClient } from './llm';
export type { LLMMessage, LLMStreamOptions, LLMStreamChunk } from './llm';
export { SearchClient } from './search';
export type { SearchResultItem, WebSearchItem, WebSearchResponse, SearchOptions } from './search';
export { FetchClient } from './fetch';
export type { FetchContentItem, FetchResponse, FetchOptions } from './fetch';
export { KnowledgeClient, DataSourceType } from './knowledge';
export type { KnowledgeDocument, AddDocumentsOptions, KnowledgeSearchOptions, KnowledgeSearchHit, ChunkConfig } from './knowledge';
export { S3Storage } from './storage';
export type { S3StorageOptions } from './storage';
export { HeaderUtils, getReportBuffer, createWrappedFetch } from './utils';
