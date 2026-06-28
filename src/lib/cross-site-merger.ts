/**
 * 跨站拼接器 - 落实铁规则六（用户原话最高权威版本）后半段
 *
 *   "如果一个网站只搜到了这本书的一部分，另一个网站搜到了另一部分，
 *    那就把两个网站的内容拼接起来，补全成一本完整的书。
 *    可以有多个网站的内容拼在一起，只要最终拼出来的是完整的原书就行。
 *    但是拼接必须按照原书的顺序和结构来拼，不能把不同书的内容混在一起，
 *    不能把前面章节和后面章节搞乱，不能张冠李戴。
 *    拼完之后要能从头到尾通顺读完，和原书的顺序、章节结构完全一致。
 *    拼得乱七八糟、看不懂的，等于没拼。
 *    拼完之后不能出现乱码、不能出现缺字漏字、不能出现格式错乱导致内容无法辨认的情况。
 *    拼出来的内容必须是干净、完整、可正常阅读的。"
 *
 * 实现策略：
 *   1. 内容清洗：去广告/HTML 残留/乱码/编码问题
 *   2. 章节标题规范化：把"卷一"/"第一卷"/"卷1"统一成"卷一"等可比键
 *   3. 章节对齐：按规范化键聚合多源同一章节
 *   4. 同章内容择优：取最长且非乱码版本（多版本对照后保留信号最强的）
 *   5. 顺序重排：按数字解析的真实序号排序
 *   6. 完整性校验：相邻章节序号有缺口（如有"第三章"但无"第二章"）就标红
 *   7. 乱码 / 缺字检测：连续乱码/异常符号比例 > 阈值视为脏数据，剔除
 *   8. 输出清单 + 合并文本 + 验证报告
 */

import type { ChapterFragment, SourceResult, MultiSourceSearchResult } from './multi-source-searcher';

// ============ 中文数字 ↔ 阿拉伯数字 ============

const CN_NUM: Record<string, number> = {
  '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100, '千': 1000,
};

function cnNumToInt(s: string): number | null {
  // 简单版本：支持 "三"/"十"/"二十一"/"一百零八" 等
  if (!s) return null;
  let result = 0, current = 0;
  for (const ch of s) {
    const v = CN_NUM[ch];
    if (v === undefined) return null;
    if (v === 100 || v === 1000) {
      current = (current || 1) * v;
      result += current;
      current = 0;
    } else if (v === 10) {
      current = (current || 1) * 10;
      result += current;
      current = 0;
    } else {
      current = current * 10 + v;
    }
  }
  result += current;
  return result;
}

// ============ 章节标题规范化 ============

export interface ParsedChapter {
  unit: '卷' | '章' | '篇' | '回' | '册' | '部' | '集' | '节' | '卦' | '序' | '跋' | '未知';
  order: number;          // 排序序号；序=−2，跋=999999，未知=10000+i
  rawTitle: string;       // 原始标题
  normalized: string;     // 规范化后的对齐键（如"卷一"、"章三"）
}

