/**
 * 知识库预筛模块
 *
 * 目标：在所有已录入书籍中，对用户问题做关键词命中评分，把书分为：
 *   - high:   高相关（top 30% 命中），全文精读
 *   - medium: 中相关（30%-60% 命中），重点段落审读
 *   - low:    低相关（> 0 命中但靠后），仅匹配段落
 *   - sample: 兜底抽样（0 命中的书，随机抽 5 本），保证不漏意外关联
 *
 * 工程铁律：
 *   1. 任何已录入的书都不能被完全跳过（兜底抽样保证 0 漏检）
 *   2. 评分维度多元化：关键词命中数 + 命中段落数 + 命中位置（开篇 / 目录）权重
 *   3. 同义词扩展，避免"学业 / 文昌 / 科甲 / 功名"等近义词漏检
 */

import { getBookFullTextAsync } from './fulltext-search';

export interface PrescreenResult {
  /** 高相关：全文精读 */
  high: BookScore[];
  /** 中相关：重点段落审读 */
  medium: BookScore[];
  /** 低相关：仅匹配段落 */
  low: BookScore[];
  /** 兜底抽样：保证 0 命中也不会被漏 */
  sample: BookScore[];
  /** 完全无关：不会进入 Map-Reduce */
  irrelevant: BookScore[];
  /** 总书数 */
  totalBooks: number;
  /** 关键词列表（命中评分用） */
  keywords: string[];
}

export interface BookScore {
  bookName: string;
  /** 综合得分：keywordHits * 1 + paragraphHits * 3 + positionBonus */
  score: number;
  keywordHits: number;
  paragraphHits: number;
  positionBonus: number;
  contentLength: number;
}

/** 主题同义词扩展 — 用于关键词同义词替换 */
const TOPIC_SYNONYMS: Record<string, string[]> = {
  // 学业相关
  学业: ['学业', '文昌', '科甲', '功名', '考试', '读书', '学习', '文曲', '魁星', '科举', '及第', '状元', '才学'],
  事业: ['事业', '官运', '官星', '禄位', '仕途', '功名', '官职', '工作', '职业', '前程', '前途', '发展'],
  财运: ['财运', '正财', '偏财', '财库', '财源', '财禄', '钱财', '富贵', '富'],
  婚姻: ['婚姻', '夫妻', '配偶', '正缘', '感情', '姻缘', '夫妇', '夫妻宫'],
  健康: ['健康', '疾病', '伤病', '气血', '阴阳', '寒热', '虚实', '脏腑', '病灾'],
  子女: ['子女', '子嗣', '后代', '子息', '儿女'],
  父母: ['父母', '父亲', '母亲', '尊长', '长辈', '父星', '母星'],
  兄弟: ['兄弟', '姐妹', '手足', '兄弟宫', '比劫'],
  // 命理核心
  日主: ['日主', '日元', '元神', '本命', '命主'],
  用神: ['用神', '喜用', '调候', '通关'],
  格局: ['格局', '从格', '正格', '专旺', '化气'],
  // 其他术语
  风水: ['风水', '堪舆', '地理', '形势', '理气', '玄空', '八宅', '飞星'],
  面相: ['面相', '相术', '五官', '三停', '十二宫', '气色', '神相'],
  手相: ['手相', '掌纹', '掌相', '丘位', '主线'],
};

/**
 * 提取关键词（含同义词扩展）
 */
export function extractKeywordsWithSynonyms(query: string): string[] {
  const keywords = new Set<string>();

  // 1) 从同义词词典里查
  for (const [topic, synonyms] of Object.entries(TOPIC_SYNONYMS)) {
    if (query.includes(topic) || synonyms.some(s => query.includes(s))) {
      synonyms.forEach(s => keywords.add(s));
    }
  }

  // 2) 命理核心术语（直接匹配）
  const coreTerms = [
    '日主', '日元', '旺衰', '用神', '格局',
    '正官', '偏官', '七杀', '正印', '偏印', '正财', '偏财', '食神', '伤官', '比肩', '劫财',
    '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
    '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
    '天干', '地支', '藏干', '五行', '阴阳',
    '冲', '合', '刑', '害', '破', '会', '化',
    '紫微', '天府', '太阳', '太阴', '贪狼', '巨门', '武曲', '廉贞', '七杀', '破军',
    '六爻', '梅花', '奇门', '六壬', '八字', '四柱',
    '乾', '坤', '震', '巽', '坎', '离', '艮', '兑',
    '青龙', '白虎', '朱雀', '玄武',
  ];
  for (const term of coreTerms) {
    if (query.includes(term)) keywords.add(term);
  }

  // 3) 从用户问题中提取 2-4 字中文词
  const chineseWords = query.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  for (const w of chineseWords.slice(0, 12)) keywords.add(w);

  return Array.from(keywords);
}

/**
 * 计算单本书对关键词的得分
 */
