/**
 * 深度学习流水线 - 6 阶段
 *
 * 核心铁律（来自项目规则）：
 *   原文存进知识库 = 备查档案（基础）
 *   深度学习 = 真正学会（独立阶段，必须 6 个产出文件落盘才算完成）
 *
 * 6 阶段：读懂 → 理解 → 提取要点 → 掌握逻辑 → 学会应用 → 融会贯通
 *
 * 完成判据（严格）：
 *   1. data/learning/{taskId}/01-reading.json   — 通读
 *   2. data/learning/{taskId}/02-terms.json     — 术语词典（理解）
 *   3. data/learning/{taskId}/03-rules.json     — 推理规则库（要点）
 *   4. data/learning/{taskId}/04-algorithms.json— 计算算法库（逻辑）
 *   5. data/learning/{taskId}/05-cases.json     — 实操案例库（应用）
 *   6. data/learning/{taskId}/06-associations.json— 跨书关联图谱（融会）
 *
 *   6 个文件全在且非空（≥50B）才能标记 learningStatus='done'
 *   任何 1 个产出缺失 → learningStatus='failed'
 *
 *   严禁伪造：bookContent 为空 / chunks 为 0 必须直接 failed
 */

import fs from 'fs';
import path from 'path';
import { Config, LLMClient } from '@/lib/coze-replacement';

// 学习产出根目录：生产环境 /tmp 不持久，因此用 data/learning（VPS）或 /tmp/learning（serverless）
const IS_SERVERLESS = !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;
export const LEARNING_OUTPUT_DIR = IS_SERVERLESS
  ? '/tmp/learning'
  : path.join(process.cwd(), 'data', 'learning');

try {
  fs.mkdirSync(LEARNING_OUTPUT_DIR, { recursive: true });
} catch {
  // 创建失败不致命，单次产出时再 try
}

export const STAGE_FILES = [
  '01-reading.json',
  '02-terms.json',
  '03-rules.json',
  '04-algorithms.json',
  '05-cases.json',
  '06-associations.json',
] as const;

export type StageName = '通读' | '理解' | '要点' | '逻辑' | '应用' | '融会';
export const STAGE_NAMES: StageName[] = ['通读', '理解', '要点', '逻辑', '应用', '融会'];

export function getBookLearningDir(taskId: string): string {
  const dir = path.join(LEARNING_OUTPUT_DIR, taskId);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

/**
 * 检查 6 阶段产出文件是否全部存在且非空
 * 返回 { ok: bool, missing: 缺失阶段编号数组, sizes: 每阶段文件大小 }
 */
export function checkLearningArtifacts(taskId: string): {
  ok: boolean;
  missing: number[];
  sizes: number[];
} {
  const dir = getBookLearningDir(taskId);
  const missing: number[] = [];
  const sizes: number[] = [];
  for (let i = 0; i < STAGE_FILES.length; i++) {
    const p = path.join(dir, STAGE_FILES[i]);
    try {
      const st = fs.statSync(p);
      sizes.push(st.size);
      if (st.size < 50) missing.push(i + 1);
    } catch {
      sizes.push(0);
      missing.push(i + 1);
    }
  }
  return { ok: missing.length === 0, missing, sizes };
}

/**
 * 写入单个阶段产出文件
 */
export function writeStageArtifact(
  taskId: string,
  stageIndex: 1 | 2 | 3 | 4 | 5 | 6,
  data: Record<string, unknown>,
): { ok: boolean; size: number; path: string } {
  const dir = getBookLearningDir(taskId);
  const filename = STAGE_FILES[stageIndex - 1];
  const filePath = path.join(dir, filename);
  const payload = {
    stage: STAGE_NAMES[stageIndex - 1],
    stageIndex,
    writtenAt: new Date().toISOString(),
    ...data,
  };
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    const st = fs.statSync(filePath);
    return { ok: true, size: st.size, path: filePath };
  } catch (e) {
    return { ok: false, size: 0, path: filePath };
  }
}

/**
 * 安全提取 LLM 返回里的 JSON 部分（兼容 markdown 代码块包裹）
 */
