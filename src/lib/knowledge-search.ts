/**
 * 知识库语义搜索工具
 * 使用 coze-coding-dev-sdk 的 KnowledgeClient 进行语义检索
 * 在 API 路由中调用，为 AI 回答提供精准的经典知识支撑
 */

import { KnowledgeClient, Config } from 'coze-coding-dev-sdk';

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
 * @param topK 返回结果数量（默认200，无上限，尽可能多检索）
 * @param minScore 最小相似度阈值（默认0.01，尽可能多）
 * @returns 匹配的知识片段列表
 */
export async function searchKnowledge(
  query: string,
  topK: number = 200,
  minScore: number = 0.01
): Promise<KnowledgeSearchResult[]> {
  try {
    const client = getKnowledgeClient();
    const allResults: KnowledgeSearchResult[] = [];
    const seenContents = new Set<string>();
    
    // ======== 第一轮：全量搜索（不指定数据集，搜索所有数据集）========
    // 这是最重要的一轮：搜索所有数据集，包括用户手动添加的book knowledge base
    // 不限定数据集名称，确保不遗漏任何来源
    const fullResults = await doSearch(client, query, undefined, topK, 0.01);
    for (const r of fullResults) {
      if (!seenContents.has(r.content)) {
        allResults.push(r);
        seenContents.add(r.content);
      }
    }
    
    // ======== 第二轮：简化查询再搜一次（更宽泛的关键词）========
    const broadQuery = simplifyQuery(query);
    if (broadQuery !== query) {
      const broadResults = await doSearch(client, broadQuery, undefined, topK, 0.01);
      for (const r of broadResults) {
        if (!seenContents.has(r.content)) {
          allResults.push(r);
          seenContents.add(r.content);
        }
      }
    }
    
    // ======== 第三轮：提取领域关键词，用精炼关键词再搜 ========
    const domainKeywords = extractDomainKeywords(query);
    if (domainKeywords && domainKeywords !== query && domainKeywords !== broadQuery) {
      const domainResults = await doSearch(client, domainKeywords, undefined, topK, 0.01);
      for (const r of domainResults) {
        if (!seenContents.has(r.content)) {
          allResults.push(r);
          seenContents.add(r.content);
        }
      }
    }
    
    // ======== 第四轮：如果结果较少，用更泛化的关键词补充 ========
    if (allResults.length < 10) {
      const genericQuery = extractGenericTopic(query);
      if (genericQuery && genericQuery !== query && genericQuery !== broadQuery && genericQuery !== domainKeywords) {
        const genericResults = await doSearch(client, genericQuery, undefined, topK, 0.01);
        for (const r of genericResults) {
          if (!seenContents.has(r.content)) {
            allResults.push(r);
            seenContents.add(r.content);
          }
        }
      }
    }
    
    return allResults;
  } catch (error) {
    console.error('Knowledge search error:', error);
    return [];
  }
}

/**
 * 简化查询——提取核心关键词，用于第二轮更宽泛的搜索
 * 例如"我的学业什么时候能恢复"→"学业恢复"
 */
function simplifyQuery(query: string): string {
  // 去掉常见无关词
  const stopWords = ['我的', '我', '的', '什么时候', '什么', '时候', '能', '会', '可以', '吗', '呢', '了', '是', '有', '在', '和', '与', '跟', '都', '也', '还', '又', '就', '才', '要', '想', '请', '帮', '分析', '看看', '说一下', '告诉'];
  let simplified = query;
  for (const w of stopWords) {
    simplified = simplified.replace(new RegExp(w, 'g'), '');
  }
  return simplified.trim() || query;
}

/**
 * 提取领域关键词——从用户问题中提炼核心命理术语
 * 例如"我八字庚金日主，问学业什么时候能恢复"→"庚金日主学业"
 */
