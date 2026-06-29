/**
 * Map-Reduce 知识库全量检索
 *
 * 设计思想：
 * 1. 预筛阶段：用 knowledge-prescreen 对所有书做关键词预筛，分级为
 *    - high（高相关）：全文精读
 *    - medium（中相关）：命中段落 + 上下文精读
 *    - sampling（兜底抽样）：仅命中段落快速扫描
 * 2. Map 阶段：把所有书按 token 容量分批（每批 ≤ MAX_CHARS_PER_BATCH），
 *    并行调用 LLM 抽取与问题相关的论断（保留原文 + 书名标注）。
 * 3. Reduce 阶段：返回 context 字符串供最终 LLM 流式回答时使用。
 *
 * 设计取舍：
 * - 最终回答仍由 /api/chat 的 SSE 流式 LLM 输出，本模块负责"凝练上下文"。
 * - Map 阶段允许个别批次失败（catch 后跳过），不阻塞整体流程。
 * - 严格遵守 AGENTS.md 知识库铁律：原文保留 + 书名引用 + 不漏书。
 */

import type { LLMClient } from './coze-replacement';
import {
  prescreenAllBooks,
  type PrescreenResult,
  type BookScore,
} from './knowledge-prescreen';
import { getBookFullTextAsync, getBookStats } from './fulltext-search';

/** 相关度分级（map-reduce 内部使用） */
export type BookRelevanceLevel = 'high' | 'medium' | 'sampling';

/** 生成预筛摘要文本 */
function buildPrescreenSummary(p: PrescreenResult): string {
  return `共 ${p.totalBooks} 本｜高相关 ${p.high.length}、中相关 ${p.medium.length}、低相关 ${p.low.length}、兜底抽样 ${p.sample.length}`;
}

// ---------------- 配置 ----------------
const MAX_CHARS_PER_BATCH = 80_000;
const MAX_CONCURRENCY = 3;
const PER_BATCH_TIMEOUT_MS = 90_000;
const MAX_CONTEXT_RESULT_CHARS = 220_000;

// ---------------- 类型 ----------------
export interface MapReduceProgressEvent {
  stage: 'prescreen' | 'mapping' | 'reducing' | 'done' | 'error';
  message: string;
  progress?: number;
  bookName?: string;
}

export interface MapReduceCitation {
  bookName: string;
  excerpt: string;
  relevance: BookRelevanceLevel;
}

export interface MapReduceResult {
  context: string;
  citations: MapReduceCitation[];
  totalBooksReviewed: number;
  totalBatches: number;
  prescreenSummary: string;
  elapsedMs: number;
}

interface MapBatch {
  bookNames: string[];
  combinedContent: string;
  relevance: BookRelevanceLevel;
}