export function parseChapterTitle(title: string, fallbackIndex: number): ParsedChapter {
  const t = (title || '').trim();
  // 序 / 自序 / 卷首
  if (/^(自?序|前\s*言|引\s*言|卷\s*首|绪\s*论|凡\s*例|目\s*录)/.test(t)) {
    return { unit: '序', order: -10, rawTitle: t, normalized: 'pre:' + t };
  }
  // 跋 / 后记 / 附录
  if (/^(跋|后\s*记|后\s*序|附\s*录|后\s*跋|结\s*语|总\s*结)/.test(t)) {
    return { unit: '跋', order: 999000 + fallbackIndex, rawTitle: t, normalized: 'post:' + t };
  }
  // 卷 / 章 / 篇 / 回 / 册 / 部 / 集 / 节 / 卦
  const patterns: Array<{ unit: ParsedChapter['unit']; regex: RegExp }> = [
    { unit: '卷', regex: /(?:^|\s)(?:第\s*)?卷?\s*([一二三四五六七八九十百千零〇\d]+)\s*卷/ },
    { unit: '章', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*章/ },
    { unit: '篇', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*篇/ },
    { unit: '回', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*回/ },
    { unit: '册', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*册/ },
    { unit: '部', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*部/ },
    { unit: '集', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*集/ },
    { unit: '节', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*节/ },
    { unit: '卦', regex: /第\s*([一二三四五六七八九十百千零〇\d]+)\s*卦/ },
    { unit: '卷', regex: /卷\s*([一二三四五六七八九十百千零〇\d]+)/ },
    { unit: '章', regex: /Chapter\s+(\d+|[IVXLCDM]+)/i },
  ];
  for (const { unit, regex } of patterns) {
    const m = t.match(regex);
    if (m) {
      const numStr = m[1];
      let n: number | null = null;
      if (/^\d+$/.test(numStr)) {
        n = parseInt(numStr, 10);
      } else if (/^[IVXLCDM]+$/i.test(numStr)) {
        // 罗马数字
        const roman: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let v = 0, prev = 0;
        for (const ch of numStr.toUpperCase()) {
          const x = roman[ch];
          v += x > prev ? x - 2 * prev : x;
          prev = x;
        }
        n = v;
      } else {
        n = cnNumToInt(numStr);
      }
      if (n !== null) {
        return { unit, order: n, rawTitle: t, normalized: `${unit}:${n}` };
      }
    }
  }
  // 卦名（八卦/六十四卦）—— 按出现顺序赋号
  const guaList = [
    '乾', '坤', '屯', '蒙', '需', '讼', '师', '比', '小畜', '履', '泰', '否',
    '同人', '大有', '谦', '豫', '随', '蛊', '临', '观', '噬嗑', '贲', '剥', '复',
    '无妄', '大畜', '颐', '大过', '坎', '离', '咸', '恒', '遁', '大壮', '晋', '明夷',
    '家人', '睽', '蹇', '解', '损', '益', '夬', '姤', '萃', '升', '困', '井',
    '革', '鼎', '震', '艮', '渐', '归妹', '丰', '旅', '巽', '兑', '涣', '节',
    '中孚', '小过', '既济', '未济',
  ];
  const guaIdx = guaList.findIndex(g => t.startsWith(g) || t.includes(g + '卦'));
  if (guaIdx >= 0) {
    return { unit: '卦', order: guaIdx + 1, rawTitle: t, normalized: `卦:${guaIdx + 1}` };
  }
  return { unit: '未知', order: 10000 + fallbackIndex, rawTitle: t, normalized: `unk:${fallbackIndex}` };
}

// ============ 内容清洗 ============

export interface CleaningReport {
  originalLength: number;
  cleanedLength: number;
  removedGarbageCount: number;
  garbageRatio: number;
  hasMojibake: boolean;
  isClean: boolean;
}

const ADVERT_KEYWORDS = [
  '广告', '点击', '订阅', '关注', '分享', '点赞', '收藏',
  '微信公众号', 'QQ群', '版权所有', '免责声明', '友情链接',
  '相关推荐', '热门推荐', '上一篇', '下一篇', '返回顶部',
  '在线阅读', '小说阅读', 'cookie', 'javascript', 'class=',
];

export function cleanContent(rawContent: string): { cleaned: string; report: CleaningReport } {
  if (!rawContent) {
    return { cleaned: '', report: { originalLength: 0, cleanedLength: 0, removedGarbageCount: 0, garbageRatio: 1, hasMojibake: false, isClean: false } };
  }
  const original = rawContent;
  let s = original;
  // 1. 去残留 HTML/CSS/JS
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\{[^{}]{20,}?\}/g, '');
  // 2. 去 URL
  s = s.replace(/https?:\/\/\S+/g, '');
  // 3. 行级广告关键词检测
  const lines = s.split(/\n+/);
  const cleanLines: string[] = [];
  let removedCount = 0;
  for (const line of lines) {
    const ll = line.trim();
    if (!ll) continue;
    if (ll.length > 800) {
      // 异常长行（通常是脚本残留），按句号切短
      cleanLines.push(...ll.split(/[。；]/).filter(x => x.trim().length > 5));
      continue;
    }
    if (ADVERT_KEYWORDS.some(kw => ll.includes(kw)) && ll.length < 80) {
      removedCount += 1;
      continue;
    }
    cleanLines.push(ll);
  }
  s = cleanLines.join('\n');
  // 4. 编码异常检测：连续问号 / 替换字符 / 控制符
  const mojibakeRatio = (s.match(/[\uFFFD\u0000-\u001F\u007F\?\?\?]/g) || []).length / Math.max(s.length, 1);
  const hasMojibake = mojibakeRatio > 0.05;
  // 5. 规范化空白
  s = s.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const cleanedLength = s.length;
  const garbageRatio = 1 - cleanedLength / Math.max(original.length, 1);
  const isClean = !hasMojibake && cleanedLength > 50;
  return {
    cleaned: s,
    report: {
      originalLength: original.length,
      cleanedLength,
      removedGarbageCount: removedCount,
      garbageRatio,
      hasMojibake,
      isClean,
    },
  };
}

// ============ 合并 / 去重 / 择优 ============