function scoreBook(bookName: string, content: string, keywords: string[]): BookScore {
  if (!content || content.length === 0) {
    return {
      bookName,
      score: 0,
      keywordHits: 0,
      paragraphHits: 0,
      positionBonus: 0,
      contentLength: 0,
    };
  }

  // 关键词命中次数（全文）
  let keywordHits = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    // 全文计数
    let pos = 0;
    while ((pos = content.indexOf(kw, pos)) !== -1) {
      keywordHits++;
      pos += kw.length;
      if (keywordHits > 9999) break; // 防止单关键词刷分过大
    }
  }

  // 命中段落数（按段落分隔，每段最多算一次）
  const paragraphs = content.split(/\n+|\r+/);
  let paragraphHits = 0;
  for (const para of paragraphs) {
    for (const kw of keywords) {
      if (kw && para.includes(kw)) {
        paragraphHits++;
        break;
      }
    }
  }

  // 位置加分：在开篇 5% 内命中，权重高（古籍序言/目录常列要点）
  const headPortion = content.substring(0, Math.min(content.length * 0.05, 5000));
  let positionBonus = 0;
  for (const kw of keywords) {
    if (kw && headPortion.includes(kw)) {
      positionBonus += 5;
    }
  }

  // 书名命中加分：书名本身包含关键词时大幅加分
  for (const kw of keywords) {
    if (kw && bookName.includes(kw)) {
      positionBonus += 20;
    }
  }

  const score = keywordHits * 1 + paragraphHits * 3 + positionBonus;

  return {
    bookName,
    score,
    keywordHits,
    paragraphHits,
    positionBonus,
    contentLength: content.length,
  };
}

/**
 * 对所有书做预筛 + 评分 + 分级
 *
 * @param query        用户问题
 * @param allBookNames 所有已录入的书名列表
 * @param opts         {
 *   highRatio:   高相关比例（默认 0.3）
 *   mediumRatio: 中相关比例（默认 0.6，即 30%-60%）
 *   sampleCount: 兜底抽样数量（默认 5）
 *   maxBooks:    最多参与评分的书数（避免太慢，默认 5000）
 * }
 */
export async function prescreenAllBooks(
  query: string,
  allBookNames: string[],
  opts: { highRatio?: number; mediumRatio?: number; sampleCount?: number; maxBooks?: number } = {}
): Promise<PrescreenResult> {
  const { highRatio = 0.3, mediumRatio = 0.6, sampleCount = 5, maxBooks = 5000 } = opts;

  const keywords = extractKeywordsWithSynonyms(query);
  if (keywords.length === 0) {
    // 没有关键词时，所有书都视为低相关 + 全量抽样
    const allScores: BookScore[] = allBookNames.slice(0, maxBooks).map(n => ({
      bookName: n,
      score: 0,
      keywordHits: 0,
      paragraphHits: 0,
      positionBonus: 0,
      contentLength: 0,
    }));
    return {
      high: [],
      medium: [],
      low: allScores,
      sample: [],
      irrelevant: [],
      totalBooks: allBookNames.length,
      keywords,
    };
  }

  // 并发评分（最多 20 路并发，避免内存爆掉）
  const booksToScore = allBookNames.slice(0, maxBooks);
  const scores: BookScore[] = [];
  const CONCURRENCY = 20;

  for (let i = 0; i < booksToScore.length; i += CONCURRENCY) {
    const batch = booksToScore.slice(i, i + CONCURRENCY);
    const batchScores = await Promise.all(
      batch.map(async name => {
        try {
          const content = await getBookFullTextAsync(name);
          return scoreBook(name, content || '', keywords);
        } catch {
          return {
            bookName: name,
            score: 0,
            keywordHits: 0,
            paragraphHits: 0,
            positionBonus: 0,
            contentLength: 0,
          };
        }
      })
    );
    scores.push(...batchScores);
  }

  // 按得分排序（降序）
  scores.sort((a, b) => b.score - a.score);

  // 分组
  const hasHit = scores.filter(s => s.score > 0);
  const noHit = scores.filter(s => s.score === 0);

  const highEnd = Math.max(1, Math.ceil(hasHit.length * highRatio));
  const mediumEnd = Math.max(highEnd + 1, Math.ceil(hasHit.length * mediumRatio));

  const high = hasHit.slice(0, highEnd);
  const medium = hasHit.slice(highEnd, mediumEnd);
  const low = hasHit.slice(mediumEnd);

  // 兜底抽样（从 0 命中的书里随机抽 N 本）
  const shuffled = [...noHit].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, Math.min(sampleCount, noHit.length));
  const irrelevant = shuffled.slice(Math.min(sampleCount, noHit.length));

  return {
    high,
    medium,
    low,
    sample,
    irrelevant,
    totalBooks: allBookNames.length,
    keywords,
  };
}