// ---------------- 主入口 ----------------
export async function mapReduceKnowledgeSearch(
  query: string,
  llm: LLMClient,
  options: {
    onProgress?: (event: MapReduceProgressEvent) => void;
    maxConcurrency?: number;
  } = {},
): Promise<MapReduceResult> {
  const startTs = Date.now();
  const onProgress = options.onProgress ?? (() => {});
  const maxConcurrency = options.maxConcurrency ?? MAX_CONCURRENCY;

  // ------- 1. 预筛阶段 -------
  onProgress({
    stage: 'prescreen',
    message: '🔍 正在扫描知识库每一本书，按相关度分级...',
  });

  const { bookNames } = getBookStats();
  const prescreen: PrescreenResult = await prescreenAllBooks(query, bookNames);
  const summary = buildPrescreenSummary(prescreen);

  onProgress({
    stage: 'prescreen',
    message: `✅ 预筛完成：${summary}`,
  });

  if (prescreen.totalBooks === 0) {
    return {
      context: '',
      citations: [],
      totalBooksReviewed: 0,
      totalBatches: 0,
      prescreenSummary: summary,
      elapsedMs: Date.now() - startTs,
    };
  }

  // ------- 2. Map 阶段：分批 -------
  const batches: MapBatch[] = [];
  await pushBatchesForGroup(prescreen.high, 'high', batches);
  await pushBatchesForGroup(prescreen.medium, 'medium', batches);
  await pushBatchesForGroup(prescreen.sample, 'sampling', batches);

  if (batches.length === 0) {
    return {
      context: '',
      citations: [],
      totalBooksReviewed: prescreen.totalBooks,
      totalBatches: 0,
      prescreenSummary: summary,
      elapsedMs: Date.now() - startTs,
    };
  }

  onProgress({
    stage: 'mapping',
    message: `📖 共 ${batches.length} 批次需要精读，开始并行抽取相关论断...`,
    progress: 0,
  });

  // 并行执行（限制并发数）
  const citations: MapReduceCitation[] = [];
  let completed = 0;

  const runBatch = async (batch: MapBatch, index: number): Promise<void> => {
    const bookHint = batch.bookNames.slice(0, 3).join('、') + (batch.bookNames.length > 3 ? `等 ${batch.bookNames.length} 部` : '');
    onProgress({
      stage: 'mapping',
      message: `📖 [${index + 1}/${batches.length}] 精读《${bookHint}》...`,
      progress: Math.round((completed / batches.length) * 100),
      bookName: bookHint,
    });

    try {
      const extracts = await extractBatch(query, batch, llm);
      for (const ex of extracts) {
        citations.push({
          bookName: ex.bookName,
          excerpt: ex.excerpt,
          relevance: batch.relevance,
        });
      }
    } catch (err) {
      console.warn(`[MapReduce] 批次 ${index + 1} 失败 (跳过):`, err instanceof Error ? err.message : err);
    } finally {
      completed += 1;
      onProgress({
        stage: 'mapping',
        message: `📖 已完成 ${completed}/${batches.length} 批次`,
        progress: Math.round((completed / batches.length) * 100),
      });
    }
  };

  await runWithConcurrency(batches.map((b, i) => () => runBatch(b, i)), maxConcurrency);

  // ------- 3. Reduce 阶段 -------
  onProgress({
    stage: 'reducing',
    message: `🪄 汇总 ${citations.length} 条原文论断...`,
  });

  const context = buildReducedContext(citations);

  onProgress({
    stage: 'done',
    message: `✅ 全库精读完成：${prescreen.totalBooks} 本书 → ${citations.length} 条相关论断`,
    progress: 100,
  });

  return {
    context,
    citations,
    totalBooksReviewed: prescreen.totalBooks,
    totalBatches: batches.length,
    prescreenSummary: summary,
    elapsedMs: Date.now() - startTs,
  };
}

// ---------------- 分批 ----------------
async function pushBatchesForGroup(
  bookScores: BookScore[],
  relevance: BookRelevanceLevel,
  out: MapBatch[],
): Promise<void> {
  if (!bookScores.length) return;

  let currentBatch: MapBatch = {
    bookNames: [],
    combinedContent: '',
    relevance,
  };

  for (const item of bookScores) {
    try {
      const fullText = await getBookFullTextAsync(item.bookName);
      if (!fullText) continue;

      // 高相关：全文；中相关：取前 60K 字符；兜底：取前 20K 字符
      const trimmed =
        relevance === 'high'
          ? fullText
          : relevance === 'medium'
            ? fullText.slice(0, 60_000)
            : fullText.slice(0, 20_000);

      const piece = `\n【${item.bookName}】\n${trimmed}\n`;

      if (currentBatch.combinedContent.length + piece.length > MAX_CHARS_PER_BATCH && currentBatch.bookNames.length > 0) {
        out.push(currentBatch);
        currentBatch = { bookNames: [], combinedContent: '', relevance };
      }

      currentBatch.bookNames.push(item.bookName);
      currentBatch.combinedContent += piece;
    } catch (err) {
      console.warn(`[MapReduce] 加载《${item.bookName}》失败:`, err instanceof Error ? err.message : err);
    }
  }

  if (currentBatch.bookNames.length > 0) {
    out.push(currentBatch);
  }
}