function extractDomainKeywords(query: string): string {
  const domainTerms = [
    '八字', '四柱', '日主', '用神', '忌神', '格局', '十神', '藏干',
    '正官', '偏官', '正印', '偏印', '正财', '偏财', '食神', '伤官',
    '比肩', '劫财', '大运', '流年', '命宫', '胎元', '身宫',
    '紫微', '斗数', '命宫', '财帛', '事业', '迁移', '夫妻', '福德',
    '六爻', '占卜', '起卦', '铜钱', '纳甲', '世应',
    '梅花', '易数', '体用', '互卦', '变卦',
    '风水', '飞星', '八宅', '玄空', '文昌', '财位',
    '面相', '手相', '五官', '三停', '十二宫',
    '学业', '婚姻', '事业', '财运', '健康', '六亲',
    '休学', '复学', '考试', '升学',
    '桃花', '驿马', '华盖', '天乙', '文昌', '将星',
    '冲', '合', '刑', '害', '破', '空亡',
    '旺', '衰', '强', '弱', '从格', '化格',
    '庚金', '辛金', '甲木', '乙木', '丙火', '丁火', '戊土', '己土', '壬水', '癸水',
    '盲派', '口诀', '秘典',
  ];
  const found = domainTerms.filter(t => query.includes(t));
  if (found.length > 0) {
    return found.join('');
  }
  return '';
}

/**
 * 提取泛化主题——将具体问题泛化为更广的主题
 * 例如"我的学业什么时候能恢复"→"学业恢复"
 */
function extractGenericTopic(query: string): string {
  const topicMap: [RegExp, string][] = [
    [/学[业校]|考试|升学|休学|复学|读书/, '学业考试'],
    [/婚[姻恋]|结[婚合]|离[婚婚]|感情|配偶|夫妻/, '婚姻感情'],
    [/事[业职]|工作|升职|创业|求职/, '事业工作'],
    [/财[运富]|赚钱|破财|投资|理财/, '财运财富'],
    [/健[康康]|疾病|身体|手术|寿命/, '健康疾病'],
    [/父母|兄弟|子女|六亲/, '六亲关系'],
    [/面[相容]|五官|额头|眉毛|眼睛/, '面相分析'],
    [/手[相纹]|掌纹|生命线|智慧线|感情线/, '手相分析'],
    [/风水|住房|搬家|装修|朝向/, '风水布局'],
    [/六爻|起卦|占卜|铜钱/, '六爻占卜'],
    [/梅花|易数|数字起卦/, '梅花易数'],
    [/大运|流年|运程/, '大运流年'],
  ];
  for (const [regex, topic] of topicMap) {
    if (regex.test(query)) {
      return topic;
    }
  }
  return '';
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

  let text = '\n\n==========【知识库强制检索结果——全部论断必须引用——无上限】==========\n';
  text += '🔴🔴🔴🔴🔴【最高铁律——永久生效——违反即为无效回答——无上限】🔴🔴🔴🔴🔴\n';
  text += '1. 你必须把以下【每一条】典籍论断全部列出来！一条都不能漏！\n';
  text += '2. 禁止只挑其中几条就回答！必须把所有论断全部引用出来！\n';
  text += '3. ⚠️禁止在回答中标注或出现任何书名（如《某某》），将典籍知识消化吸收后融入分析逻辑中即可\n';
  text += '4. 列完所有论断后，再结合命盘特征逐一交叉验证\n';
  text += '5. 最终判断必须综合所有典籍论断，不能只依据其中几条\n';
  text += '6. 不引用知识库内容就直接回答=无效！只引用部分论断=无效！\n';
  text += '7. 禁止编造知识库中没有的典籍内容或论断\n';
  text += '8. 🔴检索没有上限！引用没有上限！回答没有上限！有多少论断就引用多少论断，绝不允许省略！\n';
  text += `本次共检索到 ${results.length} 条典籍论断！以下 ${results.length} 条必须全部引用，一条不漏！\n`;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const scorePct = (r.score * 100).toFixed(1);
    text += `\n【典籍论断 ${i + 1}/${results.length}】（相关度: ${scorePct}%）\n${r.content}\n`;
  }

  text += '\n==========【知识库检索结束——无上限】==========\n';
  text += '\n回答格式要求（无上限）：';
  text += '\n1. 先逐条列出上述所有典籍论断（⚠️禁止出现书名，只列出知识点内容），一条都不能漏！';
  text += '\n2. 再结合命盘特征，对每条知识点逐一进行交叉验证';
  text += '\n3. 最后给出综合判断，⚠️禁止出现任何书名';
  text += '\n4. 禁止只摘部分论断就回答！必须全部引用！全部！没有上限！';

  return text;
}
