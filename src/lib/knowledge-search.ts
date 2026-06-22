/**
 * 知识库语义搜索工具
 * 使用 coze-coding-dev-sdk 的 KnowledgeClient 进行语义检索
 * 在 API 路由中调用，为 AI 回答提供精准的经典知识支撑
 */

import { KnowledgeClient, Config } from 'coze-coding-dev-sdk';

// 13个领域知识库名称（与导入脚本一致）
const ALL_DATASETS = [
  'xueye_knowledge',       // 学业
  'hunyin_knowledge',      // 婚姻
  'shiye_knowledge',       // 事业
  'caiyun_knowledge',      // 财运
  'jiankang_knowledge',    // 健康
  'liuqin_knowledge',      // 六亲
  'dayun_knowledge',       // 大运流年
  'geju_knowledge',        // 格局判断
  'shensha_knowledge',     // 神煞应用
  'liuyao_knowledge',      // 六爻占卜
  'meihua_knowledge',      // 梅花易数
  'fengshui_knowledge',    // 风水地理
  'xiangxue_knowledge',    // 面相手相
];

// 领域关键词→数据集映射（精准搜索时使用）
const DOMAIN_DATASET_MAP: Record<string, string[]> = {
  '学业': ['xueye_knowledge'],
  '学习': ['xueye_knowledge'],
  '考试': ['xueye_knowledge'],
  '升学': ['xueye_knowledge'],
  '休学': ['xueye_knowledge'],
  '复学': ['xueye_knowledge'],
  '学历': ['xueye_knowledge'],
  '读书': ['xueye_knowledge'],
  '婚姻': ['hunyin_knowledge'],
  '结婚': ['hunyin_knowledge'],
  '离婚': ['hunyin_knowledge'],
  '恋爱': ['hunyin_knowledge'],
  '配偶': ['hunyin_knowledge'],
  '夫妻': ['hunyin_knowledge'],
  '感情': ['hunyin_knowledge'],
  '事业': ['shiye_knowledge'],
  '工作': ['shiye_knowledge'],
  '职业': ['shiye_knowledge'],
  '升职': ['shiye_knowledge'],
  '创业': ['shiye_knowledge'],
  '财运': ['caiyun_knowledge'],
  '赚钱': ['caiyun_knowledge'],
  '破财': ['caiyun_knowledge'],
  '投资': ['caiyun_knowledge'],
  '健康': ['jiankang_knowledge'],
  '疾病': ['jiankang_knowledge'],
  '身体': ['jiankang_knowledge'],
  '手术': ['jiankang_knowledge'],
  '父母': ['liuqin_knowledge'],
  '兄弟': ['liuqin_knowledge'],
  '子女': ['liuqin_knowledge'],
  '六亲': ['liuqin_knowledge'],
  '大运': ['dayun_knowledge'],
  '流年': ['dayun_knowledge'],
  '格局': ['geju_knowledge'],
  '用神': ['geju_knowledge'],
  '忌神': ['geju_knowledge'],
  '神煞': ['shensha_knowledge'],
  '桃花': ['shensha_knowledge'],
  '驿马': ['shensha_knowledge'],
  '华盖': ['shensha_knowledge'],
  '六爻': ['liuyao_knowledge'],
  '起卦': ['liuyao_knowledge'],
  '占卜': ['liuyao_knowledge'],
  '梅花': ['meihua_knowledge'],
  '风水': ['fengshui_knowledge'],
  '住房': ['fengshui_knowledge'],
  '面相': ['xiangxue_knowledge'],
  '手相': ['xiangxue_knowledge'],
  '面容': ['xiangxue_knowledge'],
};

/**
 * 根据查询文本识别应该搜索哪些数据集
 * 精准模式：只搜索相关领域；通用模式：搜索所有数据集
 */
function resolveDatasets(query: string): string[] | undefined {
  const matchedDatasets = new Set<string>();
  for (const [keyword, datasets] of Object.entries(DOMAIN_DATASET_MAP)) {
    if (query.includes(keyword)) {
      datasets.forEach(d => matchedDatasets.add(d));
    }
  }
  // 如果匹配到特定领域，只搜索这些领域；否则搜索全部
  return matchedDatasets.size > 0 ? Array.from(matchedDatasets) : undefined;
}

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
    const tableNames = resolveDatasets(query);
    const response = await client.search(query, tableNames, topK, minScore);

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
