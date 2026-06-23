/**
 * 知识库语义搜索工具
 * 使用 coze-coding-dev-sdk 的 KnowledgeClient 进行语义检索
 * 在 API 路由中调用，为 AI 回答提供精准的经典知识支撑
 */

import { KnowledgeClient, Config } from 'coze-coding-dev-sdk';

// 16个知识库名称（13领域+书籍体系+方法论+盲派命理）
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
  'book_system_knowledge', // 约400本书籍完整体系
  'methodology_knowledge', // 方法论（26步学习路径/已验证规则/权重/四维分析/五域分析/映射表/关键词/要点/禁止事项/14个局限与改进）
  'mangpai_knowledge',     // 盲派命理（盲派秘典/郝圣鸽/北方秘本/断事口诀）
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
  // 补充：书籍体系和方法论
  '书籍': ['book_system_knowledge', 'methodology_knowledge'],
  '典籍': ['book_system_knowledge', 'methodology_knowledge'],
  '书目': ['book_system_knowledge'],
  '盲派': ['mangpai_knowledge', 'book_system_knowledge'],
  '口诀': ['mangpai_knowledge', 'methodology_knowledge'],
  '铁律': ['methodology_knowledge'],
  '已验证': ['methodology_knowledge'],
  '局限': ['methodology_knowledge'],
  '权重': ['methodology_knowledge'],
  '四维': ['methodology_knowledge'],
  '映射': ['methodology_knowledge'],
  '检索关键词': ['methodology_knowledge'],
  '学习路径': ['methodology_knowledge'],
  '改进': ['methodology_knowledge'],
  // 多领域交叉搜索
  '命盘': ['xueye_knowledge', 'hunyin_knowledge', 'shiye_knowledge', 'caiyun_knowledge', 'jiankang_knowledge', 'liuqin_knowledge', 'dayun_knowledge', 'geju_knowledge', 'methodology_knowledge'],
  '运势': ['dayun_knowledge', 'shiye_knowledge', 'caiyun_knowledge'],
  '整体': ['dayun_knowledge', 'geju_knowledge', 'methodology_knowledge'],
  '全面': ['dayun_knowledge', 'geju_knowledge', 'methodology_knowledge'],
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
 * @param topK 返回结果数量（默认8）
 * @param minScore 最小相似度阈值（默认0.2，更低以获取更多相关结果）
 * @returns 匹配的知识片段列表
 */
export async function searchKnowledge(
  query: string,
  topK: number = 8,
  minScore: number = 0.2
): Promise<KnowledgeSearchResult[]> {
  try {
    const client = getKnowledgeClient();
    
    // 第一轮：精准搜索（只搜索相关领域数据集）
    const targetDatasets = resolveDatasets(query);
    const preciseResults = await doSearch(client, query, targetDatasets, topK, minScore);
    
    // 如果精准搜索结果不足3条，扩大到全量搜索
    if (preciseResults.length < 3) {
      const broadResults = await doSearch(client, query, undefined, topK, minScore);
      // 合并去重（优先精准搜索的结果）
      const existingContents = new Set(preciseResults.map(r => r.content));
      for (const r of broadResults) {
        if (!existingContents.has(r.content) && preciseResults.length < topK) {
          preciseResults.push(r);
          existingContents.add(r.content);
        }
      }
    }
    
    return preciseResults;
  } catch (error) {
    console.error('Knowledge search error:', error);
    return [];
  }
}

async function doSearch(
  client: KnowledgeClient,
  query: string,
  tableNames: string[] | undefined,
  topK: number,
  minScore: number
): Promise<KnowledgeSearchResult[]> {
  try {
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
    console.error('Knowledge doSearch error:', error);
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

  let text = '\n\n==========【知识库强制检索结果】==========\n';
  text += '⚠️ 铁律：你的回答必须引用以下知识库内容！不引用知识库内容直接回答的判断视为无效！\n';
  text += '⚠️ 你必须先列出从以下检索结果中找到的相关论断，再结合命盘特征分析，最后给出判断。\n';
  text += `⚠️ 本次检索到 ${results.length} 条相关典籍论断：\n`;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const scorePct = (r.score * 100).toFixed(1);
    text += `\n【典籍论断 ${i + 1}】（相关度: ${scorePct}%）\n${r.content}\n`;
  }

  text += '\n==========【知识库检索结束】==========\n';
  text += '\n回答要求：';
  text += '\n1. 先引用上述知识库中的具体论断（标注出处如"《三命通会》云..."）';
  text += '\n2. 再结合用户命盘特征交叉验证';
  text += '\n3. 最后给出综合判断，说明引用了哪些典籍的哪些知识点';
  text += '\n4. 禁止不引用知识库内容就直接给出结论';

  return text;
}