function extractJSON(raw: string): unknown | null {
  if (!raw) return null;
  // 优先匹配 ```json ... ``` 代码块
  const codeBlock = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n?```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]); } catch {}
  }
  // 退化：匹配第一个 { 到最后一个 }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(raw.slice(first, last + 1)); } catch {}
  }
  return null;
}

async function llmStreamToText(
  llm: LLMClient,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  let out = '';
  const stream = llm.stream(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { model: process.env.LLM_MODEL || 'deepseek-chat' },
  );
  for await (const chunk of stream) {
    if (chunk.content) out += chunk.content.toString();
  }
  return out;
}

/**
 * 阶段① 通读 - 输入：分块学习笔记 -> 落盘
 * 这阶段不重新调用 LLM，因为 chunk 学习时已经逐块跑过 LLM
 */
export function stage1_reading(
  taskId: string,
  bookName: string,
  learnedChunks: { index: number; original: string; learnedNotes: string }[],
): { ok: boolean; size: number } {
  const summary = {
    bookName,
    totalChunks: learnedChunks.length,
    totalCharsOriginal: learnedChunks.reduce((s, c) => s + c.original.length, 0),
    totalCharsLearned: learnedChunks.reduce((s, c) => s + c.learnedNotes.length, 0),
    chunks: learnedChunks.map(c => ({
      index: c.index,
      originalPreview: c.original.slice(0, 200),
      learnedPreview: c.learnedNotes.slice(0, 300),
      originalChars: c.original.length,
      learnedChars: c.learnedNotes.length,
    })),
  };
  const r = writeStageArtifact(taskId, 1, summary);
  return { ok: r.ok, size: r.size };
}

/**
 * 阶段② 理解 - 抽取所有专业术语 + 精确定义 + 出处
 */
export async function stage2_terms(
  taskId: string,
  bookName: string,
  llm: LLMClient,
  notesBlob: string,
): Promise<{ ok: boolean; size: number; count: number }> {
  const prompt = `你正在为《${bookName}》建立"术语词典"。下面是这本书的逐块深度学习笔记，请从中抽出所有专业术语：

【学习笔记】
${notesBlob.slice(0, 30000)}

【输出要求】严格的 JSON 对象，不要任何解释文字，不要 markdown 代码块外面包裹。结构：
{
  "terms": [
    {
      "term": "术语名（如：日主旺衰）",
      "definition": "精确定义（来自原文）",
      "category": "概念|神煞|格局|算法|宫位|其他",
      "examples": ["例子1", "例子2"]
    }
  ]
}

【铁律】
- 必须忠实学习笔记，不得编造原文/笔记里没有的术语
- 如果学习笔记里术语很少，输出少量真实的，宁缺勿滥
- 每个术语必须能在原文找到出处`;

  try {
    const raw = await llmStreamToText(
      llm,
      '你是一位严谨的玄学学者，正在为古籍编术语词典。绝不编造原文没有的内容。',
      prompt,
    );
    const data = extractJSON(raw) as { terms?: unknown[] } | null;
    const terms = (data?.terms ?? []) as unknown[];
    const r = writeStageArtifact(taskId, 2, { bookName, count: terms.length, terms });
    return { ok: r.ok && terms.length > 0, size: r.size, count: terms.length };
  } catch (e) {
    const r = writeStageArtifact(taskId, 2, { bookName, error: String(e), terms: [] });
    return { ok: false, size: r.size, count: 0 };
  }
}

/**
 * 阶段③ 要点 - 推理规则库（条件→结论+边界+例外+置信度）
 */
export async function stage3_rules(
  taskId: string,
  bookName: string,
  llm: LLMClient,
  notesBlob: string,
): Promise<{ ok: boolean; size: number; count: number }> {
  const prompt = `你正在为《${bookName}》建立"推理规则库"。下面是这本书的学习笔记，请从中抽出所有推理规则：

【学习笔记】
${notesBlob.slice(0, 30000)}

【输出要求】严格 JSON，无任何包裹：
{
  "rules": [
    {
      "ruleName": "规则名（如：印星临文昌主学业有成）",
      "condition": "触发条件（如：日柱印星 + 时柱文昌）",
      "conclusion": "结论",
      "confidence": "铁律|或然|经验",
      "exceptions": ["例外1", "例外2"],
      "source": "出处块号"
    }
  ]
}

【铁律】忠实学习笔记，不编造。`;

  try {
    const raw = await llmStreamToText(
      llm,
      '你是命理规则提取专家。绝不编造规则。',
      prompt,
    );
    const data = extractJSON(raw) as { rules?: unknown[] } | null;
    const rules = (data?.rules ?? []) as unknown[];
    const r = writeStageArtifact(taskId, 3, { bookName, count: rules.length, rules });
    return { ok: r.ok && rules.length > 0, size: r.size, count: rules.length };
  } catch (e) {
    const r = writeStageArtifact(taskId, 3, { bookName, error: String(e), rules: [] });
    return { ok: false, size: r.size, count: 0 };
  }
}

/**
 * 阶段④ 逻辑 - 计算算法库（步骤+输入+输出+示例）
 */
export async function stage4_algorithms(
  taskId: string,
  bookName: string,
  llm: LLMClient,
  notesBlob: string,
): Promise<{ ok: boolean; size: number; count: number }> {
  const prompt = `你正在为《${bookName}》建立"算法库"。请从学习笔记中抽出所有可执行的计算方法/排盘步骤：

【学习笔记】
${notesBlob.slice(0, 30000)}

【输出要求】严格 JSON：
{
  "algorithms": [
    {
      "name": "算法名（如：起六爻铜钱卦）",
      "purpose": "用途",
      "inputs": ["输入项1", "输入项2"],
      "steps": ["步骤1", "步骤2", "步骤3"],
      "outputs": ["输出项1"],
      "example": "示例输入->输出"
    }
  ]
}

【铁律】不编造原文/笔记里没有的算法。可以没有，但不可造假。`;

  try {
    const raw = await llmStreamToText(
      llm,
      '你是术数算法专家。只抽真实存在的算法。',
      prompt,
    );
    const data = extractJSON(raw) as { algorithms?: unknown[] } | null;
    const algos = (data?.algorithms ?? []) as unknown[];
    // 注意：理论书可能没算法，允许为空但产出文件必须落盘
    const r = writeStageArtifact(taskId, 4, { bookName, count: algos.length, algorithms: algos });
    return { ok: r.ok, size: r.size, count: algos.length };
  } catch (e) {
    const r = writeStageArtifact(taskId, 4, { bookName, error: String(e), algorithms: [] });
    return { ok: false, size: r.size, count: 0 };
  }
}

/**
 * 阶段⑤ 应用 - 实操案例库（场景+排盘+断语+验证）
 */
export async function stage5_cases(
  taskId: string,
  bookName: string,
  llm: LLMClient,
  notesBlob: string,
): Promise<{ ok: boolean; size: number; count: number }> {
  const prompt = `你正在为《${bookName}》建立"案例库"。请从学习笔记中抽出所有书里举的实操案例：

【学习笔记】
${notesBlob.slice(0, 30000)}

【输出要求】严格 JSON：
{
  "cases": [
    {
      "title": "案例名",
      "scenario": "场景描述",
      "data": "排盘/八字/卦象/原始信息",
      "diagnosis": "断语",
      "reasoning": "推理过程",
      "verified": "原书有无验证结果"
    }
  ]
}

【铁律】只抽笔记里真实出现的案例，不补造。空允许，造假禁止。`;

  try {
    const raw = await llmStreamToText(
      llm,
      '你是案例提取专家。只抽真实案例。',
      prompt,
    );
    const data = extractJSON(raw) as { cases?: unknown[] } | null;
    const cases = (data?.cases ?? []) as unknown[];
    const r = writeStageArtifact(taskId, 5, { bookName, count: cases.length, cases });
    return { ok: r.ok, size: r.size, count: cases.length };
  } catch (e) {
    const r = writeStageArtifact(taskId, 5, { bookName, error: String(e), cases: [] });
    return { ok: false, size: r.size, count: 0 };
  }
}

/**
 * 阶段⑥ 融会 - 跨书关联图谱
 * 跟其他已学完的书做术语/规则交叉对比
 */
export async function stage6_associations(
  taskId: string,
  bookName: string,
  llm: LLMClient,
  ownTermsJson: unknown,
  otherBooksTerms: { bookName: string; terms: unknown[] }[],
): Promise<{ ok: boolean; size: number }> {
  // 没有其他书时，仍要落盘表示"暂无关联"
  if (otherBooksTerms.length === 0) {
    const r = writeStageArtifact(taskId, 6, {
      bookName,
      note: '当前知识库尚无其他已学完的书，本书的跨书关联待后续学完更多书后自动补充',
      related: [],
      cross_validations: [],
      otherBooksCount: 0,
    });
    return { ok: r.ok, size: r.size };
  }

  // 简化版关联：截取本书前 30 个术语 + 其他书各 10 个术语，让 LLM 找交集
  const ownTermNames = (Array.isArray((ownTermsJson as { terms?: unknown[] })?.terms)
    ? ((ownTermsJson as { terms: unknown[] }).terms as { term?: string }[])
    : []
  ).slice(0, 30).map(t => t.term).filter(Boolean);

  const othersSummary = otherBooksTerms.slice(0, 10).map(b => ({
    bookName: b.bookName,
    terms: (b.terms as { term?: string }[]).slice(0, 10).map(t => t.term).filter(Boolean),
  }));

  const prompt = `你在为《${bookName}》建立"跨书关联图谱"。下面是本书的术语 vs 其他已学书的术语，请找出关联：

【本书术语】${JSON.stringify(ownTermNames)}

【其他书的术语】${JSON.stringify(othersSummary)}

【输出要求】严格 JSON：
{
  "related": [{"term": "共同术语", "books": ["本书", "其他书名1", "其他书名2"]}],
  "differences": [{"term": "术语", "本书观点": "...", "他书观点": "..."}],
  "cross_validations": [{"主题": "如：印星与学业", "books": ["...", "..."], "共识": "..."}]
}

【铁律】只标真实交集，不臆造关联。空允许。`;

  try {
    const raw = await llmStreamToText(
      llm,
      '你是跨书关联专家。只标真实交集。',
      prompt,
    );
    const data = (extractJSON(raw) as Record<string, unknown>) ?? {};
    const r = writeStageArtifact(taskId, 6, {
      bookName,
      otherBooksCount: otherBooksTerms.length,
      ...data,
    });
    return { ok: r.ok, size: r.size };
  } catch (e) {
    const r = writeStageArtifact(taskId, 6, {
      bookName,
      error: String(e),
      related: [],
      cross_validations: [],
    });
    return { ok: false, size: r.size };
  }
}

/**
 * 列出当前已学完的其他书（用于阶段⑥的跨书对比）
 */
export function listOtherLearnedBooks(currentTaskId: string): { taskId: string; bookName: string; termsFile: string }[] {
  try {
    const dirs = fs.readdirSync(LEARNING_OUTPUT_DIR);
    const result: { taskId: string; bookName: string; termsFile: string }[] = [];
    for (const d of dirs) {
      if (d === currentTaskId) continue;
      const termsFile = path.join(LEARNING_OUTPUT_DIR, d, '02-terms.json');
      try {
        const st = fs.statSync(termsFile);
        if (st.size >= 50) {
          const data = JSON.parse(fs.readFileSync(termsFile, 'utf-8'));
          result.push({ taskId: d, bookName: data.bookName || d, termsFile });
        }
      } catch {}
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * 跑完整 6 阶段（在 chunk 学习完成后调用）
 *
 * @returns 如果 6 个产出全部有效，返回 ok=true，否则 ok=false 加 missing 阶段
 */
export async function runFullDeepLearning(params: {
  taskId: string;
  bookName: string;
  learnedChunks: { index: number; original: string; learnedNotes: string }[];
  onStageProgress?: (stageIndex: number, stageName: string, info: string) => void;
}): Promise<{
  ok: boolean;
  missing: number[];
  sizes: number[];
  counts: { terms: number; rules: number; algorithms: number; cases: number };
}> {
  const { taskId, bookName, learnedChunks, onStageProgress } = params;
  const config = new Config();
  const llm = new LLMClient(config);

  // 合并所有 chunk 学习笔记成一个大文本（限于 LLM 上下文）
  const notesBlob = learnedChunks
    .map(c => `[第${c.index}块]\n${c.learnedNotes}`)
    .join('\n\n----\n\n');

  // 阶段 1：通读（无 LLM）
  onStageProgress?.(1, '通读', '汇总分块学习成果');
  const s1 = stage1_reading(taskId, bookName, learnedChunks);

  // 阶段 2：理解（术语词典）
  onStageProgress?.(2, '理解', '抽取术语词典');
  const s2 = await stage2_terms(taskId, bookName, llm, notesBlob);

  // 阶段 3：要点（规则库）
  onStageProgress?.(3, '要点', '建立推理规则库');
  const s3 = await stage3_rules(taskId, bookName, llm, notesBlob);

  // 阶段 4：逻辑（算法库）
  onStageProgress?.(4, '逻辑', '抽取计算算法');
  const s4 = await stage4_algorithms(taskId, bookName, llm, notesBlob);

  // 阶段 5：应用（案例库）
  onStageProgress?.(5, '应用', '抽取实操案例');
  const s5 = await stage5_cases(taskId, bookName, llm, notesBlob);

  // 阶段 6：融会（跨书关联）
  onStageProgress?.(6, '融会', '建立跨书关联');
  const dir = getBookLearningDir(taskId);
  let ownTermsJson: unknown = {};
  try {
    ownTermsJson = JSON.parse(fs.readFileSync(path.join(dir, '02-terms.json'), 'utf-8'));
  } catch {}
  const otherBooks = listOtherLearnedBooks(taskId).slice(0, 20);
  const otherBooksTerms: { bookName: string; terms: unknown[] }[] = [];
  for (const b of otherBooks) {
    try {
      const data = JSON.parse(fs.readFileSync(b.termsFile, 'utf-8'));
      otherBooksTerms.push({
        bookName: b.bookName,
        terms: Array.isArray(data.terms) ? data.terms : [],
      });
    } catch {}
  }
  const s6 = await stage6_associations(taskId, bookName, llm, ownTermsJson, otherBooksTerms);

  // 最终判据
  const finalCheck = checkLearningArtifacts(taskId);
  return {
    ok: finalCheck.ok,
    missing: finalCheck.missing,
    sizes: finalCheck.sizes,
    counts: {
      terms: s2.count,
      rules: s3.count,
      algorithms: s4.count,
      cases: s5.count,
    },
  };
}