export interface MergedChapter {
  parsed: ParsedChapter;
  bestContent: string;
  bestSource: string;
  bestUrl?: string;
  alternativeSources: string[];
  charCount: number;
  cleaningReport: CleaningReport;
}

export interface MergeResult {
  bookName: string;
  totalChapters: number;
  chapters: MergedChapter[];
  mergedFullText: string;
  totalChars: number;
  sourcesUsed: string[];
  warnings: string[];
  integrityScore: number;       // 0-100
  isComplete: boolean;
  detectedGaps: string[];       // 章节缺口提示
}

export function mergeMultiSourceResult(multi: MultiSourceSearchResult): MergeResult {
  const { bookName, results } = multi;
  const warnings: string[] = [];
  // 收集所有源的所有 fragment
  const buckets = new Map<string, Array<{ frag: ChapterFragment; parsed: ParsedChapter; cleaned: string; report: CleaningReport; sourceName: string }>>();
  let runningIdx = 0;
  for (const result of results) {
    if (!result.found || result.fragments.length === 0) continue;
    for (const frag of result.fragments) {
      const parsed = parseChapterTitle(frag.title, runningIdx++);
      const { cleaned, report } = cleanContent(frag.content);
      if (!report.isClean) {
        warnings.push(`[${result.source}] 章节"${frag.title}"清洗后不达标（乱码=${report.hasMojibake}，长度=${report.cleanedLength}），跳过`);
        continue;
      }
      const bucket = buckets.get(parsed.normalized) || [];
      bucket.push({ frag, parsed, cleaned, report, sourceName: result.sourceName });
      buckets.set(parsed.normalized, bucket);
    }
  }
  // 每个桶择优（取最长 + 来源多）
  const chapters: MergedChapter[] = [];
  for (const [, candidates] of buckets) {
    // 按 cleaned 长度排序，取最长
    candidates.sort((a, b) => b.cleaned.length - a.cleaned.length);
    const winner = candidates[0];
    chapters.push({
      parsed: winner.parsed,
      bestContent: winner.cleaned,
      bestSource: winner.frag.source,
      bestUrl: winner.frag.url,
      alternativeSources: candidates.slice(1).map(c => c.frag.source),
      charCount: winner.cleaned.length,
      cleaningReport: winner.report,
    });
  }
  // 按 order 排序
  chapters.sort((a, b) => a.parsed.order - b.parsed.order);
  // 完整性检测：找数字单位的缺口
  const detectedGaps: string[] = [];
  const byUnit = new Map<string, MergedChapter[]>();
  for (const c of chapters) {
    if (c.parsed.unit === '未知' || c.parsed.unit === '序' || c.parsed.unit === '跋') continue;
    const k = c.parsed.unit;
    byUnit.set(k, [...(byUnit.get(k) || []), c]);
  }
  for (const [unit, cs] of byUnit) {
    cs.sort((a, b) => a.parsed.order - b.parsed.order);
    if (cs.length < 2) continue;
    const min = cs[0].parsed.order, max = cs[cs.length - 1].parsed.order;
    const have = new Set(cs.map(c => c.parsed.order));
    for (let n = min; n <= max; n++) {
      if (!have.has(n)) detectedGaps.push(`${unit}${n}`);
    }
  }
  // 完整性分数：找到的源数 + 章节连续性
  const sourcesUsed = Array.from(new Set(chapters.map(c => c.bestSource)));
  const continuityScore = byUnit.size === 0 ? 100 : (() => {
    let total = 0, missing = 0;
    for (const cs of byUnit.values()) {
      const min = cs[0].parsed.order, max = cs[cs.length - 1].parsed.order;
      const span = max - min + 1;
      total += span;
      missing += span - cs.length;
    }
    return total === 0 ? 100 : Math.max(0, Math.round((1 - missing / total) * 100));
  })();
  const integrityScore = Math.round(
    continuityScore * 0.7 +
    Math.min(sourcesUsed.length, 5) * 6, // 多源最多 +30
  );
  const isComplete = detectedGaps.length === 0 && chapters.length > 0 && integrityScore >= 80;
  // 输出合并全文
  const mergedFullText = chapters
    .map(c => `${'='.repeat(50)}\n【${c.parsed.rawTitle}】（来源：${c.bestSource}${c.alternativeSources.length ? `；候选：${c.alternativeSources.join(',')}` : ''}）\n${'='.repeat(50)}\n\n${c.bestContent}\n`)
    .join('\n');
  return {
    bookName,
    totalChapters: chapters.length,
    chapters,
    mergedFullText,
    totalChars: mergedFullText.length,
    sourcesUsed,
    warnings,
    integrityScore,
    isComplete,
    detectedGaps,
  };
}