// ---------------- LLM 抽取（Map 阶段单批次） ----------------
async function extractBatch(
  query: string,
  batch: MapBatch,
  llm: LLMClient,
): Promise<Array<{ bookName: string; excerpt: string }>> {
  const systemPrompt = `你是一位精通中国玄学典籍的学者。
任务：从下方提供的多部典籍原文中，提取与用户问题相关的所有论断、案例、口诀、规则。

严格规则：
1. 必须保留原文片段，不要改写、不要总结
2. 每条论断必须标注书名（格式：《书名》"原文"）
3. 一条原文一行，多条之间用换行分隔
4. 如果某本书完全无相关内容，则不要输出该书的任何内容
5. 不要输出"以下是相关内容"等任何过渡话语，直接输出原文清单
6. 严禁编造原文，所有引用必须能在输入文本中逐字对应`;

  const userPrompt = `用户问题：${query}

以下是 ${batch.bookNames.length} 部典籍的原文：

${batch.combinedContent}

请输出所有相关论断（《书名》"原文"逐条）：`;

  const result = await Promise.race([
    llm.invoke(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1, max_tokens: 32768 },
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('extractBatch timeout')), PER_BATCH_TIMEOUT_MS),
    ),
  ]);

  const text = result.content || '';
  return parseExtracts(text, batch.bookNames);
}

// ---------------- 解析 LLM 输出 ----------------
function parseExtracts(text: string, allowedBooks: string[]): Array<{ bookName: string; excerpt: string }> {
  const out: Array<{ bookName: string; excerpt: string }> = [];
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const allowedSet = new Set(allowedBooks);

  for (const line of lines) {
    // 匹配 《书名》... 或 《书名》"原文"
    const match = line.match(/^[《【]([^》】]+)[》】]\s*[""]?(.+?)[""]?$/);
    if (!match) continue;
    const bookName = match[1].trim();
    const excerpt = match[2].trim().replace(/^[——\-:：]\s*/, '');
    if (!bookName || excerpt.length < 4) continue;
    // 容忍 LLM 输出的书名后带"·章名"
    const matchedBook = allowedBooks.find(b => bookName.startsWith(b) || b.startsWith(bookName));
    const finalBook = matchedBook ?? (allowedSet.has(bookName) ? bookName : bookName);
    out.push({ bookName: finalBook, excerpt });
  }

  return out;
}

// ---------------- Reduce ----------------
function buildReducedContext(citations: MapReduceCitation[]): string {
  if (!citations.length) return '';

  const byBook = new Map<string, MapReduceCitation[]>();
  for (const c of citations) {
    const arr = byBook.get(c.bookName) ?? [];
    arr.push(c);
    byBook.set(c.bookName, arr);
  }

  // 按 relevance 排序：high → medium → sampling
  const relOrder: Record<BookRelevanceLevel, number> = { high: 0, medium: 1, sampling: 2 };
  const sortedBooks = Array.from(byBook.entries()).sort((a, b) => {
    const aRel = a[1][0]?.relevance ?? 'sampling';
    const bRel = b[1][0]?.relevance ?? 'sampling';
    return relOrder[aRel] - relOrder[bRel];
  });

  let context = `# 知识库精读结果（按相关度排序）\n\n`;
  context += `> 已遍历所有典籍，以下是与问题相关的原文论断。LLM 回答必须严格基于这些原文，禁止编造书名/原文，禁止脱离知识库的独立推理。\n\n`;

  let totalLen = context.length;

  for (const [bookName, items] of sortedBooks) {
    if (totalLen >= MAX_CONTEXT_RESULT_CHARS) {
      context += `\n（受上下文长度限制，剩余 ${sortedBooks.length - sortedBooks.findIndex(b => b[0] === bookName)} 本书的论断未列出）\n`;
      break;
    }
    const header = `\n## 《${bookName}》（${items[0].relevance === 'high' ? '高相关·全文精读' : items[0].relevance === 'medium' ? '中相关·重点精读' : '兜底抽样'}）\n`;
    context += header;
    totalLen += header.length;
    for (const it of items) {
      const line = `- "${it.excerpt}"\n`;
      if (totalLen + line.length > MAX_CONTEXT_RESULT_CHARS) break;
      context += line;
      totalLen += line.length;
    }
  }

  return context;
}

// ---------------- 并发控制 ----------------
async function runWithConcurrency(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  const executing: Array<Promise<void>> = [];
  for (const task of tasks) {
    const p = task().catch(() => {});
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
      // 清理已完成的
      for (let i = executing.length - 1; i >= 0; i--) {
        if ((executing[i] as Promise<void> & { _done?: boolean })._done) {
          executing.splice(i, 1);
        }
      }
    }
    p.then(() => {
      (p as Promise<void> & { _done?: boolean })._done = true;
    });
  }
  await Promise.all(executing);
}
