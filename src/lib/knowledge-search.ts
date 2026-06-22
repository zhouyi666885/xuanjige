/**
 * 知识库语义搜索工具
 * 使用 coze-coding-dev-sdk 的 KnowledgeClient 进行语义检索
 * 在 API 路由中调用，为 AI 回答提供精准的经典知识支撑
 */

import { KnowledgeClient, Config } from 'coze-coding-dev-sdk';

const DATASET_NAME = 'xuanxue_classics';

let clientInstance: KnowledgeClient | null = null;

function getKnowledgeClient(): KnowledgeClient {
  if (!clientInstance) {
    const config = new Config();
    clientInstance = new KnowledgeClient(config);
  }
  return clientInstance;
}

export interface KnowledgeSearchResult {
  content: string;
  score: number;
  docId: string;
}

/**
 * 语义搜索知识库
 * @param query 搜索查询文本
 * @param topK 返回结果数量（默认5）
 * @param minScore 最小相似度阈值（默认0.3）
 * @returns 匹配的知识片段列表
 */
export async function searchKnowledge(
  query: string,
  topK: number = 5,
  minScore: number = 0.3
): Promise<KnowledgeSearchResult[]> {
  try {
    const client = getKnowledgeClient();
    const response = await client.search(query, [DATASET_NAME], topK, minScore);

    if (response.code === 0 && response.chunks) {
      return response.chunks
        .filter((chunk) => chunk.doc_id !== undefined)
        .map((chunk) => ({
          content: chunk.content,
          score: chunk.score,
          docId: chunk.doc_id ?? '',
        }));
    }

    return [];
  } catch (error) {
    console.error('Knowledge search error:', error);
    return [];
  }
}

/**
 * 将知识库搜索结果格式化为可注入系统提示的文本
 * @param results 搜索结果列表
 * @returns 格式化后的知识文本
 */
export function formatKnowledgeResults(results: KnowledgeSearchResult[]): string {
  if (results.length === 0) return '';

  let text = '\n\n【知识库语义检索结果（以下为经典典籍中与用户问题最相关的核心论断）】\n';

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    text += `\n--- 相关度: ${(r.score * 100).toFixed(1)}% ---\n${r.content}\n`;
  }

  text += '\n请以上述经典论断为依据，结合你的专业知识回答用户问题。引经据典时请注明出处。';

  return text;
}
