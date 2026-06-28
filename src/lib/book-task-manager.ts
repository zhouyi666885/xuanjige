/**
 * 书籍录入后台任务管理器
 * 
 * 核心特性：
 * - 任务持久化到文件，服务器重启不丢失
 * - 后台自动运行，不依赖HTTP连接
 * - 自动恢复未完成任务
 * - 进度实时更新，随时可查
 */

import fs from 'fs';
import path from 'path';
import { Config, LLMClient, SearchClient, FetchClient, FetchContentItem, KnowledgeClient } from '@/lib/coze-replacement';
import { DATA_SOURCES } from '@/lib/coze-replacement/known-book-sources';
// eslint-disable-next-line import/no-cycle
import { isBookExists, addBookToKnowledgeBase, findBooksByName, getLocalBookInfo } from './fulltext-search';
import { saveBook } from './book-storage';
import { upsertTask as repoUpsertTask, listTasks as repoListTasks, deleteTask as repoDeleteTask, listTombstones as repoListTombstones, addTombstone as repoAddTombstone, getTaskByBookName as repoGetTaskByName, type BookTaskRow } from './book-repo';
import { runFullDeepLearning, checkLearningArtifacts } from './deep-learning-pipeline';

// ==================== 类型定义 ====================

interface BookChapter {
  name: string;       // 原书格式名称，如"第一卷 第一章"、"第三篇"、"第十二章"
  type: string;       // 结构类型：卷/篇/章/节/回/部/辑/部分
  startIndex: number; // 在原文中的起始位置
}

interface BookTask {
  id: string;
  bookName: string;
  status: 'pending' | 'searching' | 'downloading' | 'translating' | 'saving' | 'done' | 'failed' | 'copyright' | 'exists' | 'cleared' | 'paused';
  progress: number; // 0-100 录入进度
  currentChapter: number;
  totalChapters: number;
  currentChapterName: string;
  remainingChapters: number;
  message: string;
  source: string;
  size: string;
  chars: number;
  chapters: BookChapter[]; // 原书章节结构
  chapterStructure: string; // 原书编排方式描述，如"卷+章"、"篇"、"章"
  // 学习进度
  learningStatus: 'pending' | 'learning' | 'done' | 'failed'; // AI学习状态
  learningProgress: number; // 0-100 学习进度
  learningCurrentChunk: number; // 当前学习的分块
  learningTotalChunks: number; // 总分块数
  learningMessage: string; // 学习状态消息
  learningLayersDone: number[]; // 已完成的学习层次 [1,2,3,4]
  hasMissingChapters: boolean; // 是否缺章节
  missingChapterNames: string[]; // 缺失的章节名列表（如 ['第十五章','第二十章']）
  learningCurrentChapter: number; // 学习时进行到第几章/卦/卷
  learningCurrentChapterName: string; // 学习时当前章节名
  isLocalBook?: boolean; // 是否为系统内置本地书籍
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string;
  logs: string[];
}

// ==================== 原书章节结构解析 ====================

/**
 * 从书籍内容中智能解析原书的章节结构
 * 识别：卷/篇/章/节/回/部/辑 等原书编排方式
 */
function parseBookChapters(content: string): BookChapter[] {
  const chapters: BookChapter[] = [];
  const lines = content.split('\n');

  // 匹配原书各种章节格式
  const chapterPatterns = [
    // 卷+章格式：第一卷 第一章、卷一 第一章、卷一·第一章
    { regex: /^[\s]*第[一二三四五六七八九十百千万零\d]+卷[\s]*[·\s]*第[一二三四五六七八九十百千万零\d]+章/, type: '卷/章' },
    // 纯卷格式：第一卷、卷一、卷上、卷下、卷之上、卷之中、卷之下
    { regex: /^[\s]*第?[一二三四五六七八九十百千万零\d]+卷/, type: '卷' },
    // 卦格式：第一卦、乾卦、坤卦、屯卦等六十四卦
    { regex: /^[\s]*第[一二三四五六七八九十百千万零\d]+卦|^[\s]*(乾|坤|屯|蒙|需|讼|师|比|小畜|履|泰|否|同人|大有|谦|豫|随|蛊|临|观|噬嗑|贲|剥|复|无妄|大畜|颐|大过|坎|离|咸|恒|遯|大壮|晋|明夷|家人|睽|蹇|解|损|益|夬|姤|萃|升|困|井|革|鼎|震|艮|渐|归妹|丰|旅|巽|兑|涣|节|中孚|小过|既济|未济)卦/, type: '卦' },
    // 纯章格式：第一章、章一、章一·标题
    { regex: /^[\s]*第[一二三四五六七八九十百千万零\d]+章/, type: '章' },
    // 篇格式：第一篇、篇一、上篇、下篇、正篇、续篇
    { regex: /^[\s]*第?[一二三四五六七八九十百千万零\d]+篇|^[\s]*[上下正续]?篇/, type: '篇' },
    // 节格式：第一节、节一
    { regex: /^[\s]*第[一二三四五六七八九十百千万零\d]+节/, type: '节' },
    // 回格式：第一回、回一（古典小说）
    { regex: /^[\s]*第[一二三四五六七八九十百千万零\d]+回/, type: '回' },
    // 部格式：第一部、上部、下部
    { regex: /^[\s]*第?[一二三四五六七八九十百千万零\d]+部|^[\s]*[上下]部/, type: '部' },
    // 辑格式：第一辑
    { regex: /^[\s]*第[一二三四五六七八九十百千万零\d]+辑/, type: '辑' },
    // 部分格式：第一部分
    { regex: /^[\s]*第[一二三四五六七八九十百千万零\d]+部分/, type: '部分' },
    // 英文 Chapter/Part/Book/Section
    { regex: /^[\s]*(Chapter|Part|Book|Section|Volume)\s+\d+/i, type: 'chapter' },
  ];

  let charIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      charIndex += line.length + 1;
      continue;
    }

    for (const pattern of chapterPatterns) {
      if (pattern.regex.test(trimmed)) {
        // 提取章节名称（取该行，去掉前后空白，限制长度）
        const name = trimmed.length > 60 ? trimmed.substring(0, 60) + '...' : trimmed;
        chapters.push({
          name,
          type: pattern.type,
          startIndex: charIndex,
        });
        break; // 一行只匹配一个模式
      }
    }

    charIndex += line.length + 1;
  }

  return chapters;
}

/**
 * 检测书籍的章节结构（用于确认原书章节数）
 */
function detectBookChapters(content: string): { totalChapters: number; structureType: string; chapterNames: string[] } {
  const chapters = parseBookChapters(content);
  if (chapters.length === 0) {
    return { totalChapters: 0, structureType: '未知', chapterNames: [] };
  }
  // 取最多的章节类型作为结构类型
  const typeCounts: Record<string, number> = {};
  for (const ch of chapters) {
    typeCounts[ch.type] = (typeCounts[ch.type] || 0) + 1;
  }
  const structureType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
  return {
    totalChapters: chapters.length,
    structureType,
    chapterNames: chapters.map(c => c.name),
  };
}

// 中文数字→阿拉伯数字（仅支持 0~9999）
function cnNumToInt(cn: string): number {
  const digitMap: Record<string, number> = {
    零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100, 千: 1000, 万: 10000,
  };
  if (/^\d+$/.test(cn)) return parseInt(cn, 10);
  let result = 0;
  let section = 0;
  let lastUnit = 1;
  for (const ch of cn) {
    const v = digitMap[ch];
    if (v === undefined) continue;
    if (v >= 10) {
      // 单位字
      section = section === 0 ? v : section * v;
      result += section;
      section = 0;
      lastUnit = v;
    } else {
      section = section * 10 + v;
    }
  }
  result += section;
  // "十一"→11 这种特例
  if (result === 0 && cn.includes('十')) {
    // 类似"十"=10, "十五"=15
    const idx = cn.indexOf('十');
    const before = cn.substring(0, idx);
    const after = cn.substring(idx + 1);
    const b = before ? cnNumToInt(before) : 1;
    const a = after ? cnNumToInt(after) : 0;
    return b * 10 + a;
  }
  return result || lastUnit;
}

// 阿拉伯数字→中文数字（仅支持 1~9999，>=100 直接保留阿拉伯避免读法歧义）
function chineseNumeral(n: number): string {
  if (n <= 0) return '零';
  if (n <= 10) return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
  if (n < 20) return '十' + ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][n - 10];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][tens] + '十' + (ones ? ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][ones] : '');
  }
  return String(n);
}

/**
 * 检测原书"应有"的章节范围 + 缺失章节列表
 * 原理：扫描内容里出现的所有"第X章/卦/卷..."，取最大序号 N，对比 1~N 看哪些没出现
 */
function detectMissingChapters(content: string, structureType: string, expectedTotal?: number): {
  maxIndex: number;
  presentIndices: number[];
  missingIndices: number[];
  missingNames: string[];
} {
  if (!content || !structureType) {
    return { maxIndex: 0, presentIndices: [], missingIndices: [], missingNames: [] };
  }
  // 只对"章/卦/卷/篇/回/部/辑/节"这类有明确序号的结构做缺失检测
  const supportedUnits = ['章', '卦', '卷', '篇', '回', '部', '辑', '节'];
  // 兼容"卷/章"复合结构：按第一个字符判定主单位
  const primaryUnit = structureType.split(/[\/+·]/)[0] || structureType;
  if (!supportedUnits.includes(primaryUnit)) {
    return { maxIndex: 0, presentIndices: [], missingIndices: [], missingNames: [] };
  }
  const numPattern = '[一二三四五六七八九十百千万零\\d]+';
  const regex = new RegExp(`第(${numPattern})${primaryUnit}`, 'g');
  const seen = new Set<number>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const idx = cnNumToInt(match[1]);
    if (idx >= 1 && idx <= 9999) seen.add(idx);
  }
  // 🔴 优先使用权威目录探测到的 expectedTotal（即使文本内一个章号都没出现）
  // 这样"尾部整段缺失"也能被识别
  const observedMax = seen.size > 0 ? Math.max(...seen) : 0;
  const maxIndex = (expectedTotal && expectedTotal >= 3) ? expectedTotal : observedMax;
  if (maxIndex === 0) {
    return { maxIndex: 0, presentIndices: [], missingIndices: [], missingNames: [] };
  }
  // 仅当 maxIndex >= 3 才认为这是按序号编排的书（防止"第一章 总论"类单章误报）
  if (maxIndex < 3) {
    return { maxIndex, presentIndices: Array.from(seen).sort((a, b) => a - b), missingIndices: [], missingNames: [] };
  }
  const present: number[] = [];
  const missing: number[] = [];
  for (let i = 1; i <= maxIndex; i++) {
    if (seen.has(i)) present.push(i);
    else missing.push(i);
  }
  const toCN = (n: number): string => {
    if (n <= 10) return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
    if (n < 20) return '十' + ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][n - 10];
    if (n < 100) {
      const tens = Math.floor(n / 10);
      const ones = n % 10;
      return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][tens] + '十' + (ones ? ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][ones] : '');
    }
    return String(n); // 100+ 直接阿拉伯
  };
  const missingNames = missing.map(i => `第${toCN(i)}${primaryUnit}`);
  return { maxIndex, presentIndices: present, missingIndices: missing, missingNames };
}

/**
 * 从权威站点描述文本中提取"全书共XX章/卦/卷"的总数声明
 * 例：百度百科描述"全书共六十四卦"、"共二十章"
 * 返回 { total, unit } 或 null（未找到声明）
 */
function extractDeclaredChapterTotal(text: string): { total: number; unit: string } | null {
  if (!text || text.length < 10) return null;
  // 支持单位
  const units = ['章', '卦', '卷', '篇', '回', '部', '辑', '节'];
  // 多种声明模式
  const patterns: Array<{ re: RegExp; unit?: string }> = [];
  for (const u of units) {
    // "全书共XX章"、"共XX章"、"分为XX章"、"全书XX章"
    patterns.push({ re: new RegExp(`(?:全书|本书|该书|此书)?[共分]?(?:为|有)?\\s*([一二三四五六七八九十百千万零\\d]+)\\s*${u}(?![节字])`, 'g'), unit: u });
    // "XX章组成"、"由XX章构成"
    patterns.push({ re: new RegExp(`由\\s*([一二三四五六七八九十百千万零\\d]+)\\s*${u}(?:组成|构成)`, 'g'), unit: u });
  }
  // 收集所有候选 (total, unit)，最后取出现次数最多的（增强抗噪）
  const counter = new Map<string, { total: number; unit: string; hits: number }>();
  for (const p of patterns) {
    let m;
    while ((m = p.re.exec(text)) !== null) {
      const total = cnNumToInt(m[1]);
      if (total < 3 || total > 9999) continue;
      const key = `${total}|${p.unit}`;
      const prev = counter.get(key);
      if (prev) prev.hits++;
      else counter.set(key, { total, unit: p.unit || '章', hits: 1 });
    }
  }
  if (counter.size === 0) return null;
  // 取命中次数最多的；并列时取 total 最大的（避免被"共三章"这种小数字干扰）
  let best: { total: number; unit: string; hits: number } | null = null;
  for (const v of counter.values()) {
    if (!best || v.hits > best.hits || (v.hits === best.hits && v.total > best.total)) {
      best = v;
    }
  }
  return best ? { total: best.total, unit: best.unit } : null;
}

/**
 * 同步本地书籍的元信息（字符数、章节数、章节结构）
 * 用于"录入完成"快速通道：保证 currentChapter == totalChapters，避免假"缺章节"
 */
function getLocalBookMeta(bookName: string): {
  exists: boolean;
  charCount: number;
  totalChapters: number;
  chapterStructure: string;
} {
  try {
    const filePath = path.join(process.cwd(), 'public/book-content', `${bookName}.txt`);
    if (!fs.existsSync(filePath)) {
      return { exists: false, charCount: 0, totalChapters: 0, chapterStructure: '章' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const info = detectBookChapters(content);
    return {
      exists: true,
      charCount: content.length, // 字符数（不是字节）
      totalChapters: info.totalChapters,
      chapterStructure: info.structureType,
    };
  } catch {
    return { exists: false, charCount: 0, totalChapters: 0, chapterStructure: '章' };
  }
}

/**
 * 根据当前写入位置确定正在录入的章节
 */
function getCurrentChapterAtPosition(chapters: BookChapter[], position: number): { index: number; name: string } {
  if (chapters.length === 0) return { index: 0, name: '' };

  for (let i = chapters.length - 1; i >= 0; i--) {
    if (position >= chapters[i].startIndex) {
      return { index: i + 1, name: chapters[i].name };
    }
  }
  return { index: 1, name: chapters[0].name };
}

// ==================== 全局状态 ====================

const IS_SERVERLESS = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const TASK_BASE_DIR = IS_SERVERLESS ? '/tmp' : path.join(process.cwd(), 'public');
const TASKS_FILE = path.join(TASK_BASE_DIR, 'book-tasks.json');
const TASKS_DIR = TASK_BASE_DIR;
// 独立的墓碑文件（旧 HMR 闭包不会触碰它，确保已删除任务不会被旧逻辑复活）
const TOMBSTONE_FILE = path.join(TASK_BASE_DIR, 'book-tasks-tombstones.json');
let tasks: Map<string, BookTask> = new Map();
let processingQueue: Set<string> = new Set();
let isInitialized = false;

// ==================== 状态控制集合（必须在持久化函数之前声明，TDZ 保护） ====================
// 使用 globalThis 跨 HMR 重载持久化（dev 模式下模块会被重置）
type GlobalTaskState = {
  pausedTasks?: Set<string>;
  cancelledTasks?: Set<string>;
  deletedTaskIds?: Set<string>;
};
const _globalTaskState = (globalThis as unknown as { __bookTaskState?: GlobalTaskState }).__bookTaskState ??= {};
const pausedTasks: Set<string> = _globalTaskState.pausedTasks ??= new Set<string>();
const cancelledTasks: Set<string> = _globalTaskState.cancelledTasks ??= new Set<string>();
const deletedTaskIds: Set<string> = _globalTaskState.deletedTaskIds ??= new Set<string>();

// ==================== 持久化 ====================

function loadTasks(): void {
  try {
    // 先从独立墓碑文件加载已删除 ID（旧 HMR 闭包不会触碰它）
    if (fs.existsSync(TOMBSTONE_FILE)) {
      try {
        const tomb = JSON.parse(fs.readFileSync(TOMBSTONE_FILE, 'utf-8'));
        const ids: string[] = tomb.deletedIds || [];
        const names: string[] = tomb.deletedNames || [];
        for (const id of ids) {
          deletedTaskIds.add(id);
          cancelledTasks.add(id);
        }
        // 把书名级墓碑也存进 globalThis，方便 saveTasks 过滤旧闭包写回的同名新任务
        const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
        if (!g.__deletedBookNames) g.__deletedBookNames = new Set();
        for (const n of names) g.__deletedBookNames.add(n);
      } catch { /* 忽略 */ }
    }
    if (fs.existsSync(TASKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
      // 兼容旧版：从主文件也读 deletedIds（如果有）
      const deletedIds: string[] = data.deletedIds || [];
      for (const id of deletedIds) {
        deletedTaskIds.add(id);
        cancelledTasks.add(id);
      }
      const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
      const arr: BookTask[] = data.tasks || [];
      for (const task of arr) {
        // 跳过已被墓碑标记的任务（防止后台异步循环复活）
        if (deletedTaskIds.has(task.id)) continue;
        if (g.__deletedBookNames?.has(task.bookName)) {
          deletedTaskIds.add(task.id);
          continue;
        }
        tasks.set(task.id, task);
      }
      console.log(`[TaskManager] 已加载 ${tasks.size} 个任务，${deletedTaskIds.size} 个墓碑（ID），${g.__deletedBookNames?.size || 0} 个墓碑（书名）`);
    }
  } catch (e) {
    console.error('[TaskManager] 加载任务失败:', e);
    tasks = new Map();
  }
}

function toIso(ts: unknown): string | null {
  if (ts == null) return null;
  if (typeof ts === 'number' && Number.isFinite(ts)) return new Date(ts).toISOString();
  if (typeof ts === 'string') {
    const n = Number(ts);
    if (Number.isFinite(n) && n > 0) return new Date(n).toISOString();
    return ts;
  }
  return null;
}

function toMs(ts: unknown, fallback: number = Date.now()): number {
  if (ts == null) return fallback;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (typeof ts === 'string') {
    const direct = Number(ts);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function bookTaskToRow(t: BookTask): BookTaskRow {
  const now = Date.now();
  return {
    id: t.id,
    book_name: t.bookName,
    status: t.status,
    progress: t.progress ?? 0,
    message: t.message ?? null,
    chars: t.chars ?? 0,
    current_chapter: t.currentChapter ?? 0,
    total_chapters: t.totalChapters ?? 0,
    chapter_structure: t.chapterStructure ?? null,
    source: t.source ?? null,
    is_local_book: t.isLocalBook ?? false,
    learning_status: t.learningStatus ?? 'pending',
    learning_progress: t.learningProgress ?? 0,
    learning_current_chunk: t.learningCurrentChunk ?? 0,
    learning_total_chunks: t.learningTotalChunks ?? 0,
    learning_message: t.learningMessage ?? null,
    learning_layers_done: Array.isArray(t.learningLayersDone)
      ? t.learningLayersDone.map((n) => String(n))
      : null,
    learning_started_at: toIso(t.startedAt),
    learning_completed_at: t.learningStatus === 'done' ? toIso(t.completedAt ?? now) : toIso(t.completedAt),
    completed_at: toIso(t.completedAt),
    created_at: toIso(t.createdAt) ?? new Date(now).toISOString(),
    updated_at: toIso(t.updatedAt) ?? new Date(now).toISOString(),
    logs: Array.isArray(t.logs) && t.logs.length > 0
      ? t.logs.map((m) => ({
          time: new Date(t.updatedAt ?? now).toISOString(),
          level: 'info',
          message: typeof m === 'string' ? m : String(m),
        }))
      : null,
    has_missing_chapters: t.hasMissingChapters ?? false,
    missing_chapter_names: t.missingChapterNames ?? [],
    learning_current_chapter: t.learningCurrentChapter ?? 0,
    learning_current_chapter_name: t.learningCurrentChapterName ?? '',
  };
}

function rowToBookTask(row: BookTaskRow): BookTask {
  const createdMs = toMs(row.created_at);
  const updatedMs = toMs(row.updated_at, createdMs);
  return {
    id: row.id,
    bookName: row.book_name,
    status: (row.status ?? 'pending') as BookTask['status'],
    progress: row.progress ?? 0,
    message: row.message ?? '',
    chars: row.chars ?? 0,
    currentChapter: row.current_chapter ?? 0,
    totalChapters: row.total_chapters ?? 0,
    chapterStructure: row.chapter_structure ?? '',
    source: row.source ?? '',
    isLocalBook: row.is_local_book ?? false,
    learningStatus: (row.learning_status ?? 'pending') as BookTask['learningStatus'],
    learningProgress: row.learning_progress ?? 0,
    learningCurrentChunk: row.learning_current_chunk ?? 0,
    learningTotalChunks: row.learning_total_chunks ?? 0,
    learningMessage: row.learning_message ?? '',
    learningLayersDone: Array.isArray(row.learning_layers_done)
      ? row.learning_layers_done.map((s) => Number(s)).filter((n) => !Number.isNaN(n))
      : [],
    startedAt: row.learning_started_at ? toMs(row.learning_started_at) : null,
    completedAt: row.learning_completed_at
      ? toMs(row.learning_completed_at)
      : row.completed_at
        ? toMs(row.completed_at)
        : null,
    createdAt: createdMs,
    updatedAt: updatedMs,
    logs: Array.isArray(row.logs)
      ? row.logs.map((l) => (typeof l === 'string' ? l : (l as { message?: string })?.message ?? ''))
      : [],
    currentChapterName: '',
    remainingChapters: 0,
    size: '',
    chapters: [],
    hasMissingChapters: row.has_missing_chapters ?? false,
    missingChapterNames: Array.isArray(row.missing_chapter_names) ? row.missing_chapter_names : [],
    learningCurrentChapter: row.learning_current_chapter ?? 0,
    learningCurrentChapterName: row.learning_current_chapter_name ?? '',
    error: '',
  };
}

async function syncTaskToDb(task: BookTask): Promise<void> {
  try {
    const row = bookTaskToRow(task);
    // 唯一不可降级的状态：db 中已 done 的学习状态不能被覆盖（防止 resume 时 init 阶段误覆盖）
    try {
      const existing = await repoGetTaskByName(task.bookName);
      if (existing && existing.learning_status === 'done') {
        row.learning_status = 'done';
        row.learning_progress = 100;
        row.learning_completed_at = existing.learning_completed_at ?? row.learning_completed_at;
      }
    } catch { /* 忽略：拿不到就用 row 自己的值 */ }
    await repoUpsertTask(row);
  } catch (e) {
    console.error('[TaskManager] 同步任务到 Supabase 失败:', (e as Error)?.message);
  }
}

export async function loadTasksFromDb(): Promise<void> {
  try {
    const rows = await repoListTasks();
    if (!rows || rows.length === 0) return;
    let merged = 0;
    for (const row of rows) {
      // 跳过墓碑
      if (deletedTaskIds.has(row.id)) continue;
      const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
      if (g.__deletedBookNames?.has(row.book_name)) continue;
      const cloud = rowToBookTask(row);
      const local = tasks.get(row.id);
      // 云端更新时间 > 本地 → 使用云端版本
      if (!local || (cloud.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        tasks.set(row.id, cloud);
        merged++;
      }
    }
    if (merged > 0) {
      console.log(`[TaskManager] 从 Supabase 同步了 ${merged} 个任务到本地`);
    }
  } catch (e) {
    console.error('[TaskManager] 从 Supabase 加载任务失败:', (e as Error)?.message);
  }
}

function saveTasks(): void {
  try {
    const dir = path.dirname(TASKS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // 写盘前先合并独立墓碑文件（防止 HMR 后旧 processTask 闭包绕过内存墓碑）
    const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
    if (fs.existsSync(TOMBSTONE_FILE)) {
      try {
        const tomb = JSON.parse(fs.readFileSync(TOMBSTONE_FILE, 'utf-8'));
        for (const id of (tomb.deletedIds || [])) {
          deletedTaskIds.add(id);
          cancelledTasks.add(id);
          tasks.delete(id);
        }
        if (!g.__deletedBookNames) g.__deletedBookNames = new Set();
        for (const n of (tomb.deletedNames || [])) {
          g.__deletedBookNames.add(n);
        }
        // 同步清掉内存中可能被旧闭包重新写入的同名任务
        for (const [id, t] of tasks) {
          if (g.__deletedBookNames.has(t.bookName)) {
            deletedTaskIds.add(id);
            tasks.delete(id);
          }
        }
      } catch { /* 忽略 */ }
    }
    const arr = Array.from(tasks.values()).filter(t =>
      !deletedTaskIds.has(t.id) && !g.__deletedBookNames?.has(t.bookName)
    );
    const deletedIds = Array.from(deletedTaskIds);
    fs.writeFileSync(TASKS_FILE, JSON.stringify({ tasks: arr, deletedIds }, null, 2));

    // fire-and-forget 异步双写到 Supabase（保证开发/生产共享状态）
    for (const task of arr) {
      void syncTaskToDb(task);
    }
    for (const id of deletedIds) {
      void repoAddTombstone('id', id).catch(() => {});
    }
    const _g = globalThis as unknown as { __deletedBookNames?: Set<string> };
    if (_g.__deletedBookNames) {
      for (const name of _g.__deletedBookNames) {
        void repoAddTombstone('name', name).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[TaskManager] 保存任务失败:', e);
  }
}

export function forceSaveTasks(): void {
  saveTasks();
}

// ==================== 暂停/继续/取消操作 ====================

export function pauseTask(taskId: string): boolean {
  const task = tasks.get(taskId);
  if (!task || !['pending', 'searching', 'downloading', 'translating', 'saving'].includes(task.status)) {
    return false;
  }
  pausedTasks.add(taskId);
  const prevStatus = task.status;
  updateTask(taskId, {
    status: 'paused',
    message: `已暂停录入（之前状态：${prevStatus}），点击"继续"恢复`,
  });
  return true;
}

export function resumeTask(taskId: string): boolean {
  const task = tasks.get(taskId);
  if (!task || task.status !== 'paused') {
    return false;
  }
  pausedTasks.delete(taskId);
  // 恢复之前的运行状态（waitForResume会检测到状态变化并解除阻塞）
  // 不需要重新调用processTask，原有的processTask会通过waitForResume自动继续
  const prevStatus = task.message?.match(/之前状态：(\w+)/)?.[1] || 'searching';
  updateTask(taskId, {
    status: prevStatus as BookTask['status'],
    message: '正在恢复录入...',
  });
  return true;
}

/**
 * 取消任务（书名级联动取消）
 *
 * 🔴 取消语义：用户的"取消添加"=该书从未添加过。
 * 必须连带把这本书的所有相关任务（录入/翻译/学习等）一并清掉，包括：
 * 1. 内存中所有同书名的 task（无论状态）
 * 2. processingQueue 中正在跑的同书名 task
 * 3. processingLearningSet 中的同书名学习并发锁
 * 4. Supabase 的 book_tasks 表中同书名的行
 * 5. Supabase 的 books 表中的内容行（chunks）
 * 6. 本地物理文件（如果存在）
 * 7. 立 ID 级 + 书名级墓碑，阻止任何旧闭包/异步循环把这本书写回来
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  const task = tasks.get(taskId);
  if (!task) {
    // 即使内存里没有，也尝试按 ID 立墓碑，让搜索阶段已发起的异步循环知道这个 task 被取消了
    cancelledTasks.add(taskId);
    deletedTaskIds.add(taskId);
    return false;
  }

  const bookName = task.bookName;

  // 1. 找出所有同书名的 task ID
  const sameNameTaskIds: string[] = [];
  for (const [id, t] of tasks) {
    if (t.bookName === bookName) {
      sameNameTaskIds.push(id);
    }
  }
  if (!sameNameTaskIds.includes(taskId)) sameNameTaskIds.push(taskId);

  // 2. 内存批量清理：标墓碑 + 解暂停 + 出处理队列 + 出学习并发集合 + 从 tasks Map 删除
  for (const id of sameNameTaskIds) {
    cancelledTasks.add(id);
    deletedTaskIds.add(id);
    pausedTasks.delete(id);
    processingQueue.delete(id);
    if (processingLearningSet) {
      try { processingLearningSet.delete(id); } catch { /* ignore */ }
    }
    tasks.delete(id);
  }

  // 3. 立书名级墓碑（防止种子自愈、_异步循环_等再次写回同名 task）
  const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
  g.__deletedBookNames ??= new Set<string>();
  g.__deletedBookNames.add(bookName);

  // 4. Supabase 兜底（异步操作集中后置，全部错误吞掉避免影响内存清理结果）
  try {
    const allDbTasks = await repoListTasks();
    const dbIdsToDelete = allDbTasks
      .filter(t => t.book_name === bookName)
      .map(t => t.id)
      .filter((id): id is string => !!id);
    for (const id of dbIdsToDelete) {
      cancelledTasks.add(id);
      deletedTaskIds.add(id);
      try { await repoDeleteTask(id); } catch { /* ignore */ }
      try { await repoAddTombstone('id', id); } catch { /* ignore */ }
    }
    // 即使一条 db task 都没找到也立一次书名级墓碑
    try { await repoAddTombstone('name', bookName); } catch { /* ignore */ }
  } catch { /* ignore */ }

  // 5. 从 Supabase books 表删除内容行（防取消后内容残留）
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('books').delete().eq('name', bookName);
    }
  } catch { /* ignore */ }

  // 6. 删除本地物理文件
  try {
    const { removeBookFromKnowledgeBase } = await import('./fulltext-search');
    removeBookFromKnowledgeBase(bookName);
  } catch { /* ignore */ }

  saveTasks();
  return true;
}

export function isTaskPaused(taskId: string): boolean {
  return pausedTasks.has(taskId);
}

export function isTaskCancelled(taskId: string): boolean {
  return cancelledTasks.has(taskId);
}

// ==================== 任务操作 ====================

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function updateTask(id: string, updates: Partial<BookTask>): BookTask | null {
  // 墓碑保护：已删除任务拒绝任何 update
  if (deletedTaskIds.has(id)) return null;
  const task = tasks.get(id);
  if (!task) return null;
  
  Object.assign(task, updates, { updatedAt: Date.now() });

  // 🔴 进度→状态自动翻转兜底（永久规则）
  // 任何任务，只要进度到 100%，状态必须立刻翻为"已完成"，绝不允许卡在"进行中"
  // 1) 学习进度 100% → learningStatus='done'（含强制 learningProgress=100、learningLayersDone 全亮）
  if (task.learningProgress >= 100 && task.learningStatus !== 'done' && task.learningStatus !== 'failed') {
    task.learningStatus = 'done';
    task.learningProgress = 100;
    task.learningLayersDone = (task.learningLayersDone && task.learningLayersDone.length > 0)
      ? task.learningLayersDone
      : [1, 2, 3, 4];
    if (!task.learningMessage || /学习中|进行中|学习\.\.\./i.test(task.learningMessage)) {
      task.learningMessage = `✅ 已学完《${task.bookName}》全部内容`;
    }
    if (!task.completedAt) task.completedAt = Date.now();
  }
  // 2) 录入进度 100% → status='done'
  if ((task.progress ?? 0) >= 100 && task.status !== 'done' && task.status !== 'failed' && task.status !== 'paused') {
    task.status = 'done';
    task.progress = 100;
    if (!task.completedAt) task.completedAt = Date.now();
  }
  // 3) 录入完成后 status='done' 即代表"已录入+已翻译"（项目内翻译是录入流程的内部阶段，没有独立翻译状态字段）

  tasks.set(id, task);
  saveTasks(); // 每次更新都持久化到本地
  // 🔴 关键：每次状态变更都实时同步到 Supabase，确保 AI truthBlock 能读到最新状态
  void syncTaskToDb(task);
  return task;
}

function addLog(id: string, message: string): void {
  // 墓碑保护：已删除任务拒绝任何 log
  if (deletedTaskIds.has(id)) return;
  const task = tasks.get(id);
  if (!task) return;
  task.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (task.logs.length > 100) task.logs = task.logs.slice(-50);
  task.updatedAt = Date.now();
  saveTasks();
  // 日志变更不同步到 Supabase（频率太高），只在状态变更时同步
}

// ==================== 暂停/取消检查 ====================

function checkTaskControl(taskId: string): 'continue' | 'paused' | 'cancelled' {
  const task = tasks.get(taskId);
  if (!task) return 'cancelled';
  if (cancelledTasks.has(taskId)) return 'cancelled';
  if (task.status === 'paused') return 'paused';
  return 'continue';
}

async function waitForResume(taskId: string): Promise<boolean> {
  // 等待任务从暂停状态恢复，最多等10分钟
  for (let i = 0; i < 600; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const ctrl = checkTaskControl(taskId);
    if (ctrl === 'continue') return true;
    if (ctrl === 'cancelled') return false;
  }
  return false;
}

// ==================== 核心录入逻辑 ====================

async function processTask(taskId: string): Promise<void> {
  const task = tasks.get(taskId);
  if (!task || task.status === 'done' || task.status === 'exists') return;
  
  if (processingQueue.has(taskId)) {
    console.log(`[TaskManager] 任务 ${taskId} 已在处理中`);
    return;
  }
  processingQueue.add(taskId);

  try {
    // 🔴 状态同步铁律（快速通道）：本地物理文件已存在 → 直接标 done 退出
    // 防止旧 HMR 闭包反复触发搜索循环，造成"知识库说完成 / 添加书籍页说搜索中"的矛盾
    try {
      const meta = getLocalBookMeta(task.bookName);
      if (meta.exists) {
        updateTask(taskId, {
          status: 'done',
          progress: 100,
          message: `《${task.bookName}》已录入完成（检测到本地全文文件）`,
          chars: meta.charCount > 0 ? meta.charCount : task.chars,
          // 关键修复：本地书的 currentChapter 直接等于 totalChapters，避免假"缺章节"
          currentChapter: meta.totalChapters || task.currentChapter,
          totalChapters: meta.totalChapters || task.totalChapters,
          chapterStructure: meta.chapterStructure || task.chapterStructure,
          source: task.source || '本地',
          completedAt: task.completedAt || Date.now(),
          learningStatus: task.learningStatus === 'done' ? 'done' : 'pending',
          learningMessage: task.learningStatus === 'done' 
            ? task.learningMessage 
            : '⏳ 待学习（在知识库点击"开始学习"启动）',
        });
        addLog(taskId, '检测到本地全文文件，跳过搜索/录入流程，直接标记为已完成');
        processingQueue.delete(taskId);
        return;
      }
    } catch { /* 忽略文件检测异常 */ }
    
    // 用户主动添加书籍 = 强制重新录入（即使知识库已存在也覆盖）
    // 不再因 isBookExists 拦截，确保用户能看到完整录入流程
    if (isBookExists(task.bookName)) {
      addLog(taskId, `⚠️ 知识库中已有同名书，将重新录入覆盖原版本`);
    }

    updateTask(taskId, {
      status: 'searching',
      message: `正在搜索《${task.bookName}》...`,
      startedAt: Date.now(),
    });
    addLog(taskId, '开始搜索');

    const config = new Config();
    const searchClient = new SearchClient(config);
    const fetchClient = new FetchClient(config);

    // 2. 搜索书籍来源（铁规则：搜索次数无上限，不设任何限制）
    // 🔴 搜索次数无上限，不设任何限制。想搜多少次就搜多少次，不存在"达到搜索上限就停止"
    // 🌐 Book Finder 与 Book Crawler 共用同一份全网数据源池（280个固定站点），平等遍历无分工
    // 每个站点都用 site: 限定 webSearch 查询一次，确保 A 路覆盖到全部站点
    // 配合 Universal Crawler（110站接力）+ 10个国际开放平台API直连，总搜索源 ≈ 400
    // 仅列入"我有把握真实存在的网站"，绝不瞎编凑数（铁规则七：不许虚报）
    const ALL_SITE_DOMAINS = [
      // ========== 一、中文古籍 / 国学（40个） ==========
      'ctext.org',                          // 中国哲学书电子化计划
      'so.gushiwen.cn',                     // 古诗文网搜索
      'so.gushiwen.org',                    // 古诗文网
      'gushiwen.cn',                        // 古诗文网主站
      'guoxuedashi.net',                    // 国学大师
      'cidianwang.com',                     // 词典网
      'shicimingju.com',                    // 诗词名句网
      'zhonghuadiancang.com',               // 中华典藏
      'guoxuemeng.com',                     // 国学梦
      'zh.wikisource.org',                  // 中文维基文库
      'zh-classical.wikipedia.org',         // 文言文维基
      'daizhige.org',                       // 殆知阁古代文献藏书
      'shuge.org',                          // 书格（古籍善本）
      'shanben.com',                        // 善本古籍
      'gj.zdic.net',                        // 汉典古籍
      'zdic.net',                           // 汉典
      'chinesewords.org',                   // 中华词
      'haoshici.com',                       // 好诗词
      '5000yan.com',                        // 国学网
      'gushiju.net',                        // 古诗句网
      'gushi.eu',                           // 中华古诗
      'wenxue99.com',                       // 99文学
      'guoyu.cn',                           // 国语网
      'zwbk.org',                           // 中文百科
      'baike.baidu.com',                    // 百度百科
      'baike.so.com',                       // 360百科
      'zh.wikipedia.org',                   // 中文维基百科
      'sou-yun.cn',                         // 搜韵
      'kanripo.org',                        // 漢籍リポジトリ
      'kanji.zinbun.kyoto-u.ac.jp',         // 京都大学人文研
      'ihp.sinica.edu.tw',                  // 中研院史语所
      'npm.gov.tw',                         // 台北故宫
      'tcss.ntu.edu.tw',                    // 台大中文系
      'sinica.edu.tw',                      // 中研院
      'rcwa.fudan.edu.cn',                  // 复旦古籍
      'ancientbooks.cn',                    // 古籍网
      'gujivip.com',                        // 古籍VIP
      'guji.cn',                            // 古籍网
      'wenxue.org.cn',                      // 中国文学网
      'historychina.net',                   // 中华文史网

      // ========== 二、玄学命理 / 易学 / 风水（50个） ==========
      'guidaye.cn',                         // 鬼大爷
      'buyiju.com',                         // 卜易居
      'd1xz.net',                           // 第一星座
      'yw11.com',                           // 易学网
      'yw11.cn',                            // 易学网备
      'xingyunba.com',                      // 星运吧
      'haoxz.com',                          // 好星座
      '922y.com',                           // 922易经
      'yixuew.com',                         // 易学网
      'yijing.com.cn',                      // 易经网
      'huangli8.com',                       // 黄历网
      '1518.com.cn',                        // 1518命理
      'mingyunshi.com',                     // 命运师
      '91taluo.cn',                         // 91塔罗
      'xingzuokao.com',                     // 星座考
      'baziwu.com',                         // 八字屋
      'bz173.com',                          // 八字网
      'zhouyi.cc',                          // 周易网
      'zhouyi168.com',                      // 周易168
      'meihuayishu.com',                    // 梅花易数
      'liuyao.com',                         // 六爻
      'liuren.com',                         // 大六壬
      'qimen.com.cn',                       // 奇门
      'ziwei.org',                          // 紫微
      'fengshui.com.cn',                    // 风水
      'fengshuiguide.cn',                   // 风水指南
      'aboluowang.com',                     // 阿波罗（含命理）
      'sjxz.cn',                            // 算命网
      'sm.jixiang.com',                     // 算命吉祥
      'shengxiao.aies.cn',                  // 生肖
      'qiming.aies.cn',                     // 起名
      'jixiang.com',                        // 吉祥网
      '12ky.com',                           // 十二客
      'xingyunwang.com',                    // 星运网
      'yi-jing.org',                        // 易经
      'china98.net',                        // 中华命理98
      'fortunechina.com',                   // 财富中国
      'taolibar.com',                       // 淘力吧
      'lingmenfengshui.com',                // 灵门风水
      'china.com.cn/aboutchina',            // 中华文化
      'baduanjin.com',                      // 八段锦
      'tianqi.com/zhishi',                  // 黄历知识
      'huangli.51240.com',                  // 黄历
      'wnl.51240.com',                      // 万年历
      'xz.91qzy.com',                       // 星座91
      'mingli5.com',                        // 命理5
      'aies.cn',                            // AI易学
      'taisha.org',                         // 太岁
      'lunar.aies.cn',                      // 农历
      'taobao.com/markets/3c/calendar',     // 黄历日历

      // ========== 三、佛教典籍（30个） ==========
      'cbeta.org',                          // CBETA 中华电子佛典
      'cbetaonline.cn',                     // CBETA在线
      'cbeta.dila.edu.tw',                  // 法鼓CBETA
      'ddc.shengyen.org',                   // 圣严法鼓
      'buddhistdoor.net',                   // 佛门网
      'fjdh.cn',                            // 佛教导航
      'foxue.org',                          // 佛学
      'xuefo.net',                          // 学佛网
      'liaotuo.com',                        // 了佛
      'foxuequan.com',                      // 佛学全
      '84000.co',                           // 84000翻译
      'read.84000.co',                      // 84000阅读
      'suttacentral.net',                   // 经藏中心（南传）
      'accesstoinsight.org',                // 内观
      'buddhanet.net',                      // 佛教网
      'tbrc.org',                           // 西藏佛教资源
      'bdrc.io',                            // BDRC
      'rkts.org',                           // Resources for Kanjur
      'nichirenlibrary.org',                // 日莲文库
      'dharmanet.net',                      // 达摩网
      'fodian.net',                         // 佛典
      'fofa.com',                           // 佛法
      'lianxh.com',                         // 莲心
      'fjnet.com',                          // 佛教在线
      'fo01.com',                           // 佛教01
      'fomen123.com',                       // 佛门123
      'lianhuawang.com',                    // 莲华网
      'chunfeng.org',                       // 春风寺
      'pusa123.com',                        // 菩萨123
      'fojiao.com',                         // 佛教中心

      // ========== 四、道教典籍（20个） ==========
      'daoism.cn',                          // 道教中国
      'daojiao.org',                        // 道教
      'taoism.com.tw',                      // 台湾道教
      'ctcwri.idv.tw',                      // 中华道教
      'daode.cn',                           // 道德经
      'daode8.com',                         // 道德8
      '99dao.com',                          // 99道
      'xuandao.org',                        // 玄道
      'chinataoism.org',                    // 中国道教协会
      'taoismchina.com',                    // 道教中国
      'daoism.org',                         // 道学
      'chinesetaoist.com',                  // 中华道
      'wudangwang.com',                     // 武当
      'qingsong.org',                       // 青松观
      'baiyunguan.com',                     // 白云观
      'maoshan.org',                        // 茅山
      'longhushan.org.cn',                  // 龙虎山
      'wudangtaoism.com',                   // 武当道教
      'taoist-canon.com',                   // 道藏
      'zangwai.com',                        // 藏外

      // ========== 五、国际开放图书馆 / 平台（35个） ==========
      'archive.org',                        // Internet Archive
      'openlibrary.org',                    // OpenLibrary
      'gutenberg.org',                      // Project Gutenberg
      'en.wikisource.org',                  // 英文维基文库
      'ja.wikisource.org',                  // 日文维基文库
      'ko.wikisource.org',                  // 韩文维基文库
      'de.wikisource.org',                  // 德文
      'fr.wikisource.org',                  // 法文
      'es.wikisource.org',                  // 西文
      'la.wikisource.org',                  // 拉丁文
      'sa.wikisource.org',                  // 梵文
      'hathitrust.org',                     // HathiTrust
      'babel.hathitrust.org',               // HathiTrust阅读
      'loc.gov',                            // 美国国会图书馆
      'bl.uk',                              // 大英图书馆
      'bnf.fr',                             // 法国国家图书馆
      'gallica.bnf.fr',                     // Gallica
      'ndl.go.jp',                          // 日本国会图书馆
      'dl.ndl.go.jp',                       // NDL数字
      'ndlsearch.ndl.go.jp',                // NDL搜索
      'europeana.eu',                       // 欧洲数字
      'worldcat.org',                       // WorldCat
      'dnb.de',                             // 德国国家图书馆
      'digitale-sammlungen.de',             // 巴伐利亚
      'onb.ac.at',                          // 奥地利
      'nb.no',                              // 挪威
      'kb.nl',                              // 荷兰
      'nlc.cn',                             // 中国国家图书馆
      'read.nlc.cn',                        // 国图在线
      'bvmc.cervantesvirtual.com',          // 塞万提斯虚拟图书馆
      'digital.nls.uk',                     // 苏格兰国图
      'nls.uk',                             // 苏格兰
      'bne.es',                             // 西班牙
      'bndigital.bn.gov.br',                // 巴西
      'kungbib.se',                         // 瑞典

      // ========== 六、学术 / 论文（25个） ==========
      'jstor.org',                          // JSTOR
      'scholar.google.com',                 // Google Scholar
      'semanticscholar.org',                // Semantic Scholar
      'core.ac.uk',                         // CORE
      'doaj.org',                           // DOAJ
      'academia.edu',                       // Academia
      'researchgate.net',                   // ResearchGate
      'ssrn.com',                           // SSRN
      'arxiv.org',                          // arXiv
      'philpapers.org',                     // PhilPapers
      'oapen.org',                          // OAPEN
      'doabooks.org',                       // DOAB
      'projectmuse.org',                    // Project MUSE
      'cnki.com.cn',                        // 知网
      'wanfangdata.com.cn',                 // 万方
      'cqvip.com',                          // 维普
      'xuewen.cnki.net',                    // 学问CNKI
      'cnki.net',                           // 知网
      'duxiu.com',                          // 读秀
      'chaoxing.com',                       // 超星
      'ssreader.com',                       // 超星读书
      'nlcpress.com',                       // 国图出版
      'wenxianwang.com',                    // 文献网
      'ipac.calis.edu.cn',                  // 联合目录
      'nstl.gov.cn',                        // 国家科技图书

      // ========== 七、中文文档共享 / 笔记（25个） ==========
      'wenku.baidu.com',                    // 百度文库
      'doc88.com',                          // 道客巴巴
      'docin.com',                          // 豆丁
      'wenku365.com',                       // 文库365
      'max.book118.com',                    // book118
      'mbalib.com',                         // MBA智库
      'wenku.baike.so.com',                 // 360文库
      '360doc.com',                         // 360doc
      'm.360doc.com',                       // 360doc手机
      '360doc.cn',                          // 360doc备
      '51wendang.com',                      // 51文档
      'doc.mbalib.com',                     // MBA文档
      'wikitravel.org',                     // Wikitravel
      'jianshu.com',                        // 简书
      'zhuanlan.zhihu.com',                 // 知乎专栏
      'zhihu.com',                          // 知乎
      'csdn.net',                           // CSDN
      'cnblogs.com',                        // 博客园
      'oschina.net',                        // 开源中国
      'segmentfault.com',                   // SegmentFault
      'douban.com',                         // 豆瓣
      'book.douban.com',                    // 豆瓣读书
      'note.youdao.com',                    // 有道云笔记
      'mooon.cn',                           // 摩昂笔记
      'evernote.com',                       // 印象笔记

      // ========== 八、中文小说 / 古书（30个） ==========
      'reader.qq.com',                      // QQ阅读
      'dingdiann.com',                      // 顶点
      '25zw.com',                           // 25zw
      'xbiquge.so',                         // 笔趣阁
      'quanben5.com',                       // 全本5
      'shuhai.tw',                          // 书海
      'biquge.com.cn',                      // 笔趣阁
      'biquge.lol',                         // 笔趣阁lol
      '81zw.com',                           // 81中文
      '23us.com',                           // 23us
      'shumilou.co',                        // 书迷楼
      'soushuwang.org',                     // 搜书网
      'xiaoshuotxt.org',                    // 小说txt
      'soushu.net',                         // 搜书
      'shuget.com',                         // 书get
      'gushijicang.com',                    // 古书集藏
      'huanyue123.com',                     // 幻月123
      'soubook.com',                        // 搜书
      'p2p-book.com',                       // P2P书
      'bookos.org',                         // bookos
      'gujicang.com',                       // 古籍藏
      'jicang.org',                         // 集藏
      'shuget.cn',                          // 书get
      'mybookshelf.com',                    // 我的书架
      'libgen.is',                          // LibGen
      'b-ok.cc',                            // Z-Library
      'zh.annas-archive.org',               // Anna's Archive
      'pandiabook.com',                     // 番外书
      'iqing.in',                           // 爱情
      'xs520.com',                          // 小说520

      // ========== 九、综合搜索引擎兜底（15个） ==========
      'google.com',                         // Google
      'bing.com',                           // Bing
      'duckduckgo.com',                     // DuckDuckGo
      'baidu.com',                          // 百度
      'sogou.com',                          // 搜狗
      'so.com',                             // 360搜索
      'yandex.com',                         // Yandex
      'naver.com',                          // 韩国Naver
      'daum.net',                           // 韩国Daum
      'yahoo.com',                          // Yahoo
      'startpage.com',                      // Startpage
      'ecosia.org',                         // Ecosia
      'presearch.com',                      // Presearch
      'mojeek.com',                         // Mojeek
      'qwant.com',                          // Qwant

      // ========== 十、辅助类（10个） ==========
      'librivox.org',                       // LibriVox 有声书
      'standardebooks.org',                 // Standard Ebooks
      'manybooks.net',                      // ManyBooks
      'feedbooks.com',                      // Feedbooks
      'wikibooks.org',                      // Wikibooks
      'commons.wikimedia.org',              // Wikimedia Commons
      'wikiquote.org',                      // Wikiquote
      'wiktionary.org',                     // Wiktionary
      'fileformat.info',                    // 文件格式
      'unicode.org',                        // Unicode
      // 🟢 合并新增 502 个数据源的域名（自动去重）
      ...Array.from(new Set(
        DATA_SOURCES.map((s) => {
          try { return new URL(s.baseUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
        }).filter((d): d is string => Boolean(d))
      )),
    ];

    // ⚡ 用户规则：搜索只用书名，不拼接任何关键词
    // 通用一条 + 为每个固定站点单发一条 site: 查询（仅在站点内搜书名）
    const initialSearchQueries = [
      `${task.bookName}`,
      ...ALL_SITE_DOMAINS.map(domain => `${task.bookName} site:${domain}`),
    ];

    let allResults: Array<{ url: string; title: string; snippet: string }> = [];

    // 基础搜索：并行执行多个搜索 query（流式更新 message，让用户看到正在动）
    // 关键修复：每完成一路就更新 message + 单包 12s 超时，避免最慢那个拖死整批让用户以为卡死
    updateTask(taskId, { message: `🔎 准备搜索 ${initialSearchQueries.length} 个数据源查找《${task.bookName}》...` });
    let finishedCount = 0;
    const totalQueries = initialSearchQueries.length;
    const withTimeout = function <T>(p: Promise<T>, ms: number): Promise<T | null> {
      return Promise.race([
        p.catch(() => null as T | null),
        new Promise<T | null>(resolve => setTimeout(() => resolve(null), ms)),
      ]);
    };
    await Promise.all(
      initialSearchQueries.map(async (q, idx) => {
        const siteHint = q.includes('site:') ? q.split('site:')[1] : '通用搜索';
        const response = await withTimeout(searchClient.webSearch(q, 10), 12000);
        if (response?.web_items) {
          for (const r of response.web_items) {
            if (r.url && !allResults.some(x => x.url === r.url)) {
              allResults.push({ url: r.url, title: r.title || '', snippet: r.snippet || '' });
            }
          }
        }
        finishedCount++;
        // 每完成一路立即更新 message，让用户感知"正在动"
        updateTask(taskId, {
          message: `🔎 搜索中 ${finishedCount}/${totalQueries}（刚完成：${siteHint.substring(0, 30)}），已收集 ${allResults.length} 个来源`,
        });
      })
    );
    addLog(taskId, `基础搜索完成 ${finishedCount}/${totalQueries} 路，找到 ${allResults.length} 个来源`);
    updateTask(taskId, { message: `🔎 基础搜索完成（${allResults.length} 个来源），继续深度抓取...` });

    // 🔴🔴🔴 Book Finder 技能：用专门的爬虫脚本搜索QQ阅读、顶点小说、鬼大爷、25zw等
    // 这些网站通常有完整的书籍内容，是搜索的重要补充渠道
    let bookFinderContent = '';
    try {
      addLog(taskId, `📱 使用 Book Finder 技能搜索《${task.bookName}》...`);
      const { execFile } = await import('child_process');
      const scriptPath = path.join(process.cwd(), 'scripts', 'xuanji_fetch.py');
      if (fs.existsSync(scriptPath)) {
        const result = await new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
          execFile('python3', [scriptPath, task.bookName], {
            timeout: 30 * 1000, // 30秒超时（避免用户长时间等待，超时后由 Universal Crawler 110 站接力）
            maxBuffer: 50 * 1024 * 1024, // 50MB缓冲
          }, (err, stdout, stderr) => {
            if (err) reject(err);
            else resolve({ stdout, stderr });
          });
        });
        
        if (result.stdout) {
          try {
            const fetchResult = JSON.parse(result.stdout);
            if (fetchResult.success && fetchResult.full_text) {
              bookFinderContent = fetchResult.full_text;
              addLog(taskId, `📱 Book Finder 成功！来源：${fetchResult.source}，爬取${fetchResult.fetched_chapters}/${fetchResult.total_chapters}章，共${bookFinderContent.length}字`);
            } else if (fetchResult.error) {
              const sources = fetchResult.searched_sources || [];
              const total = fetchResult.total_sources || sources.length;
              addLog(taskId, `📱 Book Finder 未能找到：${fetchResult.error}${total ? `（已遍历${total}个数据源：${sources.slice(0, 6).join('、')}${sources.length > 6 ? '等' : ''}）` : ''}`);
            }
          } catch (parseErr) {
            addLog(taskId, `📱 Book Finder 输出解析失败`);
          }
        }
      } else {
        addLog(taskId, `📱 Book Finder 脚本不存在，跳过`);
      }
    } catch (finderErr: unknown) {
      const errMsg = finderErr instanceof Error ? finderErr.message : String(finderErr);
      addLog(taskId, `📱 Book Finder 执行出错：${errMsg.substring(0, 100)}`);
    }

    // 🔴 暂停/取消检查点
    {
      const ctrl = checkTaskControl(taskId);
      if (ctrl === 'cancelled') { processingQueue.delete(taskId); return; }
      if (ctrl === 'paused') { const resumed = await waitForResume(taskId); if (!resumed) { processingQueue.delete(taskId); return; } }
    }

    // 铁规则：不存在搜索次数上限！必须搜遍全网所有渠道才能判定版权问题
    // ⚡ 用户规则：搜索只用书名，不拼接任何关键词
    // 如果第一批为空，重复一次书名搜索（搜索引擎可能临时波动）
    if (allResults.length === 0) {
      const extraQueries1 = [
        `${task.bookName}`,
      ];
      for (const query of extraQueries1) {
        try {
          const response = await searchClient.webSearch(query, 10);
          if (response?.web_items) {
            for (const r of response.web_items) {
              if (r.url && !allResults.some(x => x.url === r.url)) {
                allResults.push({ url: r.url, title: r.title || '', snippet: r.snippet || '' });
              }
            }
          }
        } catch (e) {
          // 继续
        }
      }
      addLog(taskId, `追加搜索第1批完成（仅书名），累计 ${allResults.length} 个来源`);
    }

    // 🔴🔴🔴 "搜遍全网"定义：不是搜三遍就叫搜遍全网！
    // 是连续不断地搜，搜无数遍，把所有能想到的网站、平台、渠道全部搜完
    // 搜到确实在任何地方都找不到了，才能判定为版权问题
    // 搜了三遍没找到 ≠ 搜遍全网。搜遍全网 = 真的 nowhere to be found
    const searchRounds: Array<{ name: string; queries: string[] }> = [
      // === 第一波：多搜索引擎 ===
      {
        name: '百度搜索',
        queries: [
          `${task.bookName} 全文`,
          `${task.bookName} 在线阅读 完整版`,
          `${task.bookName} 下载 电子版`,
        ],
      },
      {
        name: '搜狗搜索',
        queries: [
          `${task.bookName} 全文 阅读`,
          `${task.bookName} 电子书 下载`,
        ],
      },
      {
        name: '必应搜索',
        queries: [
          `${task.bookName} full text OR 全文`,
          `${task.bookName} ebook OR 电子书 download`,
        ],
      },
      {
        name: '360搜索',
        queries: [
          `${task.bookName} 全本 在线`,
          `${task.bookName} 完整版 阅读`,
        ],
      },
      // === 第二波：PDF/电子书格式搜索 ===
      {
        name: 'PDF/电子书搜索',
        queries: [
          `${task.bookName} pdf 下载`,
          `${task.bookName} 电子书 在线阅读`,
          `${task.bookName} txt 全本`,
          `${task.bookName} epub 免费下载`,
          `${task.bookName} mobi 全本下载`,
          `${task.bookName} 扫描版 OR 影印版 OR 原书`,
        ],
      },
      // === 第三波：文档平台逐个搜 ===
      {
        name: '百度文库',
        queries: [
          `${task.bookName} site:wenku.baidu.com`,
          `${task.bookName} 文库 百度`,
        ],
      },
      {
        name: '道客巴巴/豆丁',
        queries: [
          `${task.bookName} site:doc88.com`,
          `${task.bookName} site:docin.com`,
          `${task.bookName} site:m.book118.com`,
        ],
      },
      {
        name: '新浪/爱问',
        queries: [
          `${task.bookName} site:ishare.iask.sina.com.cn`,
          `${task.bookName} site:vdisk.weibo.com`,
        ],
      },
      // === 第四波：论坛/社区逐个搜 ===
      {
        name: '知乎',
        queries: [
          `${task.bookName} site:zhihu.com`,
          `${task.bookName} 知乎 推荐 资源`,
        ],
      },
      {
        name: '豆瓣',
        queries: [
          `${task.bookName} site:douban.com`,
          `${task.bookName} 豆瓣 读书 笔记`,
        ],
      },
      {
        name: '贴吧/微博/小红书',
        queries: [
          `${task.bookName} site:tieba.baidu.com`,
          `${task.bookName} site:weibo.com`,
          `${task.bookName} site:xiaohongshu.com`,
        ],
      },
      // === 第五波：古籍库/学术平台 ===
      {
        name: '古籍数据库',
        queries: [
          `${task.bookName} site:guji.nlpc.org.cn`,
          `${task.bookName} site:shuge.org`,
          `${task.bookName} site:gugeyingshu.com`,
          `${task.bookName} site:nlc.cn OR site:calis.edu.cn`,
        ],
      },
      {
        name: '图书馆/学术平台',
        queries: [
          `${task.bookName} 国家图书馆 OR 数字古籍`,
          `${task.bookName} site:cnki.net OR site:wanfangdata.com.cn`,
          `${task.bookName} 学术 论文 引用`,
        ],
      },
      // === 第六波：换关键词/换角度搜 ===
      {
        name: '作者/别名搜索',
        queries: [
          `${task.bookName} 作者 全集 作品`,
          `${task.bookName} 又名 OR 别名 OR 古称 OR 异名`,
          `"${task.bookName}" 全文 OR 完整 OR 原版`,
        ],
      },
      {
        name: '内容引用搜索',
        queries: [
          `${task.bookName} 内容 摘录 章节内容`,
          `${task.bookName} 原文 引用 片段 选段`,
          `${task.bookName} 读后感 书评 内容介绍`,
          `${task.bookName} 目录 全部章节 完整版`,
        ],
      },
      {
        name: '二手书/书源搜索',
        queries: [
          `${task.bookName} 孔夫子 OR 旧书网 OR 缺书网`,
          `${task.bookName} site:kongfz.com`,
          `${task.bookName} 购买 OR 哪里买 OR 书源`,
        ],
      },
      // === 第七波：深度穷举——把前面所有角度重新搜一遍 ===
      {
        name: '深度穷举-换词搜',
        queries: [
          `${task.bookName} 原文 全部内容 不删节`,
          `${task.bookName} 完整文本 无删减`,
          `${task.bookName} 书籍资源 网盘 百度云`,
          `${task.bookName} 蓝奏云 OR 阿里云盘 OR 夸克网盘`,
          `${task.bookName} 下载链接 免费 OR 破解`,
        ],
      },
      {
        name: '深度穷举-英文/繁体搜',
        queries: [
          `${task.bookName} english translation OR 英文版`,
          `${task.bookName} 繁體 OR 繁体版 OR 台灣版`,
          `${task.bookName} 简体 OR 简體 OR 大陆版`,
        ],
      },
      // === 第八波：微信读书/电子书平台 ===
      {
        name: '微信读书/电子书',
        queries: [
          `${task.bookName} 微信读书 OR weread`,
          `${task.bookName} 电子书 OR ebook OR PDF下载`,
          `${task.bookName} 在线阅读 OR 全本阅读 OR 免费阅读`,
        ],
      },
      // === 第九波：网盘/书源深度搜索 ===
      {
        name: '网盘书源深度搜',
        queries: [
          `${task.bookName} site:pan.baidu.com`,
          `${task.bookName} 阿里云盘 OR 夸克网盘 OR 迅雷云盘`,
          `${task.bookName} 书源 OR txt下载 OR epub OR mobi`,
          `${task.bookName} 大力盘 OR 凌风云 OR 超能搜`,
        ],
      },
      // === 第十波：终极穷举——所有角度再来一遍 ===
      {
        name: '终极穷举',
        queries: [
          `"${task.bookName}" 全文 完整版 不删节`,
          `${task.bookName} 2024 OR 2025 OR 最新版`,
          `${task.bookName} 注释版 OR 校注 OR 白话译`,
          `${task.bookName} 电子版 OR 扫描版 OR 影印版`,
        ],
      },
    ];

    let noNewResultCount = 0;
    let roundIndex = 0;
    const searchStartTime = Date.now();
    // 🔴🔴🔴 用户铁规则：搜遍全网，搜无数遍，直到真的找不到才停
    // 不存在"凑够 N 个来源就停"——这种早退只能凑出半本书
    // 唯一退出条件：连续 1 个完整 16 轮 cycle 跑完都没有任何新结果（= 真的 nowhere new to find）
    const TOTAL_ROUNDS = searchRounds.length; // 16轮

    let completedFullCycles = 0;
    let resultsInCurrentCycle = 0;
    let consecutiveEmptyCycles = 0;

    // 🚀🚀🚀 快速通道（默认开启）：
    // 大陆 VPS 对外网搜索引擎被反爬封锁，21 轮搜索循环注定 0 来源（每轮还要等 1.5s × N query × 12s timeout）
    // 浪费 5-10 分钟时间换 0 收益，毫无意义。
    // 通过 SKIP_FUTILE_SEARCH=false 可强制走完整 21 轮（仅用于调试）
    const SKIP_FUTILE_SEARCH = (process.env.SKIP_FUTILE_SEARCH ?? 'true') !== 'false';
    if (SKIP_FUTILE_SEARCH) {
      addLog(taskId, `[快速通道] 大陆 VPS 搜索引擎已被反爬封锁，跳过 ${TOTAL_ROUNDS} 轮无效搜索循环，直接进兜底层（已知数据源 + LLM 知识兜底）`);
      updateTask(taskId, {
        message: `🚀 跳过 ${TOTAL_ROUNDS} 轮无效搜索，直接启用 LLM 知识兜底（已知数据源 + 大模型背诵）...`,
        progress: 2,
      });
    }

    // 🔴🔴🔴 退出条件：跑完一个完整 cycle 且本轮无新结果（真正穷尽全网）
    while (!SKIP_FUTILE_SEARCH && consecutiveEmptyCycles < 1) {
      // 🔴 检查暂停/取消
      const checkResult = checkTaskControl(taskId);
      if (checkResult === 'cancelled') return;
      if (checkResult === 'paused') break; // 退出搜索循环，暂停

      const round = searchRounds[roundIndex % TOTAL_ROUNDS];
      const beforeCount = allResults.length;

      // 每开始一轮就更新 message，让用户看到正在动
      updateTask(taskId, { message: `🔎 第${roundIndex + 1}轮「${round.name}」搜索中（已收集 ${allResults.length} 个来源，穷尽全网中）...` });

      for (let qi = 0; qi < round.queries.length; qi++) {
        const query = round.queries[qi];
        // 🔴 每个查询前也检查暂停/取消
        const qCheck = checkTaskControl(taskId);
        if (qCheck === 'cancelled') return;
        if (qCheck === 'paused') break;

        try {
          const response = await withTimeout(searchClient.webSearch(query, 10), 12000);
          if (response?.web_items) {
            for (const r of response.web_items) {
              if (r.url && !allResults.some(x => x.url === r.url)) {
                allResults.push({ url: r.url, title: r.title || '', snippet: r.snippet || '' });
              }
            }
          }
        } catch {
          // 继续搜索下一个
        }
        // 每个查询完成都刷一下 message，让用户看到累计来源数在动
        updateTask(taskId, {
          message: `🔎 第${roundIndex + 1}轮「${round.name}」${qi + 1}/${round.queries.length}（累计 ${allResults.length} 个来源，继续穷尽全网）`,
        });

        // 每个查询之间间隔1.5秒，避免触发搜索API限流
        await new Promise(r => setTimeout(r, 1500));
      }

      const newResults = allResults.length - beforeCount;
      resultsInCurrentCycle += newResults;

      if (newResults > 0) {
        addLog(taskId, `第${roundIndex + 1}轮「${round.name}」发现 ${newResults} 个新来源，累计 ${allResults.length} 个`);
      } else {
        addLog(taskId, `第${roundIndex + 1}轮「${round.name}」未发现新来源`);
      }

      roundIndex++;

      // 检查是否完成了一个完整循环
      if (roundIndex % TOTAL_ROUNDS === 0) {
        completedFullCycles++;
        addLog(taskId, `完成第${completedFullCycles}轮完整搜索循环，${resultsInCurrentCycle > 0 ? `发现 ${resultsInCurrentCycle} 个新来源` : '未发现新来源'}，${resultsInCurrentCycle > 0 ? '继续搜' : '本轮无新结果'}`);
        if (resultsInCurrentCycle > 0) {
          consecutiveEmptyCycles = 0; // 有新结果就重置
        } else {
          consecutiveEmptyCycles++; // 无新结果就累计
          addLog(taskId, `连续 ${consecutiveEmptyCycles}/3 个完整循环无新结果`);
        }
        resultsInCurrentCycle = 0;
        // 🔴 唯一停止条件：连续3个完整循环都没有新结果 = 真正穷尽了
      }

      // 🔴 搜索次数无上限！只要还在发现新结果，就继续搜
      // 不设轮次上限，想搜多少次搜多少次
    }

    const searchElapsed = Math.round((Date.now() - searchStartTime) / 1000);
    addLog(taskId, `搜索完成：共 ${roundIndex} 轮（${completedFullCycles}个完整循环），耗时 ${searchElapsed}秒，累计 ${allResults.length} 个来源`);

    // 🟢 兜底层 1：已知数据源（KNOWN_BOOK_SOURCES）—— 不依赖搜索引擎，直接拿真实 URL
    if (allResults.length === 0) {
      addLog(taskId, `[兜底1] 搜索引擎全 0 条，查询已知数据源库...`);
      try {
        const { lookupKnownBookSources } = await import('./coze-replacement/known-book-sources');
        const knownSources = lookupKnownBookSources(task.bookName);
        if (knownSources.length > 0) {
          for (const src of knownSources) {
            allResults.push({
              url: src.url,
              title: `${task.bookName} - ${src.source}`,
              snippet: `已知数据源 ${src.source} 提供的《${task.bookName}》页面`,
            });
          }
          addLog(taskId, `[兜底1] ✅ 命中已知数据源，新增 ${knownSources.length} 条 URL`);
          updateTask(taskId, {
            status: 'searching',
            message: `已知数据源命中 ${knownSources.length} 条，开始抓取内容...`,
            progress: 3,
          });
        } else {
          addLog(taskId, `[兜底1] 未命中已知数据源`);
        }
      } catch (e) {
        addLog(taskId, `[兜底1] 已知数据源查询出错: ${(e as Error).message}`);
      }
    }

    // 🟢 兜底层 2：LLM 知识库 —— 用大模型背诵古籍原文
    if (allResults.length === 0) {
      addLog(taskId, `[兜底2] 已知数据源也空，启动 LLM 知识兜底...`);
      updateTask(taskId, {
        status: 'searching',
        message: `🟢 启动 LLM 知识兜底，让大模型直接背诵《${task.bookName}》全文...`,
        progress: 5,
      });
      try {
        const llmContent = await generateBookContentByLLM(task.bookName, taskId);
        if (llmContent && llmContent.length > 1000) {
          addBookToKnowledgeBase(task.bookName, llmContent);
          addLog(taskId, `[兜底2] ✅ LLM 生成 ${llmContent.length} 字内容，已录入知识库`);
          updateTask(taskId, {
            status: 'done',
            message: `✅ LLM 知识兜底完成录入：共 ${llmContent.length} 字`,
            progress: 100,
            completedAt: Date.now(),
          });
          return;
        } else {
          addLog(taskId, `[兜底2] LLM 返回内容过短（${llmContent?.length || 0} 字），判定为冷门书`);
        }
      } catch (e) {
        addLog(taskId, `[兜底2] LLM 兜底失败: ${(e as Error).message}`);
      }
    }

    // 只有一种情况判定版权问题：全网所有渠道全部搜遍，确认找不到
    if (allResults.length === 0) {
      updateTask(taskId, {
        status: 'copyright',
        message: `已穷尽全网搜索（${completedFullCycles}轮完整循环×${TOTAL_ROUNDS}个渠道=共${roundIndex}轮搜索），并启用已知数据源+LLM知识兜底，均未找到《${task.bookName}》的完整内容`,
        progress: 0,
        completedAt: Date.now(),
      });
      addLog(taskId, `共${roundIndex}轮搜索+已知数据源+LLM均未找到此书，判定为版权问题`);
      return;
    }

    addLog(taskId, `共搜索到 ${allResults.length} 个来源，开始逐一尝试获取内容`);

    // 3. 确认原书章节数（搜索"书名 目录"获取原书结构）
    updateTask(taskId, {
      status: 'searching',
      message: `正在确认《${task.bookName}》原书章节结构...`,
      progress: 3,
    });

    let confirmedChapterInfo: ConfirmedChapters | null = null;

    try {
      // 🔴🔴🔴 权威目录探测：先去权威站点拿"原书应有总章数"
      // 站点池：百度百科 / 中文维基 / 豆瓣读书 / 中华典藏目录 / 国学大师
      // 目的：让"尾部整段缺失"（原书60章但只搜到50章）也能被识别
      const authoritativeQueries = [
        `${task.bookName} site:baike.baidu.com`,
        `${task.bookName} site:zh.wikipedia.org`,
        `${task.bookName} site:book.douban.com`,
        `${task.bookName} 目录 site:zhonghuadiancang.com`,
        `${task.bookName} 目录 site:guoxuedashi.net`,
        `${task.bookName}`, // 通用兜底
      ];

      let fullTocContent = '';
      const authoritativeTexts: string[] = [];
      // 并行跑权威查询
      const authResponses = await Promise.all(
        authoritativeQueries.map(q => withTimeout(searchClient.webSearch(q, 10), 12000))
      );
      const seenAuthUrls = new Set<string>();
      const authItems: Array<{ url: string; title: string; snippet: string }> = [];
      for (const resp of authResponses) {
        if (!resp?.web_items) continue;
        for (const item of resp.web_items) {
          const title = item.title || '';
          const snippet = item.snippet || '';
          authoritativeTexts.push(`${title} ${snippet}`);
          if (item.url && !seenAuthUrls.has(item.url)) {
            seenAuthUrls.add(item.url);
            authItems.push({ url: item.url, title, snippet });
          }
        }
      }
      fullTocContent = authoritativeTexts.join('\n');

      // 优先抓权威站点页面正文（百科/维基/豆瓣最先）
      const priorityHosts = ['baike.baidu.com', 'wikipedia.org', 'douban.com', 'zhonghuadiancang.com', 'guoxuedashi.net'];
      const priorityItems = authItems
        .filter(it => priorityHosts.some(h => it.url.includes(h)))
        .slice(0, 4);
      for (const item of priorityItems) {
        try {
          const tocFetch = await withTimeout(fetchClient.fetch(item.url), 12000);
          if (tocFetch && Array.isArray(tocFetch.content)) {
            const tocText = tocFetch.content
              .filter((c: FetchContentItem): c is FetchContentItem & { text: string } => c.type === 'text' && typeof c.text === 'string')
              .map((c: FetchContentItem & { text: string }) => c.text)
              .join('\n');
            fullTocContent += '\n' + tocText;
          }
        } catch { /* continue */ }
      }
      // 兜底再抓 2 个通用结果
      for (const item of authItems.filter(it => !priorityHosts.some(h => it.url.includes(h))).slice(0, 2)) {
        try {
          const tocFetch = await withTimeout(fetchClient.fetch(item.url), 12000);
          if (tocFetch && Array.isArray(tocFetch.content)) {
            const tocText = tocFetch.content
              .filter((c: FetchContentItem): c is FetchContentItem & { text: string } => c.type === 'text' && typeof c.text === 'string')
              .map((c: FetchContentItem & { text: string }) => c.text)
              .join('\n');
            fullTocContent += '\n' + tocText;
          }
        } catch { /* continue */ }
      }

      // 第一步：从描述文本里提取"全书共XX章/卦/卷"这种总数说法
      const declaredTotal = extractDeclaredChapterTotal(fullTocContent);
      // 第二步：解析目录中实际出现的章节
      const detected = detectBookChapters(fullTocContent);

      // 合成最终的"权威应有章数"
      // 优先级：明确声明的总数 > 目录扫描出的最大章号
      let finalTotal = 0;
      let finalStructure = detected.structureType || '章';
      if (declaredTotal && declaredTotal.total >= 3) {
        finalTotal = declaredTotal.total;
        finalStructure = declaredTotal.unit || finalStructure;
        addLog(taskId, `📚 权威站点声明：原书共 ${declaredTotal.total} ${declaredTotal.unit}`);
      } else if (detected.totalChapters >= 3) {
        finalTotal = detected.totalChapters;
        finalStructure = detected.structureType || '章';
        addLog(taskId, `📚 目录扫描结果：识别到 ${detected.totalChapters} ${detected.structureType || '章'}`);
      }

      if (finalTotal >= 3) {
        confirmedChapterInfo = {
          totalChapters: finalTotal,
          structureType: finalStructure,
          chapterNames: detected.chapterNames.length > 0 ? detected.chapterNames : [],
        };
        // 立即更新结构信息，让前端可以显示原书叫法
        updateTask(taskId, {
          chapterStructure: finalStructure,
          totalChapters: finalTotal,
        });
        addLog(taskId, `确认原书章节: 共 ${finalTotal} ${finalStructure}（权威目录探测）`);
      } else {
        addLog(taskId, '权威目录探测未能确认总章数，后续将从下载内容推断');
      }
    } catch {
      // 确认失败不影响后续流程
      addLog(taskId, '权威目录探测异常，后续将从内容中推断');
    }

    // 4. 逐个来源获取内容，支持跨网站拼接（不要求一个网站必须包含全部内容）
    let bookContent = '';
    let usedSource = '';
    let foundContent = false;
    const contentFragments: { source: string; content: string }[] = []; // 收集所有来源的内容片段

    // 🔴🔴🔴 先加入 Book Finder 技能获取的内容（如果有）
    if (bookFinderContent) {
      contentFragments.push({ source: 'Book Finder 爬虫', content: bookFinderContent });
      foundContent = true;
      addLog(taskId, `📱 Book Finder 内容已加入拼接队列（${bookFinderContent.length}字）`);
    }

    updateTask(taskId, {
      status: 'downloading',
      message: `找到 ${allResults.length} 个来源，正在逐一获取内容...`,
      progress: 5,
    });

    for (let i = 0; i < allResults.length; i++) {
      // 暂停/取消检查
      const suspended = checkTaskControl(taskId);
      if (suspended === 'paused' || suspended === 'cancelled') return;
      if (!processingQueue.has(taskId)) {
        addLog(taskId, '任务被取消');
        return;
      }

      const source = allResults[i];
      addLog(taskId, `尝试来源 ${i + 1}/${allResults.length}: ${source.url}`);
      
      updateTask(taskId, {
        message: `正在获取 (${i + 1}/${allResults.length})...`,
        progress: 5 + Math.floor((i / allResults.length) * 15),
        source: source.url,
      });

      try {
        const fetchResponse = await fetchClient.fetch(source.url);
        if (fetchResponse?.content) {
          const texts = fetchResponse.content
            .map((c: { text?: string }) => c.text || '')
            .filter((t: string) => t.trim().length > 100);
          
          if (texts.length > 0) {
            const content = texts.join('\n\n');
            // 收集所有来源的内容（用于跨网站拼接）
            contentFragments.push({ source: source.url, content });
            addLog(taskId, `从 ${source.url} 获取到 ${content.length} 字符`);
            
            // 如果单个来源足够长，直接用
            if (content.length > bookContent.length) {
              bookContent = content;
              usedSource = source.url;
            }
          }
        }
      } catch (e) {
        addLog(taskId, `来源 ${source.url} 获取失败: ${e instanceof Error ? e.message : String(e)}，继续尝试下一个`);
      }
    }

    // 🔥 跨网站拼接：只要有 2 个以上来源，无脑全部拼接（不限字数门槛）
    // 用户要求：从第一页第一个字到最后一页最后一个字，一个字都不能少
    if (contentFragments.length >= 2) {
      addLog(taskId, `共收集 ${contentFragments.length} 个来源，开始跨网站拼接合并全部内容...`);
      const mergedAll = mergeContentFragments(contentFragments, taskId);
      // 取拼接结果与单源最长两者更长者
      if (mergedAll.length > bookContent.length) {
        bookContent = mergedAll;
        usedSource = contentFragments.map(f => f.source).join(' + ');
        addLog(taskId, `✅ 跨源拼接成功，总内容: ${bookContent.length} 字符`);
      } else {
        addLog(taskId, `单源已优于拼接（${bookContent.length} > ${mergedAll.length}），保留单源`);
      }
    }

    // 铁规则：所有来源都试过了但内容不够长，继续追加搜索第二轮
    if (!foundContent && allResults.length > 0 && bookContent.length >= 200 && bookContent.length < 2000) {
      addLog(taskId, `已试 ${allResults.length} 个来源，最长内容仅 ${bookContent.length} 字符，追加搜索第二轮`);
      
      const round2Queries = [
        `${task.bookName} 全文 在线阅读`,
        `${task.bookName} 完整版 免费阅读`,
        `${task.bookName} txt 下载`,
        `${task.bookName} 电子书 完整 全文`,
      ];
      
      for (const query of round2Queries) {
        try {
          const response = await searchClient.webSearch(query, 10);
          if (response?.web_items) {
            for (const r of response.web_items) {
              if (r.url && !allResults.some(x => x.url === r.url)) {
                allResults.push({ url: r.url, title: r.title || '', snippet: r.snippet || '' });
              }
            }
          }
        } catch (e) {
          // 继续
        }
      }
      
      // 尝试新找到的来源，收集内容片段用于拼接
      for (let i = 0; i < allResults.length; i++) {
        if (processingQueue.has(taskId) === false) return;
        const source = allResults[i];
        try {
          const fetchResponse = await fetchClient.fetch(source.url);
          if (fetchResponse?.content) {
            const texts = fetchResponse.content
              .map((c: { text?: string }) => c.text || '')
              .filter((t: string) => t.trim().length > 100);
            if (texts.length > 0) {
              const content = texts.join('\n\n');
              contentFragments.push({ source: source.url, content });
              if (content.length > bookContent.length) {
                bookContent = content;
                usedSource = source.url;
              }
              addLog(taskId, `第二轮从 ${source.url} 获取到 ${content.length} 字符`);
            }
          }
        } catch (e) {
          // 继续
        }
      }
      
      // 第二轮结束后也尝试拼接
      if (bookContent.length < 2000 && contentFragments.length >= 2) {
        addLog(taskId, `第二轮后最长 ${bookContent.length} 字符，尝试拼接 ${contentFragments.length} 个来源...`);
        bookContent = mergeContentFragments(contentFragments, taskId);
        usedSource = contentFragments.map(f => f.source).join(' + ');
        addLog(taskId, `第二轮拼接后总内容: ${bookContent.length} 字符`);
      }
    }

    // 判定是否找到足够内容（拼接后可能足够长）
    if (bookContent.length >= 2000) {
      foundContent = true;
    }
    // 第三种判定：有内容但不够长，也接受（宁可录入部分内容也不放弃）
    if (!foundContent && bookContent.length >= 200) {
      foundContent = true;
      addLog(taskId, `内容较短（${bookContent.length}字符），但仍录入知识库`);
    }

    // 只有一种情况判定版权问题：全网所有网站都搜过了、都试过了，确认 nowhere to be found
    if (!foundContent || bookContent.length < 200) {
      updateTask(taskId, {
        status: 'copyright',
        message: `已穷尽全网搜索并逐一尝试 ${allResults.length} 个来源获取《${task.bookName}》，搜索引擎(百度/搜狗/必应/360)每一页结果都翻完+文档平台(百度文库/道客巴巴/豆丁)+社区(知乎/豆瓣/贴吧/微博)+古籍数据库+网盘书源全部搜遍，确认 nowhere to be found，均未找到完整内容`,
        progress: 0,
        completedAt: Date.now(),
      });
      addLog(taskId, `遍历 ${allResults.length} 个来源、${roundIndex}轮搜索后均未获取到有效内容，判定为版权问题`);
      return;
    }

    // 4. 翻译（如果需要）
    // 🔥 完整性补救循环：用户要求"录就要录全本"，字数不达标自动跨网站继续搜
    const MIN_COMPLETE_CHARS = 30000;
    const MAX_SUPPLEMENT_ROUNDS = 5;
    let supplementRound = 0;
    while (bookContent.length < MIN_COMPLETE_CHARS && supplementRound < MAX_SUPPLEMENT_ROUNDS) {
      supplementRound++;
      const beforeChars = bookContent.length;
      updateTask(taskId, {
        status: 'searching',
        message: `⚠️ 当前仅 ${beforeChars} 字（不足完整书量），第 ${supplementRound}/${MAX_SUPPLEMENT_ROUNDS} 轮跨网站补搜中...`,
        progress: 20,
      });
      addLog(taskId, `🔁 补救轮 #${supplementRound}: 当前 ${beforeChars} 字，继续跨网站搜索补齐`);

      const supplementQueries = [
        `"${task.bookName}" 全文 txt`,
        `"${task.bookName}" 完整版 下载`,
        `"${task.bookName}" pdf 电子书`,
        `${task.bookName} 在线阅读 全本`,
        `${task.bookName} 全文 章节`,
        `${task.bookName} 目录 完整`,
        `${task.bookName} site:zhuanlan.zhihu.com`,
        `${task.bookName} site:douban.com`,
        `${task.bookName} site:book.douban.com`,
        `${task.bookName} site:ishare.iask.sina.com.cn`,
        `${task.bookName} site:wenku.baidu.com`,
        `${task.bookName} site:max.book118.com`,
      ];

      const newSources: { url: string; title: string; snippet: string }[] = [];
      const seenUrls = new Set(allResults.map(r => r.url));
      for (const q of supplementQueries) {
        try {
          const resp = await withTimeout(searchClient.webSearch(q, 10), 12000);
          if (resp?.web_items) {
            for (const r of resp.web_items) {
              if (r.url && !seenUrls.has(r.url)) {
                seenUrls.add(r.url);
                newSources.push({ url: r.url, title: r.title || '', snippet: r.snippet || '' });
                allResults.push({ url: r.url, title: r.title || '', snippet: r.snippet || '' });
              }
            }
          }
        } catch {
          // 单包失败不影响整体
        }
      }
      addLog(taskId, `补救轮 #${supplementRound} 找到 ${newSources.length} 个新来源`);

      if (newSources.length === 0) {
        addLog(taskId, `补救轮 #${supplementRound} 无新来源，停止补救`);
        break;
      }

      updateTask(taskId, {
        status: 'downloading',
        message: `📥 补救轮 ${supplementRound}：从 ${newSources.length} 个新来源拉取内容...`,
      });

      for (let i = 0; i < newSources.length; i++) {
        const suspended = checkTaskControl(taskId);
        if (suspended === 'paused' || suspended === 'cancelled') break;
        const source = newSources[i];
        try {
          const fetchResponse = await fetchClient.fetch(source.url);
          if (fetchResponse?.content) {
            const texts = fetchResponse.content
              .map((c: { text?: string }) => c.text || '')
              .filter((t: string) => t.trim().length > 100);
            if (texts.length > 0) {
              const content = texts.join('\n\n');
              contentFragments.push({ source: source.url, content });
              addLog(taskId, `补救：从 ${source.url} 又拿到 ${content.length} 字符`);
            }
          }
        } catch {
          // 单源失败继续
        }
      }

      // 重新跨源合并
      const mergedSupplement = mergeContentFragments(contentFragments, taskId);
      if (mergedSupplement.length > bookContent.length) {
        bookContent = mergedSupplement;
        usedSource = contentFragments.map(f => f.source).join(' + ');
        addLog(taskId, `补救轮 #${supplementRound} 拼接后总内容: ${bookContent.length} 字符（+${bookContent.length - beforeChars}）`);
      } else {
        addLog(taskId, `补救轮 #${supplementRound} 未带来字数增长，停止补救`);
        break;
      }
    }

    // 4. 翻译为中文（如有外文）
    const cnChars = [...bookContent.substring(0, 2000)].filter(c => /[\u4e00-\u9fa5]/.test(c)).length;
    const enChars = [...bookContent.substring(0, 2000)].filter(c => c.toLowerCase() >= 'a' && c.toLowerCase() <= 'z').length;
    const needsTranslation = cnChars < enChars * 2;

    if (needsTranslation) {
      updateTask(taskId, {
        status: 'translating',
        message: `正在翻译《${task.bookName}》为中文...`,
        progress: 25,
      });
      addLog(taskId, '检测到外文内容，开始翻译');

      bookContent = await translateContent(taskId, bookContent);
    }

    // 🔴🔴🔴 缺章定向补搜：基于权威目录探测的"应有总章数"找出当前缺失的章，
    // 对每个缺章生成定向 query 去全网找，找到就拼接回正文。
    // 用户铁规则：必须真的"全网都搜，搜无数遍，搜不到才判缺章节"
    const expectedStructure = confirmedChapterInfo?.structureType || detectBookChapters(bookContent).structureType || '';
    const expectedTotalChapters = confirmedChapterInfo?.totalChapters || 0;
    if (expectedTotalChapters >= 3 && expectedStructure) {
      const primaryUnit = expectedStructure.split(/[\/+·]/)[0] || expectedStructure;
      const supportedUnits = ['章', '卦', '卷', '篇', '回', '部', '辑', '节'];
      if (supportedUnits.includes(primaryUnit)) {
        let missingNow = detectMissingChapters(bookContent, expectedStructure, expectedTotalChapters);
        if (missingNow.missingIndices.length > 0) {
          updateTask(taskId, {
            status: 'searching',
            message: `🎯 已发现 ${missingNow.missingIndices.length} 个缺章，对每章逐一全网定向补搜...`,
            progress: 30,
          });
          addLog(taskId, `🎯 进入缺章定向补搜阶段：缺 ${missingNow.missingIndices.length} 个 ${primaryUnit}（${missingNow.missingNames.slice(0, 10).join('、')}${missingNow.missingNames.length > 10 ? '...' : ''}）`);

          const chapterSiteDomains = ALL_SITE_DOMAINS.slice(0, 12); // 取前 12 个站点跑定向
          // 限制单次补搜的章节数量上限，避免一本巨大书目卡死（≤200 章）
          const targets = missingNow.missingIndices.slice(0, 200);
          const seenAllUrls = new Set(allResults.map(r => r.url));
          let supplementedChapters = 0;

          for (let mi = 0; mi < targets.length; mi++) {
            const ctrl = checkTaskControl(taskId);
            if (ctrl === 'cancelled') return;
            if (ctrl === 'paused') break;

            const chapterIdx = targets[mi];
            const chapterName = missingNow.missingNames[mi];
            updateTask(taskId, {
              message: `🎯 定向补搜 ${mi + 1}/${targets.length}：${chapterName}（已补回 ${supplementedChapters}）`,
            });

            // 为这一缺章构造多种 query
            const chapterQueries = [
              `${task.bookName} ${chapterName}`,
              `${task.bookName} ${chapterName} 全文`,
              `${task.bookName} 第${chapterIdx}${primaryUnit}`,
              `《${task.bookName}》${chapterName}`,
              ...chapterSiteDomains.map(domain => `${task.bookName} ${chapterName} site:${domain}`),
            ];

            const newUrlsForChapter: string[] = [];
            // 并行跑该章节的所有 query
            const responses = await Promise.all(
              chapterQueries.map(q => withTimeout(searchClient.webSearch(q, 5), 10000))
            );
            for (const resp of responses) {
              if (!resp?.web_items) continue;
              for (const item of resp.web_items) {
                if (item.url && !seenAllUrls.has(item.url)) {
                  seenAllUrls.add(item.url);
                  newUrlsForChapter.push(item.url);
                  allResults.push({ url: item.url, title: item.title || '', snippet: item.snippet || '' });
                }
              }
            }

            // 抓取前 8 个新 URL 看看包不包含这一章节文本
            let chapterFound = false;
            for (const url of newUrlsForChapter.slice(0, 8)) {
              const ctrl2 = checkTaskControl(taskId);
              if (ctrl2 === 'cancelled') return;
              if (ctrl2 === 'paused') break;
              try {
                const fetchResp = await withTimeout(fetchClient.fetch(url), 12000);
                if (!fetchResp?.content) continue;
                const texts = (fetchResp.content as Array<{ text?: string }>)
                  .map(c => c.text || '')
                  .filter(t => t.trim().length > 100);
                if (texts.length === 0) continue;
                const content = texts.join('\n\n');
                // 严格判断：内容里必须真的出现"第X章/卦/..."这一标记
                const chapterMarker = new RegExp(`第\\s*${chapterIdx}\\s*${primaryUnit}|第${chineseNumeral(chapterIdx)}${primaryUnit}`);
                if (chapterMarker.test(content)) {
                  contentFragments.push({ source: url, content });
                  chapterFound = true;
                  supplementedChapters++;
                  addLog(taskId, `✅ 补回 ${chapterName}：来自 ${url}`);
                  break;
                }
              } catch { /* continue */ }
            }
            if (!chapterFound) {
              addLog(taskId, `⏳ ${chapterName}：本轮未找到，将累积到最终缺章列表`);
            }
          }

          // 全部缺章跑完后，重新跨源合并
          if (supplementedChapters > 0) {
            const remerged = mergeContentFragments(contentFragments, taskId);
            if (remerged.length > bookContent.length) {
              bookContent = remerged;
              usedSource = contentFragments.map(f => f.source).join(' + ');
              addLog(taskId, `🎯 定向补搜后跨源合并：bookContent 增长到 ${bookContent.length} 字符`);
            }
            // 重新检测缺章
            missingNow = detectMissingChapters(bookContent, expectedStructure, expectedTotalChapters);
            addLog(taskId, `🎯 定向补搜完成：成功补回 ${supplementedChapters} 章，仍缺 ${missingNow.missingIndices.length} 章`);
          } else {
            addLog(taskId, `🎯 定向补搜完成：全网穷尽，没有任何缺章被补回`);
          }
        } else {
          addLog(taskId, `✅ 与权威目录比对：无缺章`);
        }
      }
    }

    // 5. 分章摘录入库
    updateTask(taskId, {
      status: 'saving',
      message: `正在摘录《${task.bookName}》到知识库...`,
      progress: 50,
    });
    addLog(taskId, '开始分章摘录');

    await saveWithProgress(taskId, bookContent, confirmedChapterInfo);

    // 6. 完成
    const sizeKB = (Buffer.byteLength(bookContent, 'utf-8') / 1024).toFixed(1);
    const detectedFromContent = detectBookChapters(bookContent);
    const finalChapterInfo = confirmedChapterInfo || detectedFromContent;
    const finalChapterCount = finalChapterInfo.totalChapters;
    const finalChapterNames = finalChapterInfo.chapterNames.map((name: string, i: number) => ({
      name,
      index: i + 1,
    }));

    // 🔴 缺失章节检测：优先用权威目录探测到的"应有总章数"作为基准
    // 这样尾部整段缺失（如原书 60 章但只搜到 50 章）也能被识别
    const authoritativeTotal = confirmedChapterInfo?.totalChapters || 0;
    const missingInfo = detectMissingChapters(
      bookContent,
      finalChapterInfo.structureType,
      authoritativeTotal >= 3 ? authoritativeTotal : undefined,
    );
    const hasMissing = missingInfo.missingNames.length > 0;
    if (hasMissing) {
      addLog(
        taskId,
        `⚠️ 检测到缺失：原书应有 ${missingInfo.maxIndex} ${finalChapterInfo.structureType}，` +
        `实际录入 ${missingInfo.presentIndices.length}，缺失 ${missingInfo.missingNames.length} 个：` +
        `${missingInfo.missingNames.slice(0, 10).join('、')}${missingInfo.missingNames.length > 10 ? '...' : ''}`
      );
    }

    updateTask(taskId, {
      status: 'done',
      message: hasMissing
        ? `《${task.bookName}》已录入（⚠️ 缺 ${missingInfo.missingNames.length} ${finalChapterInfo.structureType}，已穷尽所有网站仍未找到）`
        : `《${task.bookName}》已完整录入知识库，准备开始AI学习...`,
      progress: 100,
      totalChapters: hasMissing ? missingInfo.maxIndex : finalChapterCount,
      currentChapter: finalChapterCount,
      remainingChapters: hasMissing ? missingInfo.missingNames.length : 0,
      source: usedSource,
      size: `${sizeKB}KB`,
      chars: bookContent.length,
      completedAt: Date.now(),
      chapterStructure: finalChapterInfo.structureType,
      chapters: finalChapterNames.map((ch: { name: string; index: number }, i: number) => ({
        name: ch.name,
        type: finalChapterInfo.structureType,
        startIndex: i,
      })),
      hasMissingChapters: hasMissing,
      missingChapterNames: missingInfo.missingNames,
    });
    addLog(taskId, `摘录完成: ${finalChapterCount} ${finalChapterInfo.structureType}, ${bookContent.length} 字`);

    // 7. 录入完成后【不自动学习】，置为"待学习"状态，等待用户在知识库手动点击"开始学习"
    updateTask(taskId, {
      learningStatus: 'pending',
      learningProgress: 0,
      learningMessage: '⏳ 待学习（请在知识库点击"开始学习"按钮）',
    });
    addLog(taskId, '录入完成，进入知识库待学习队列（等待用户手动触发学习）');

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    updateTask(taskId, {
      status: 'failed',
      message: `摘录失败: ${errMsg}`,
      error: errMsg,
      completedAt: Date.now(),
    });
    addLog(taskId, `错误: ${errMsg}`);
  } finally {
    processingQueue.delete(taskId);
  }
}

// ==================== 跨网站内容拼接 ====================

/**
 * 将多个来源的内容片段拼接成完整书籍
 * 策略：以最长的片段为基底，将其他片段中不重复的内容追加
 */
function mergeContentFragments(fragments: { source: string; content: string }[], taskId: string): string {
  if (fragments.length === 0) return '';
  if (fragments.length === 1) return fragments[0].content;

  // 按内容长度排序，最长的在前面
  const sorted = [...fragments].sort((a, b) => b.content.length - a.content.length);
  
  // 以最长的内容为基底
  let merged = sorted[0].content;
  addLog(taskId, `拼接基底: 来源 ${sorted[0].source}, ${merged.length} 字符`);

  // 将其他片段中不重复的内容追加
  for (let i = 1; i < sorted.length; i++) {
    const fragment = sorted[i].content;
    
    // 检查这个片段是否已经被基底包含（取前100字符做指纹比对）
    const fingerprint = fragment.substring(0, 100).trim();
    if (fingerprint.length > 20 && merged.includes(fingerprint)) {
      addLog(taskId, `片段 ${i} (来源: ${sorted[i].source}, ${fragment.length}字符) 已包含在基底中，跳过`);
      continue;
    }
    
    // 取片段的后半部分（假设前半部分和基底重叠，后半部分是新内容）
    // 用滑动窗口找最佳拼接点
    const overlapLen = findBestOverlap(merged, fragment);
    if (overlapLen > 50) {
      // 有重叠，只追加不重叠的部分
      const newPart = fragment.substring(overlapLen);
      if (newPart.trim().length > 100) {
        merged += '\n\n' + newPart;
        addLog(taskId, `片段 ${i} 与基底重叠 ${overlapLen} 字符，追加 ${newPart.length} 字符新内容`);
      }
    } else {
      // 没有明显重叠，直接追加（用分隔线隔开）
      if (fragment.trim().length > 100) {
        merged += '\n\n———（以下内容来自其他来源）———\n\n' + fragment;
        addLog(taskId, `片段 ${i} 无重叠，直接追加 ${fragment.length} 字符`);
      }
    }
  }

  return merged;
}

/**
 * 查找两个文本的最佳重叠位置
 * 从短文本的开头取一段，在长文本的末尾搜索最匹配的位置
 */
function findBestOverlap(baseText: string, fragmentText: string): number {
  // 在基底的最后30%范围内搜索重叠
  const searchStart = Math.floor(baseText.length * 0.7);
  const searchRegion = baseText.substring(searchStart);
  
  let bestOverlap = 0;
  // 取片段开头不同长度的子串去搜索
  for (const len of [200, 150, 100, 50]) {
    if (fragmentText.length < len) continue;
    const probe = fragmentText.substring(0, len).trim();
    if (probe.length < 20) continue;
    
    const idx = searchRegion.lastIndexOf(probe);
    if (idx !== -1) {
      // 找到了重叠，计算实际重叠长度
      const overlapStart = searchStart + idx;
      bestOverlap = Math.max(bestOverlap, baseText.length - overlapStart);
      break;
    }
  }
  
  return bestOverlap;
}

// ==================== 翻译 ====================

/**
 * 🟢 LLM 知识兜底：当所有搜索源都失败时，让大模型直接背诵古籍原文
 * 主流大模型（豆包/DeepSeek/Kimi/GPT-4）都能背诵《滴天髓》《三命通会》等经典玄学古籍
 */
async function generateBookContentByLLM(bookName: string, taskId: string): Promise<string> {
  const config = new Config();
  const llm = new LLMClient(config);

  // Step 1: 先问 LLM 是否知道这本书 + 列出章节目录
  addLog(taskId, `[LLM兜底] 询问大模型《${bookName}》的章节目录...`);
  const tocResp = await llm.invoke([
    { role: 'system', content: '你是中国古籍专家，精通历代命理、相术、占卜、风水、易学典籍。' },
    {
      role: 'user',
      content: `请判断你是否熟知《${bookName}》这本古籍。
如果不知道或不熟悉，请只回复"不知道"三个字。
如果熟悉，请按以下格式列出该书的完整章节/卷/篇目录，每行一项：
1. 第一卷·卷名
2. 第二卷·卷名
...
要求：
- 只列章节，不要任何解释
- 至少 5 个章节，最多 50 个
- 如果是单卷书，按"章"或"篇"细分`,
    },
  ], { temperature: 0.3 });

  const tocContent = (tocResp.content || '').trim();
  // 只在明确表示"不知道"且没有任何章节列表时放弃；其他情况都继续尝试
  const looksLikeReject = /^(不知道|抱歉|对不起|我不熟悉|无法[^一-龥]|没有[^一-龥])/.test(tocContent.slice(0, 30))
    && !/[一二三四五六七八九十\d]+[卷章篇]/.test(tocContent);
  if (!tocContent || tocContent.length < 30 || looksLikeReject) {
    addLog(taskId, `[LLM兜底] LLM 拒答或不熟悉：${tocContent.slice(0, 100)}`);
    return '';
  }

  // 解析章节列表
  const chapters = tocContent
    .split('\n')
    .map(l => l.replace(/^\d+[\.、\s]*/, '').replace(/^[-*•·]\s*/, '').trim())
    .filter(l => l.length > 1 && l.length < 80);

  if (chapters.length < 3) {
    addLog(taskId, `[LLM兜底] LLM 返回章节数过少（${chapters.length}），疑似不熟悉此书`);
    return '';
  }

  addLog(taskId, `[LLM兜底] LLM 列出 ${chapters.length} 个章节，开始逐章生成内容...`);

  const buffer: string[] = [];
  buffer.push(`# ${bookName}\n\n## 章节目录\n${chapters.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n---\n`);

  const maxChapters = Math.min(chapters.length, 40);
  for (let i = 0; i < maxChapters; i++) {
    const ch = chapters[i];
    try {
      const chapResp = await llm.invoke([
        { role: 'system', content: '你是中国古籍原文录入员，精通历代典籍。请尽可能完整地输出原文（文言文）。' },
        {
          role: 'user',
          content: `请输出《${bookName}》一书中"${ch}"这一卷/篇/章的完整原文。
要求：
1. 直接输出原文，不要加任何前言、总结、说明
2. 保持文言文原貌，不要现代汉语翻译
3. 长度尽可能完整，能输出多少输出多少
4. 如果原文极短，可以输出整段；如果原文较长，输出主要内容
5. 不要编造你不确定的内容，宁可少写也不要错写
6. 不要在末尾说"以上是xxx"之类的话`,
        },
      ], { temperature: 0.3, max_tokens: 4000 });

      const chapText = (chapResp.content || '').trim();
      if (chapText.length > 50) {
        buffer.push(`\n## 第${i + 1}章 ${ch}\n\n${chapText}\n`);
        const totalLen = buffer.join('').length;
        addLog(taskId, `[LLM兜底] 已完成第 ${i + 1}/${maxChapters} 章 "${ch}"（章节 ${chapText.length} 字，累计 ${totalLen} 字）`);
        updateTask(taskId, {
          status: 'searching',
          message: `🟢 LLM 兜底进行中：${i + 1}/${maxChapters} 章（已生成 ${totalLen} 字）`,
          progress: Math.min(85, 5 + Math.floor((i + 1) / maxChapters * 80)),
        });
      } else {
        addLog(taskId, `[LLM兜底] 第 ${i + 1} 章 "${ch}" 返回过短，跳过`);
      }
    } catch (e) {
      addLog(taskId, `[LLM兜底] 第 ${i + 1} 章 "${ch}" 生成失败: ${(e as Error).message}`);
    }
  }

  const fullContent = buffer.join('');
  addLog(taskId, `[LLM兜底] 全部章节生成完毕，总字数 ${fullContent.length}`);
  return fullContent;
}

async function translateContent(taskId: string, content: string): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config);
  
  const paragraphs = content.split(/\n{2,}/).filter(p => p.trim().length > 0);
  const CHUNK_SIZE = 12;
  const chunks: string[][] = [];
  
  for (let i = 0; i < paragraphs.length; i += CHUNK_SIZE) {
    chunks.push(paragraphs.slice(i, i + CHUNK_SIZE));
  }
  
  addLog(taskId, `翻译: ${paragraphs.length} 段, ${chunks.length} 批`);
  
  const translatedChunks: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    if (!processingQueue.has(taskId)) {
      addLog(taskId, '翻译被取消');
      return translatedChunks.join('\n\n');
    }
    
    const chunk = chunks[i];
    const numberedText = chunk.map((p, idx) => `【段${idx + 1}】${p}`).join('\n\n');
    
    const progress = 25 + Math.floor((i / chunks.length) * 25);
    updateTask(taskId, {
      message: `翻译中 (${i + 1}/${chunks.length} 批)...`,
      progress,
      currentChapter: i + 1,
      totalChapters: chunks.length,
      remainingChapters: chunks.length - i - 1,
    });
    
    try {
      const response = await client.invoke(
        [
          {
            role: 'system',
            content: `你是顶级翻译大师。将以下内容翻译为通顺流畅的中文。
铁律：
1. 必须保留所有【段N】编号，一段不漏
2. 从第一个字翻译到最后一个字，不截断不省略
3. 不合并不精简，每段独立翻译
4. 像正版中文译本一样可读`,
          },
          { role: 'user', content: `翻译：\n\n${numberedText}` },
        ],
        { model: 'doubao-seed-2-0-pro-260215', temperature: 0.3 }
      );
      
      let translated = response.content || '';
      translated = translated.replace(/【段\d+】/g, '');
      translatedChunks.push(translated);
      addLog(taskId, `翻译批次 ${i + 1}/${chunks.length} ✓`);
    } catch (e) {
      addLog(taskId, `翻译批次 ${i + 1} 失败: ${e instanceof Error ? e.message : String(e)}`);
      translatedChunks.push(chunk.join('\n\n'));
    }
  }
  
  return translatedChunks.join('\n\n');
}

// ==================== 类型定义 ====================

interface ConfirmedChapters {
  totalChapters: number;
  structureType: string;
  chapterNames: string[];
}

// ==================== 分章保存 ====================

async function saveWithProgress(taskId: string, content: string, confirmedChapters: ConfirmedChapters | null): Promise<void> {
  // 1. 优先使用确认的原书章节数，否则从内容解析
  const contentChapters = parseBookChapters(content);
  const totalChars = content.length;
  
  // 确定最终使用的章节数据：确认的 > 内容解析的
  let finalChapters: { name: string; type: string }[];
  let totalChapterCount: number;
  let chapterType: string;
  
  if (confirmedChapters && confirmedChapters.chapterNames.length > 0) {
    // 使用确认的原书章节结构
    finalChapters = confirmedChapters.chapterNames.map((name: string, _i: number) => ({
      name,
      type: confirmedChapters.structureType || '章',
    }));
    totalChapterCount = confirmedChapters.totalChapters;
    chapterType = confirmedChapters.structureType || '章';
    addLog(taskId, `使用原书确认结构: 共${totalChapterCount}${chapterType}`);
  } else if (contentChapters.length >= 2) {
    // 回退到内容解析的章节
    finalChapters = contentChapters.map(c => ({ name: c.name, type: c.type }));
    totalChapterCount = contentChapters.length;
    chapterType = contentChapters[0]?.type || '章';
  } else {
    // 无法识别章节结构
    finalChapters = [];
    totalChapterCount = 0;
    chapterType = '段';
  }
  
  // 2. 如果有章节结构，按章节进度更新
  if (finalChapters.length >= 2) {
    updateTask(taskId, {
      progress: 50,
      totalChapters: totalChapterCount,
      currentChapter: 0,
      remainingChapters: totalChapterCount,
      currentChapterName: `准备摘录...`,
      message: `原书结构: 共 ${totalChapterCount} ${chapterType}`,
      chapterStructure: chapterType,
    });

    // 按字符位置分段写入，以真实章节为进度单位
    const chunkSize = Math.max(1000, Math.floor(totalChars / 50));
    let writtenChars = 0;
    let lastChapterIdx = 0;

    while (writtenChars < totalChars) {
      if (!processingQueue.has(taskId)) {
        addLog(taskId, '摘录被取消');
        return;
      }

      writtenChars = Math.min(writtenChars + chunkSize, totalChars);
      const progress = 50 + Math.floor((writtenChars / totalChars) * 50);
      
      // 根据当前字符位置确定所在章节
      const currentChapterInfo = getCurrentChapterAtPosition(contentChapters, writtenChars);
      const currentChapterIdx = currentChapterInfo.index;
      // 优先显示确认的章节名，否则用原书结构类型生成名称
      const rawName = (finalChapters[currentChapterIdx - 1] || currentChapterInfo).name;
      const currentChapterName = rawName || `第${currentChapterIdx}${chapterType}`;

      // 只在章节变化时更新章节信息
      if (currentChapterIdx !== lastChapterIdx || progress >= 99) {
        lastChapterIdx = currentChapterIdx;
        updateTask(taskId, {
          progress,
          currentChapter: currentChapterIdx,
          totalChapters: totalChapterCount,
          remainingChapters: totalChapterCount - currentChapterIdx,
          currentChapterName,
          message: `正在摘录: ${currentChapterName.substring(0, 20)} (${currentChapterIdx}/${totalChapterCount}${chapterType})`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 80));
    }
  } else {
    // 3. 没有识别到章节结构，按段落进度更新
    const paragraphs = content.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
    const total = paragraphs.length;
    const batchSize = Math.max(1, Math.floor(total / 20));
    
    for (let i = 0; i < total; i += batchSize) {
      if (!processingQueue.has(taskId)) {
        addLog(taskId, '摘录被取消');
        return;
      }
      
      const current = Math.min(i + batchSize, total);
      const progress = 50 + Math.floor((current / total) * 50);
      
      updateTask(taskId, {
        progress,
        currentChapter: current,
        totalChapters: total,
        remainingChapters: total - current,
        currentChapterName: `第${current}段`,
        message: `正在摘录: 第${current}段/${total}段`,
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // 4. 一次性保存完整内容到知识库（含元数据头部）
  const task = tasks.get(taskId);
  if (!task || !processingQueue.has(taskId)) return;
  
  try {
    // 构建元数据头部：书名 + 目录结构 + 完整正文（一字不漏）
    const chapterCount = totalChapterCount > 0 ? totalChapterCount : content.split(/\n{2,}/).filter((p: string) => p.trim().length > 0).length;
    const chapterNames = finalChapters.length >= 2
      ? finalChapters.map((c: { name: string }, i: number) => `  ${i + 1}. ${c.name}`).join('\n')
      : '';
    
    const metadataHeader = [
      `《${task.bookName}》`,
      `来源: ${task.source || '网络采集'}`,
      `目录结构: 共 ${chapterCount} ${chapterType}`,
      chapterNames ? `目录:\n${chapterNames}` : '',
      '─'.repeat(40),
      '',  // 空行分隔元数据和正文
    ].filter(Boolean).join('\n');
    
    const fullContentWithMetadata = metadataHeader + '\n' + content;
    
    addBookToKnowledgeBase(task.bookName, fullContentWithMetadata);
    saveBook(task.bookName, fullContentWithMetadata);
    addLog(taskId, `保存完成: ${chapterCount} ${chapterType}, ${fullContentWithMetadata.length} 字 (含元数据)`);
  } catch (e) {
    addLog(taskId, `保存失败: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

// ==================== AI学习逻辑 ====================

/**
 * AI学习书籍内容：将书籍内容分块后逐批写入向量知识库
 * 录入完成后自动触发，学习完成后该书知识点才算真正可用
 */
// 防止同一 task 被并发 processLearning 多次的运行时锁
const processingLearningSet = new Set<string>();

async function processLearning(taskId: string, bookContent: string): Promise<void> {
  const task = tasks.get(taskId);
  if (!task) return;
  // 允许已录入完成的书和本地内置书籍进行学习
  if (!task.isLocalBook && task.status !== 'done') return;

  // 已学完的跳过；'learning' 状态的允许继续（进程重启 / 队列 resume 后必须能接着学）
  if (task.learningStatus === 'done') return;

  // 并发锁：同一个 task 同时只能有一个 processLearning 在跑
  if (processingLearningSet.has(taskId)) return;
  processingLearningSet.add(taskId);

  // 🔴 防虚假完成守卫一：bookContent 为空或过短，不能"学"
  if (!bookContent || bookContent.trim().length < 200) {
    updateTask(taskId, {
      learningStatus: 'failed',
      learningProgress: 0,
      learningMessage: `《${task.bookName}》没有真实全文内容（${bookContent?.length ?? 0} 字），无法深度学习。请先录入完整原文（必须 ≥200 字）。`,
    });
    addLog(taskId, `学习守卫拒绝：bookContent 长度 ${bookContent?.length ?? 0} < 200`);
    processingLearningSet.delete(taskId);
    return;
  }

  updateTask(taskId, {
    learningStatus: 'learning',
    learningProgress: 0,
    learningLayersDone: [],
    learningMessage: `AI开始学习《${task.bookName}》全部内容...`,
  });
  addLog(taskId, '开始AI深度学习阶段');

  try {
    const config = new Config();
    const knowledgeClient = new KnowledgeClient(config);

    // 根据书名智能选择知识库表名
    const tableName = selectDatasetForBook(task.bookName);

    // ======== 第一步：分块 ========
    // 按段落边界分块，每块约3000字符，适合LLM理解+向量化
    // 同时记录每块的起始字符位置，用于反查"学到了第几章"
    const CHUNK_SIZE = 3000;
    const chunks: string[] = [];
    const chunkStartPositions: number[] = []; // 每块在原文中的起始字符位置

    // 解析原书章节结构，用于按章节展示学习进度
    const bookChapters = parseBookChapters(bookContent);
    const bookChapterInfo = detectBookChapters(bookContent);
    const learningStructureUnit = bookChapterInfo.structureType && bookChapterInfo.structureType !== '未知'
      ? bookChapterInfo.structureType
      : (task.chapterStructure || '块');

    const paragraphs = bookContent.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
    let currentChunk = '';
    let currentChunkStart = 0;
    let cursor = 0; // 在原文中的累计位置（按段落顺序累加）

    for (const para of paragraphs) {
      // 在原文中定位本段落（使用 indexOf 从当前 cursor 之后开始找）
      const paraIdx = bookContent.indexOf(para, cursor);
      if (paraIdx >= 0) cursor = paraIdx;

      if (currentChunk.length + para.length + 2 > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        chunkStartPositions.push(currentChunkStart);
        currentChunk = para;
        currentChunkStart = cursor;
      } else {
        if (!currentChunk) currentChunkStart = cursor;
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
      cursor += para.length;
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      chunkStartPositions.push(currentChunkStart);
    }

    const totalChunks = chunks.length;
    // 计算"原书共有多少章/卷/卦"用于显示
    const totalUnits = bookChapters.length > 0 ? bookChapters.length : totalChunks;
    updateTask(taskId, {
      learningTotalChunks: totalChunks,
      learningCurrentChunk: 0,
      learningCurrentChapter: 0,
      learningCurrentChapterName: bookChapters.length > 0 ? bookChapters[0].name : '',
      learningMessage: bookChapters.length > 0
        ? `AI学习中: 准备学习 共${totalUnits}${learningStructureUnit}（按段落切分为 ${totalChunks} 个学习块）...`
        : `AI学习中: 共${totalChunks}块内容待学习...`,
    });
    addLog(taskId, `学习分块: ${totalChunks} 块, 原书 ${totalUnits} ${learningStructureUnit}, 目标表: ${tableName}`);

    // ======== 第二步：逐块深度学习 ========
    // 对每一块内容，AI进行4层理解：术语→逻辑→关联→应用
    const llmClient = new LLMClient(config);
    const learnedChunks: string[] = [];
    // 🔴 平行数组：保留每块"原文 + 学习笔记"的结构化数据，供 6 阶段流水线使用
    const learnedNotesArray: { index: number; original: string; learnedNotes: string }[] = [];
    let processedChunks = 0;

    for (let i = 0; i < totalChunks; i++) {
      if (!tasks.has(taskId)) {
        addLog(taskId, '学习被中断（任务被删除）');
        return;
      }

      const chunk = chunks[i];
      const chunkLabel = `[第${i + 1}/${totalChunks}块]`;

      // AI深度学习每块内容
      const learnPrompt = `你是一位精通中国玄学的学者，正在逐字逐句学习古籍原文。请对以下内容进行深度学习，严格按照4个层次输出：

【原始文本】
${chunk}

【学习要求】请按以下4层结构输出你的学习成果：

一、专业术语与概念
- 列出本段中出现的所有专业术语（如：日主旺衰、用神、十神、六亲、神煞、格局等）
- 每个术语给出精确的定义和在本文语境中的具体含义

二、分析逻辑与推断方法
- 提炼本段中的分析推理链条（如：因何→推出何→结论为何）
- 标注推理类型（铁律/或然/经验）及判断依据

三、知识点关联关系
- 本段知识点与哪些其他术数概念有关联（如：此格局与彼格局的区别、此神煞与彼神煞的组合效应）
- 标注跨领域关联（如八字与紫微的对应、面相与八字的印证）

四、实际应用方法
- 本段知识如何应用到实际命理分析中
- 给出具体的应用场景和判断步骤

【重要】
- 必须忠实于原文，不得编造原文中没有的内容
- 如果某层在原文中确实没有涉及，写"本段未涉及"并说明原因
- 学习要深入细致，不能浮于表面`;

      let learnedContent = '';
      try {
        const stream = llmClient.stream(
          [
            { role: 'system', content: '你是一位严谨的玄学学者，逐字逐句学习古籍。你的学习必须忠实原文、深入理解、建立关联、学以致用。绝不允许编造原文没有的内容。' },
            { role: 'user', content: learnPrompt },
          ],
          { model: 'doubao-seed-2-0-pro-260215' }
        );

        for await (const chunk of stream) {
          if (chunk.content) {
            learnedContent += chunk.content.toString();
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        addLog(taskId, `${chunkLabel} AI学习失败: ${errMsg}，使用原文`);
        learnedContent = '';
      }

      // 如果AI学习成功，组装学习成果（原文+学习笔记）；如果失败，保留原文
      if (learnedContent.trim()) {
        learnedChunks.push(`========== 原文 ==========\n${chunk}\n========== AI学习笔记 ==========\n${learnedContent}`);
      } else {
        learnedChunks.push(chunk);
      }
      // 🔴 同步保存结构化学习数据，供后续 6 阶段流水线使用
      learnedNotesArray.push({
        index: i + 1,
        original: chunk,
        learnedNotes: learnedContent.trim() || '(本块 LLM 学习失败，无深度笔记)',
      });

      processedChunks = i + 1;
      const progress = Math.floor((processedChunks / totalChunks) * 100);
      // 更新学习层次进度
      const layersDone: number[] = [];
      if (progress >= 25) layersDone.push(1); // ①术语理解
      if (progress >= 50) layersDone.push(2); // ②逻辑推理
      if (progress >= 75) layersDone.push(3); // ③交叉关联

      // 🔴 反查"学到了第几章/卦/卷"：根据当前块的起始字符位置找出原书章节
      let curChapterIdx = 0;
      let curChapterName = '';
      if (bookChapters.length > 0) {
        const chunkPos = chunkStartPositions[i] ?? 0;
        const located = getCurrentChapterAtPosition(bookChapters, chunkPos);
        curChapterIdx = located.index;
        curChapterName = located.name;
      }
      const friendlyMsg = bookChapters.length > 0
        ? `📖 学习中：第${curChapterIdx}/${totalUnits}${learningStructureUnit}「${curChapterName}」（块 ${processedChunks}/${totalChunks}，${progress}%）`
        : `AI学习中: ${processedChunks}/${totalChunks}块 (${progress}%) - 正在理解术语/逻辑/关联/应用`;

      updateTask(taskId, {
        learningProgress: progress,
        learningCurrentChunk: processedChunks,
        learningCurrentChapter: curChapterIdx,
        learningCurrentChapterName: curChapterName,
        learningLayersDone: layersDone,
        learningMessage: friendlyMsg,
      });
      
      // 🔴 学习铁律：进度持久化到 local-learn-tasks.json
      // 即使刷新/退出/锁屏，下次启动后也能从中断点继续显示进度
      const taskNow = tasks.get(taskId);
      if (taskNow) {
        syncLocalLearnStatus(taskNow.bookName, {
          learningStatus: 'learning',
          learningProgress: progress,
          learningCurrentChunk: processedChunks,
          learningTotalChunks: totalChunks,
          learningLayersDone: layersDone,
          learningMessage: friendlyMsg,
        });
      }

      // 块间短暂延迟
      if (i + 1 < totalChunks) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // ======== 第三步：学习成果写入向量知识库 ========
    updateTask(taskId, {
      learningMessage: `正在将学习成果写入知识库...`,
    });
    addLog(taskId, `学习完成，开始写入向量知识库 ${tableName}`);

    // 每批3块写入（学习成果比原文大，减少批次大小）
    const BATCH_SIZE = 3;
    let writtenChunks = 0;

    for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
      if (!tasks.has(taskId)) {
        addLog(taskId, '写入被中断（任务被删除）');
        return;
      }

      const batch = learnedChunks.slice(i, Math.min(i + BATCH_SIZE, totalChunks));
      const documents = batch.map((chunk: string) => ({
        source: 0 as const, // DataSourceType.TEXT
        raw_data: chunk,
      }));

      try {
        await knowledgeClient.addDocuments(documents, tableName, {
          separator: '\n\n',
          max_tokens: 2000,
        });
      } catch (e) {
        addLog(taskId, `写入批次 ${Math.floor(i / BATCH_SIZE) + 1} 失败: ${e instanceof Error ? e.message : String(e)}`);
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await knowledgeClient.addDocuments(documents, tableName, {
            separator: '\n\n',
            max_tokens: 2000,
          });
        } catch {
          addLog(taskId, `写入批次 ${Math.floor(i / BATCH_SIZE) + 1} 重试也失败，跳过`);
        }
      }

      writtenChunks = Math.min(i + BATCH_SIZE, totalChunks);
      const writeProgress = 90 + Math.floor((writtenChunks / totalChunks) * 10); // 90%-100%
      updateTask(taskId, {
        learningProgress: writeProgress,
        learningMessage: `写入知识库: ${writtenChunks}/${totalChunks}块`,
      });

      if (i + BATCH_SIZE < totalChunks) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // ======== 第四步：6 阶段深度学习流水线（铁律）========
    // 录入 ≠ 学会。在向量库写入完成的基础上，必须生成 6 个结构化产出文件才算真正学完。
    addLog(taskId, `开始 6 阶段深度学习流水线（通读→理解→要点→逻辑→应用→融会）`);
    updateTask(taskId, {
      learningMessage: `开始 6 阶段深度学习：通读→理解→要点→逻辑→应用→融会...`,
    });

    const pipelineResult = await runFullDeepLearning({
      taskId,
      bookName: task.bookName,
      learnedChunks: learnedNotesArray,
      onStageProgress: (stageIndex, stageName, info) => {
        const stageLayers = Array.from({ length: stageIndex }, (_, i) => i + 1);
        updateTask(taskId, {
          learningProgress: Math.min(99, 90 + Math.floor((stageIndex * 10) / 6)),
          learningLayersDone: stageLayers,
          learningMessage: `深度学习 ${stageIndex}/6 ${stageName}：${info}`,
        });
        addLog(taskId, `阶段 ${stageIndex}/6 ${stageName}: ${info}`);
      },
    });

    // ======== 学习完成判据（铁律）========
    // 6 阶段产出文件必须全部存在且非空（≥50B），否则学习失败
    if (!pipelineResult.ok) {
      updateTask(taskId, {
        learningStatus: 'failed',
        learningMessage: `深度学习失败：缺失阶段 [${pipelineResult.missing.join(',')}]，产出文件大小 ${pipelineResult.sizes.join(',')}B`,
      });
      addLog(taskId, `深度学习失败：6 阶段产出不完整，缺失阶段 ${pipelineResult.missing.join(',')}`);
      processingLearningSet.delete(taskId);
      return;
    }

    const c = pipelineResult.counts;
    addLog(taskId, `6 阶段产出完成：术语 ${c.terms} / 规则 ${c.rules} / 算法 ${c.algorithms} / 案例 ${c.cases}`);

    // ======== 学习完成 ========
    updateTask(taskId, {
      learningStatus: 'done',
      learningProgress: 100,
      learningCurrentChunk: totalChunks,
      learningTotalChunks: totalChunks,
      learningLayersDone: [1, 2, 3, 4, 5, 6],
      learningMessage: `AI已深度学完《${task.bookName}》：${totalChunks}块原文 + 6阶段产出（术语${c.terms}/规则${c.rules}/算法${c.algorithms}/案例${c.cases}）`,
    });
    addLog(taskId, `深度学习完成: ${totalChunks}块 → ${tableName}（6阶段产出齐全）`);
    // 🔴 持久化完成状态，进程重启后不会回退
    const taskDone = tasks.get(taskId);
    if (taskDone) {
      syncLocalLearnStatus(taskDone.bookName, {
        learningStatus: 'done',
        learningProgress: 100,
        learningCurrentChunk: totalChunks,
        learningTotalChunks: totalChunks,
        learningLayersDone: [1, 2, 3, 4, 5, 6],
        learningMessage: taskDone.learningMessage,
      });
    }

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    updateTask(taskId, {
      learningStatus: 'failed',
      learningMessage: `AI学习失败: ${errMsg}`,
    });
    addLog(taskId, `学习失败: ${errMsg}`);
  } finally {
    // 释放并发锁，允许下一次（如手动重启）再 process
    processingLearningSet.delete(taskId);
  }
}

/**
 * 根据书名智能选择向量知识库表名
 * 不同领域的书籍写入对应领域的数据集
 */
function selectDatasetForBook(bookName: string): string {
  // 领域关键词匹配
  const domainMap: [string[], string][] = [
    [['学业', '考试', '科举', '读书', '教育', '文昌'], 'xueye_knowledge'],
    [['婚姻', '夫妻', '婚恋', '合婚', '嫁娶', '桃花'], 'hunyin_knowledge'],
    [['事业', '官运', '仕途', '职场', '升迁'], 'shiye_knowledge'],
    [['财运', '财富', '求财', '生意', '经商', '理财'], 'caiyun_knowledge'],
    [['健康', '疾病', '医学', '中医', '养生', '本草', '伤寒', '金匮', '素问', '灵枢'], 'jiankang_knowledge'],
    [['六亲', '父母', '兄弟', '子女', '六亲'], 'liuqin_knowledge'],
    [['六爻', '爻', '铜钱', '纳甲', '卜筮', '占卜', '易冒', '增删卜易', '卜筮正宗'], 'liuyao_knowledge'],
    [['梅花', '心易', '体用', '梅花易'], 'meihua_knowledge'],
    [['风水', '地理', '宅经', '葬书', '堪舆', '玄空', '八宅', '飞星', '阳宅', '阴宅'], 'fengshui_knowledge'],
    [['面相', '手相', '相法', '相术', '麻衣', '柳庄', '神相', '水镜', '冰鉴'], 'xiangxue_knowledge'],
    [['紫微', '斗数', '星盘', '紫微斗'], 'geju_knowledge'],
    [['格局', '用神', '调候', '格局论'], 'geju_knowledge'],
    [['神煞', '神煞', '天乙', '驿马', '文昌', '华盖'], 'shensha_knowledge'],
    [['大运', '流年', '运程'], 'dayun_knowledge'],
    [['盲派', '盲派', '口诀', '秘典'], 'mangpai_knowledge'],
    [['择日', '择吉', '日课', '通胜', '历法'], 'book_system_knowledge'],
    [['姓名', '命名', '起名', '测名', '五格', '数理'], 'book_system_knowledge'],
  ];

  for (const [keywords, table] of domainMap) {
    if (keywords.some(kw => bookName.includes(kw))) {
      return table;
    }
  }

  // 默认写入综合知识库
  return 'book_system_knowledge';
}

// ==================== 公开API ====================

/**
 * 初始化任务管理器（服务器启动时调用）
 */
export function initTaskManager(): void {
  if (isInitialized) return;
  isInitialized = true;

  loadTasks();

  // 🌩️ 云端兜底：从 Supabase 拉所有 task，本地没有的合并进来
  // 关键：本地丢失（部署后）时云端就是唯一真相源
  // 必须串行 await 完成后再做 resume 判断，否则 tasks Map 还没装满
  void (async () => {
    try {
      await loadTasksFromDb();
      // 拉墓碑
      try {
        const tombs = await repoListTombstones();
        for (const id of tombs.deletedIds) {
          deletedTaskIds.add(id);
        }
        const g = globalThis as { __deletedBookNames?: Set<string> };
        if (!g.__deletedBookNames) g.__deletedBookNames = new Set();
        for (const name of tombs.deletedNames) {
          g.__deletedBookNames.add(name);
        }
      } catch { /* ignore */ }
      try {
        const arr = Array.from(tasks.values());
        const deletedIds = Array.from(deletedTaskIds);
        fs.writeFileSync(TASKS_FILE, JSON.stringify({ tasks: arr, deletedIds }, null, 2));
      } catch { /* ignore */ }

      // 🔴 学习铁律：db 中所有 learningStatus='learning' 的任务，进程重启后自动 resume
      // 不依赖本地内存，云端就是真相
      let dbLearningResumed = 0;
      for (const [id, task] of tasks) {
        if (task.status === 'done' && task.learningStatus === 'learning') {
          // 跳过 paused
          if (cancelledTasks.has(id) || deletedTaskIds.has(id)) continue;
          // 已经在队列里或已在跑就不重复加
          if (localLearningQueue.includes(id)) continue;
          localLearningQueue.push(id);
          dbLearningResumed++;
        }
      }
      if (dbLearningResumed > 0) {
        console.log(`[TaskManager] 🔄 从 Supabase 自动恢复 ${dbLearningResumed} 个学习中任务`);
        processLocalLearningQueue();
      }
    } catch (e) {
      console.warn('[TaskManager] 从 Supabase 拉 task 失败，使用本地数据:', e);
    }
  })();
  
  // 🔴 状态同步铁律：本地物理文件已存在 → task.status 必须是 done
  // 防止"知识库说已录入完成"但"添加书籍页还显示搜索中"的状态矛盾
  let synced = 0;
  
  // 先加载 local-learn-tasks.json，用于恢复已完成的学习状态
  let localLearnStatus: Record<string, Record<string, unknown>> = {};
  try {
    const learnTaskFile = path.join(TASKS_DIR, 'local-learn-tasks.json');
    if (fs.existsSync(learnTaskFile)) {
      localLearnStatus = JSON.parse(fs.readFileSync(learnTaskFile, 'utf-8'));
    }
  } catch { /* 忽略 */ }
  
  try {
    const localBooks = getLocalBookInfo();
    const localBookSet = new Set(localBooks.bookNames);
    for (const [id, task] of tasks) {
      if (localBookSet.has(task.bookName) && task.status !== 'done') {
        // 物理文件存在但 task 不是 done → 强制同步为 done
        const meta = getLocalBookMeta(task.bookName);
        
        // 从 local-learn-tasks.json 恢复学习状态（如果之前学完了，保持 done）
        const learnInfo = localLearnStatus[task.bookName];
        const isLearningDone = learnInfo?.learningStatus === 'done';
        
        updateTask(id, {
          status: 'done',
          progress: 100,
          message: `《${task.bookName}》已录入完成（状态自动同步：检测到本地全文文件）`,
          chars: meta.charCount > 0 ? meta.charCount : task.chars,
          // 关键修复：本地书的 currentChapter 直接等于 totalChapters，避免假"缺章节"
          currentChapter: meta.totalChapters || task.currentChapter,
          totalChapters: meta.totalChapters || task.totalChapters,
          chapterStructure: meta.chapterStructure || task.chapterStructure,
          completedAt: task.completedAt || Date.now(),
          learningStatus: isLearningDone ? 'done' : (task.learningStatus === 'done' ? 'done' : 'pending'),
          learningProgress: isLearningDone ? 100 : task.learningProgress,
          learningMessage: isLearningDone 
            ? `✅ 已学完《${task.bookName}》全部内容` 
            : (task.learningStatus === 'done' ? task.learningMessage : '⏳ 待学习（在知识库点击"开始学习"启动）'),
          learningLayersDone: isLearningDone ? [1, 2, 3, 4] : task.learningLayersDone,
        });
        synced++;
      }
    }
    if (synced > 0) {
      console.log(`[TaskManager] 状态同步：${synced} 个任务从"录入中"修正为"已完成"（检测到本地全文文件）`);
    }
  } catch (e) {
    console.error('[TaskManager] 状态同步失败:', e);
  }
  
  // 自动恢复未完成的任务
  let resumed = 0;
  let learningResumed = 0;
  for (const [id, task] of tasks) {
    if (task.status === 'paused') {
      // 暂停的任务不自动恢复，等待用户手动点击"继续"
      updateTask(id, { message: `已暂停《${task.bookName}》，点击"继续"恢复录入` });
    } else if (['pending', 'searching', 'downloading', 'translating', 'saving'].includes(task.status)) {
      // 🔴 状态互斥铁律：一本书只能有一个状态
      // 如果任务已有下载内容(chars>0)，说明内容已找到，不应重新搜索
      if (task.chars > 0 && (task.status === 'downloading' || task.status === 'translating' || task.status === 'saving')) {
        // 有内容但中断了 → 保留内容和进度，只重置状态为pending让后续流程继续
        updateTask(id, { status: 'pending', message: `恢复录入《${task.bookName}》(已下载${task.chars}字，从断点继续)...` });
        // 注意：不清零progress和currentChapter，保留断点
      } else if (task.status === 'searching') {
        // 正在搜索但无内容 → 重新搜索（搜索结果可能变化）
        // 但不清零progress，保留视觉连续性
        updateTask(id, { status: 'pending', message: `重新搜索《${task.bookName}》...（上次搜索中断，从新开始）` });
      } else {
        // pending或其他状态 → 正常恢复
        updateTask(id, { status: 'pending', progress: 0, message: '等待自动恢复...' });
      }
      resumed++;
      // 异步处理，不阻塞初始化
      setTimeout(() => processTask(id), Math.random() * 5000);
    } else if (task.status === 'done' && task.learningStatus === 'pending') {
      // 已录入但未学习——保留"待学习"状态，等待用户在知识库手动点击"开始学习"
    } else if (task.status === 'done' && task.learningStatus === 'learning') {
      // 🔴 学习铁律：学习一旦开始，必须持续到完成——刷新/退出/锁屏都不能中断
      // 之前的策略是回退到 pending，违反铁律
      // 新策略：检测到 learningStatus='learning' → 自动恢复学习（继续从中断点学）
      updateTask(id, {
        learningMessage: `🔄 自动恢复学习《${task.bookName}》（之前中断，继续学习中...）`,
      });
      learningResumed++;
      // 异步恢复，避免阻塞 init
      setTimeout(() => {
        learnLocalBook(id).catch(e => {
          console.error(`[TaskManager] 自动恢复学习失败 ${task.bookName}:`, e);
        });
      }, 3000 + Math.random() * 5000);
    }
  }
  
  if (resumed > 0) {
    console.log(`[TaskManager] 自动恢复 ${resumed} 个未完成录入任务`);
  }
  if (learningResumed > 0) {
    console.log(`[TaskManager] 🔄 自动恢复 ${learningResumed} 个学习中任务（后台持续运行，不受刷新/退出影响）`);
  }
}

/**
 * 创建新任务
 */
export async function createTask(bookName: string): Promise<{ task: BookTask; isNew: boolean }> {
  if (!isInitialized) initTaskManager();
  
  // 用户主动重新添加同名书 = 取消墓碑（书名级）
  // 同时清理掉与此书名关联的旧 ID 级墓碑，避免新任务被误杀
  const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
  if (g.__deletedBookNames?.has(bookName)) {
    g.__deletedBookNames.delete(bookName);
    // 同步从磁盘墓碑文件中移除
    try {
      if (fs.existsSync(TOMBSTONE_FILE)) {
        const tomb = JSON.parse(fs.readFileSync(TOMBSTONE_FILE, 'utf-8'));
        const names: string[] = tomb.deletedNames || [];
        tomb.deletedNames = names.filter((n) => n !== bookName);
        fs.writeFileSync(TOMBSTONE_FILE, JSON.stringify(tomb, null, 2));
      }
    } catch { /* 忽略 */ }
    console.log(`[TaskManager] 用户重新添加《${bookName}》，已撤销同名墓碑`);
  }
  
  // 检查是否已有同名任务
  for (const [, existing] of tasks) {
    if (existing.bookName === bookName && ['pending', 'searching', 'downloading', 'translating', 'saving', 'paused'].includes(existing.status)) {
      return { task: existing, isNew: false };
    }
  }
  
  // 用户主动重新添加 = 强制重新录入（覆盖知识库现有版本）
  // 不再因 isBookExists 拦截，让用户能看到完整录入流程
  
  // 🔴 关键修复：检查旧 task 是否有缺章 → 有缺章必须重新走完整流程补搜
  // 否则"本地文件已存在 → 直接 done"会导致缺章永远补不回来
  let hadMissingBefore = false;
  // 内存优先
  for (const t of tasks.values()) {
    if (t.bookName === bookName && t.hasMissingChapters && (t.missingChapterNames?.length ?? 0) > 0) {
      hadMissingBefore = true;
      break;
    }
  }
  // 内存查不到 → 异步查 Supabase（生产环境内存可能丢失）
  if (!hadMissingBefore) {
    try {
      const dbTask = await repoGetTaskByName(bookName);
      if (dbTask?.has_missing_chapters && Array.isArray(dbTask.missing_chapter_names) && dbTask.missing_chapter_names.length > 0) {
        hadMissingBefore = true;
      }
    } catch { /* 忽略数据库查询失败 */ }
  }
  
  // 🔴 状态同步铁律：本地物理文件已存在 → 直接标 done，不进入搜索
  // 避免出现"知识库有该书"但"添加书籍页还显示搜索中"的矛盾
  // 例外：有缺章 → 强制走完整流程去补搜（用户重新添加 = 想补缺章）
  const localMeta = getLocalBookMeta(bookName);
  const localFileExists = localMeta.exists;
  const localFileChars = localMeta.charCount;
  const skipFullPipeline = localFileExists && !hadMissingBefore;
  
  if (hadMissingBefore && localFileExists) {
    console.log(`[TaskManager] 《${bookName}》本地虽已存在但记录有缺章，强制进入完整 processTask 流程补搜`);
  }
  
  const id = generateId();
  const task: BookTask = {
    id,
    bookName,
    status: skipFullPipeline ? 'done' : 'pending',
    message: skipFullPipeline 
      ? `《${bookName}》已存在于知识库（检测到本地全文文件）` 
      : (hadMissingBefore ? `🎯 检测到《${bookName}》记录有缺章，重新进入全网穷尽搜索 + 缺章定向补搜...` : '等待开始...'),
    progress: skipFullPipeline ? 100 : 0,
    // 关键修复：本地书的 currentChapter 直接等于 totalChapters，避免假"缺章节"
    currentChapter: skipFullPipeline ? localMeta.totalChapters : 0,
    totalChapters: skipFullPipeline ? localMeta.totalChapters : 0,
    currentChapterName: '',
    remainingChapters: 0,
    source: skipFullPipeline ? '本地' : '',
    size: '',
    chars: localFileChars,
    learningStatus: 'pending',
    learningProgress: 0,
    learningCurrentChunk: 0,
    learningTotalChunks: 0,
    learningMessage: skipFullPipeline 
      ? '⏳ 待学习（在知识库点击"开始学习"启动）' 
      : '等待录入完成...',
    learningLayersDone: [],
    hasMissingChapters: false,
    missingChapterNames: [],
    learningCurrentChapter: 0,
    learningCurrentChapterName: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: skipFullPipeline ? Date.now() : null,
    completedAt: skipFullPipeline ? Date.now() : null,
    error: '',
    logs: skipFullPipeline 
      ? [`[${new Date().toLocaleTimeString()}] 检测到本地全文文件 ${localFileChars} 字 / ${localMeta.totalChapters} ${localMeta.chapterStructure}`] 
      : (hadMissingBefore ? [`[${new Date().toLocaleTimeString()}] 检测到此书有缺章历史，进入完整重新录入流程`] : []),
    chapterStructure: skipFullPipeline ? localMeta.chapterStructure : '',
    chapters: [],
  };

  tasks.set(id, task);
  saveTasks();
  
  // 异步开始处理（不阻塞返回）；如果本地已存在且无缺章则跳过录入流程
  // 用 setImmediate + Promise 立即触发，避免 setTimeout 在某些场景下不被调度
  if (!skipFullPipeline) {
    setImmediate(() => {
      Promise.resolve().then(() => processTask(id)).catch(err => {
        console.error(`[createTask] processTask 启动失败 ${id}:`, err);
        const t = tasks.get(id);
        if (t && t.status === 'searching') {
          t.status = 'failed';
          t.error = String(err);
          t.updatedAt = Date.now();
          saveTasks();
        }
      });
    });
  }
  
  return { task, isNew: true };
}

/**
 * 获取所有任务
 */
export function getAllTasks(): BookTask[] {
  if (!isInitialized) initTaskManager();
  const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
  return Array.from(tasks.values())
    .filter(t => !deletedTaskIds.has(t.id) && !g.__deletedBookNames?.has(t.bookName))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 获取学习进度摘要（供AI问答使用）
 */
export function getLearningProgressSummary(): string {
  if (!isInitialized) initTaskManager();
  const allTasks = Array.from(tasks.values());
  
  // 获取本地书籍信息（public/book-content 里的1280本）
  const localBooks = getLocalBookInfo();
  
  // 通过add-book录入的书籍按状态分类
  const done = allTasks.filter(t => t.status === 'done');
  const learning = allTasks.filter(t => t.learningStatus === 'learning');
  const pendingLearn = allTasks.filter(t => t.status === 'done' && (!t.learningStatus || t.learningStatus === 'pending'));
  const paused = allTasks.filter(t => t.status === 'paused');
  const active = allTasks.filter(t => ['searching', 'downloading', 'translating', 'saving'].includes(t.status));
  const copyright = allTasks.filter(t => t.status === 'copyright');
  
  // 本地书籍中不在add-book任务列表里的数量
  const addBookNames = new Set(allTasks.map(t => t.bookName));
  const localOnlyCount = localBooks.bookNames.filter((n: string) => !addBookNames.has(n)).length;
  
  const lines: string[] = [];
  lines.push(`📚 知识库学习进度实时报告`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`【总览】`);
  lines.push(`  系统内置书籍：${localBooks.total} 本`);
  lines.push(`  用户录入书籍：${allTasks.length} 本`);
  lines.push(`  合计：${localBooks.total + allTasks.length} 本`);
  lines.push(``);
  lines.push(`【通过add-book录入的书籍状态】`);
  lines.push(`  ✅ 已完整录入+学完：${done.filter(t => t.learningStatus === 'done').length} 本`);
  lines.push(`  📖 录入完成，正在学习：${learning.length} 本`);
  lines.push(`  ⏳ 录入完成，等待学习：${pendingLearn.length} 本`);
  lines.push(`  🔄 正在录入：${active.length} 本`);
  lines.push(`  ⏸️ 录入暂停：${paused.length} 本`);
  lines.push(`  ❌ 版权问题无法录入：${copyright.length} 本`);
  lines.push(``);
  lines.push(`【系统内置书籍学习状态】`);
  lines.push(`  内置${localBooks.total}本书籍目前直接用于全文检索，尚未经过4层深度学习。`);
  lines.push(`  这些书籍的内容可以直接搜索和引用，但AI还未逐本"吃透"——即尚未理解每本书的推理逻辑、分析思路、结论依据。`);
  if (localOnlyCount > 0 && localOnlyCount <= 50) {
    lines.push(`  内置书籍列表：${localBooks.bookNames.filter((n: string) => !addBookNames.has(n)).slice(0, 50).map((n: string) => `《${n}》`).join('、')}`);
  }
  lines.push(``);
  
  if (learning.length > 0) {
    lines.push(`【正在学习的书籍详情】`);
    for (const t of learning) {
      const progress = t.learningTotalChunks ? `${t.learningCurrentChunk}/${t.learningTotalChunks}` : '计算中';
      const pct = t.learningTotalChunks ? Math.round(t.learningCurrentChunk / t.learningTotalChunks * 100) : 0;
      const layerInfo: string[] = [];
      if (t.learningLayersDone?.includes(1)) layerInfo.push('①术语');
      if (t.learningLayersDone?.includes(2)) layerInfo.push('②逻辑');
      if (t.learningLayersDone?.includes(3)) layerInfo.push('③关联');
      if (t.learningLayersDone?.includes(4)) layerInfo.push('④应用');
      lines.push(`  《${t.bookName}》：学习进度 ${progress}（${pct}%）${layerInfo.length > 0 ? ' 已完成：' + layerInfo.join('') : ''}${t.learningMessage ? ' ' + t.learningMessage : ''}`);
    }
    lines.push(``);
  }
  
  const learnedDone = done.filter(t => t.learningStatus === 'done');
  if (learnedDone.length > 0) {
    lines.push(`【已完整学完的书籍】`);
    for (const t of learnedDone) {
      lines.push(`  《${t.bookName}》：已完整录入+学完✅`);
    }
    lines.push(``);
  }
  
  if (active.length > 0) {
    lines.push(`【正在录入的书籍】`);
    for (const t of active) {
      const progress = t.totalChapters ? `${t.currentChapter}/${t.totalChapters}章` : '计算中';
      lines.push(`  《${t.bookName}》：录入进度 ${progress}（${t.status}）`);
    }
    lines.push(``);
  }
  
  return lines.join('\n');
}

/**
 * 获取单本书的学习进度（供AI问答使用）
 */
export function getBookLearningDetail(bookName: string): string {
  if (!isInitialized) initTaskManager();
  const allTasks = Array.from(tasks.values());
  const task = allTasks.find(t => t.bookName === bookName || t.bookName.includes(bookName));
  
  if (!task) return `未找到《${bookName}》的相关记录。`;
  
  const lines: string[] = [];
  lines.push(`📖《${task.bookName}》详细学习进度`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (task.status === 'done') {
    lines.push(`录入状态：✅ 已完整录入`);
    if (task.totalChapters) lines.push(`章节：${task.currentChapter}/${task.totalChapters}章`);
    if (task.hasMissingChapters) lines.push(`⚠️ 注意：存在缺章节`);
  } else if (['searching', 'downloading', 'translating', 'saving'].includes(task.status)) {
    lines.push(`录入状态：🔄 正在${task.status === 'searching' ? '搜索' : task.status === 'downloading' ? '下载' : task.status === 'translating' ? '翻译' : '保存'}中`);
    if (task.totalChapters) lines.push(`录入进度：${task.currentChapter}/${task.totalChapters}章`);
  } else if (task.status === 'paused') {
    lines.push(`录入状态：⏸️ 已暂停`);
  } else if (task.status === 'copyright') {
    lines.push(`录入状态：❌ 因版权问题无法录入`);
  } else {
    lines.push(`录入状态：${task.status}`);
  }
  
  lines.push(``);
  lines.push(`学习状态：${task.learningStatus === 'done' ? '✅ 已完整学完' : task.learningStatus === 'learning' ? '📖 正在学习' : task.learningStatus === 'pending' ? '⏳ 等待学习' : '未开始'}`);
  
  if (task.learningStatus === 'learning') {
    if (task.learningTotalChunks) {
      const pct = Math.round(task.learningCurrentChunk / task.learningTotalChunks * 100);
      lines.push(`学习进度：${task.learningCurrentChunk}/${task.learningTotalChunks}（${pct}%）`);
    }
    const layerInfo: string[] = [];
    if (task.learningLayersDone?.includes(1)) layerInfo.push('①术语理解');
    if (task.learningLayersDone?.includes(2)) layerInfo.push('②逻辑推理');
    if (task.learningLayersDone?.includes(3)) layerInfo.push('③交叉关联');
    if (task.learningLayersDone?.includes(4)) layerInfo.push('④实际应用');
    if (layerInfo.length > 0) lines.push(`已完成层次：${layerInfo.join(' → ')}`);
    const layerPending: string[] = [];
    if (!task.learningLayersDone?.includes(1)) layerPending.push('①术语理解');
    if (!task.learningLayersDone?.includes(2)) layerPending.push('②逻辑推理');
    if (!task.learningLayersDone?.includes(3)) layerPending.push('③交叉关联');
    if (!task.learningLayersDone?.includes(4)) layerPending.push('④实际应用');
    if (layerPending.length > 0) lines.push(`待完成层次：${layerPending.join(' → ')}`);
    if (task.learningMessage) lines.push(`当前消息：${task.learningMessage}`);
  }
  
  return lines.join('\n');
}

/**
 * 获取单个任务
 */
export function getTask(taskId: string): BookTask | null {
  if (!isInitialized) initTaskManager();
  if (deletedTaskIds.has(taskId)) return null;
  const t = tasks.get(taskId);
  if (!t) return null;
  const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
  if (g.__deletedBookNames?.has(t.bookName)) return null;
  return t;
}

/**
 * 按书名查找任务（支持模糊匹配）
 * 优先精确匹配，其次包含匹配
 */
export function findTaskByBookName(bookName: string): BookTask | null {
  if (!isInitialized) initTaskManager();
  // 精确匹配
  const exact = Array.from(tasks.values()).find(t => t.bookName === bookName);
  if (exact) return exact;
  // 包含匹配
  const partial = Array.from(tasks.values()).find(t => t.bookName.includes(bookName) || bookName.includes(t.bookName));
  return partial || null;
}

/**
 * 获取所有活跃任务的简要状态列表（供AI回答学习状态时使用）
 * 确保AI回答与UI显示的状态完全一致
 */
export function getActiveTaskStatusList(): string[] {
  if (!isInitialized) initTaskManager();
  const allTasks = Array.from(tasks.values());
  const lines: string[] = [];

  if (allTasks.length === 0) return ['当前没有任何录入任务。'];

  for (const t of allTasks) {
    const statusMap: Record<string, string> = {
      'searching': '🔍 正在搜索内容，还没开始录入',
      'downloading': '📥 正在下载内容，还没开始学习',
      'translating': '🌐 正在翻译内容，还没开始学习',
      'saving': '💾 正在保存内容，还没开始学习',
      'done': '✅ 录入已完成',
      'paused': '⏸️ 录入已暂停',
      'copyright': '❌ 因版权问题无法录入',
      'failed': '❌ 录入失败',
      'cleared': '🔄 已清除',
    };
    const statusText = statusMap[t.status] || t.status;

    // 录入状态
    let line = `《${t.bookName}》：${statusText}`;

    // 录入进度
    if (['searching', 'downloading', 'translating', 'saving'].includes(t.status)) {
      if (t.totalChapters) {
        line += `（录入进度：${t.currentChapter}/${t.totalChapters}）`;
      }
    }

    // 学习状态（只有录入完成后才有学习状态）
    if (t.status === 'done') {
      if (t.learningStatus === 'done') {
        line += '，已完整学完 ✅';
      } else if (t.learningStatus === 'learning') {
        const progress = t.learningTotalChunks ? `${t.learningCurrentChunk}/${t.learningTotalChunks}` : '计算中';
        line += `，正在学习中（${progress}）`;
      } else {
        line += '，等待开始学习 ⏳';
      }
    }

    lines.push(line);
  }

  return lines;
}

/**
 * 批量启动"待学习"书籍的学习流程
 * 触发条件：用户在知识库点击"开始学习"按钮
 * 处理对象：所有 status='done' && learningStatus='pending' 的任务 + 本地内置书的待学习任务
 */
export async function startLearningPendingBooks(): Promise<{ started: number; alreadyLearning: number; bookNames: string[] }> {
  if (!isInitialized) initTaskManager();

  // 🔧 自动补建任务：扫描 public/book-content/ 目录，为没有 task 的物理书创建待学习任务
  try {
    const fs = require('fs');
    const path = require('path');
    const contentDir = path.join(process.cwd(), 'public', 'book-content');
    if (fs.existsSync(contentDir)) {
      const files = fs.readdirSync(contentDir).filter((f: string) => f.endsWith('.txt'));
      const existingNames = new Set(getAllTasks().map((t: BookTask) => t.bookName));
      for (const file of files) {
        const bookName = file.replace(/\.txt$/, '');
        if (!existingNames.has(bookName)) {
          const taskId = `local_${Date.now()}_${bookName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}`;
          const newTask: BookTask = {
            id: taskId,
            bookName,
            status: 'done',
            progress: 100,
            currentChapter: 0,
            totalChapters: 0,
            currentChapterName: '',
            remainingChapters: 0,
            message: `✅ 本地已有完整书籍，待学习`,
            source: 'local',
            size: '',
            chars: 0,
            chapters: [],
            chapterStructure: '',
            learningStatus: 'pending',
            learningProgress: 0,
            learningCurrentChunk: 0,
            learningTotalChunks: 0,
            learningMessage: '',
            learningLayersDone: [],
            hasMissingChapters: false,
    missingChapterNames: [],
    learningCurrentChapter: 0,
    learningCurrentChapterName: '',
            isLocalBook: true,
            logs: [`自动发现本地书籍: ${bookName}`],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            startedAt: null,
            completedAt: null,
            error: '',
          };
          tasks.set(taskId, newTask);
          saveTasks();
          console.log(`[startLearningPendingBooks] 自动补建本地书任务: ${bookName} (${taskId})`);
        }
      }
    }
  } catch (e) {
    console.error('[startLearningPendingBooks] 扫描本地书籍失败:', e);
  }

  const allTasks = getAllTasks();
  const pendingBooks = allTasks.filter(
    (t) => (t.status === 'done' || t.isLocalBook) && t.learningStatus === 'pending',
  );
  const learning = allTasks.filter((t) => t.learningStatus === 'learning');
  const started: string[] = [];

  // 动态 require 避免循环依赖
  const { getBookFullText } = await import('./fulltext-search');

  for (const task of pendingBooks) {
    setTimeout(async () => {
      try {
        const fullText = getBookFullText(task.bookName);
        if (fullText) {
          processLearning(task.id, fullText);
        }
      } catch (e) {
        console.error('[startLearningPendingBooks]', task.bookName, e);
      }
    }, Math.random() * 2000); // 随机分散启动，避免同一秒压垮
    started.push(task.bookName);
  }

  return { started: started.length, alreadyLearning: learning.length, bookNames: started };
}

/**
 * 取消/删除任务
 */
export function deleteTask(taskId: string): boolean {
  if (!isInitialized) initTaskManager();
  
  // 立即立墓碑，阻止后台 processTask 异步循环重新写入
  deletedTaskIds.add(taskId);
  cancelledTasks.add(taskId);
  
  // 如果正在处理，从处理队列移除
  processingQueue.delete(taskId);
  
  const task = tasks.get(taskId);
  if (!task) {
    saveTasks(); // 确保墓碑生效后立刻刷盘
    return false;
  }
  
  // 不论任务状态如何，都要从知识库删除已录入内容
  // 因为 searching/downloading/translating 状态可能已经部分写入了 books 表
  if (task.bookName) {
    const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
    if (!g.__deletedBookNames) g.__deletedBookNames = new Set();
    g.__deletedBookNames.add(task.bookName);
    try {
      const { removeBookFromKnowledgeBase } = require('./fulltext-search');
      removeBookFromKnowledgeBase(task.bookName);
    } catch {
      // 忽略删除错误
    }
    // 异步删 Supabase book_tasks 表 + 立墓碑
    (async () => {
      try {
        const { deleteTasksByBookName, addTombstone, deleteTask: repoDeleteTask } = await import('./book-repo');
        await repoDeleteTask(taskId);
        await deleteTasksByBookName(task.bookName);
        await addTombstone('id', taskId);
        await addTombstone('name', task.bookName);
      } catch (err) {
        console.error('[deleteTask] Supabase 清理失败:', err);
      }
    })();
  }
  
  tasks.delete(taskId);
  saveTasks();
  return true;
}

/**
 * 根据书名删除所有相关任务（用于从知识库删除书时同步清理）
 */
export function removeTaskByBookName(bookName: string): number {
  if (!isInitialized) initTaskManager();
  let count = 0;
  for (const [id, task] of tasks.entries()) {
    if (task.bookName === bookName) {
      deletedTaskIds.add(id);
      cancelledTasks.add(id);
      processingQueue.delete(id);
      tasks.delete(id);
      count++;
    }
  }
  const g = globalThis as unknown as { __deletedBookNames?: Set<string> };
  if (!g.__deletedBookNames) g.__deletedBookNames = new Set();
  g.__deletedBookNames.add(bookName);
  if (count > 0) saveTasks();
  return count;
}

/**
 * 清理已完成的任务（保留最近N条）
 */
export function cleanupTasks(keepCount: number = 50): number {
  if (!isInitialized) initTaskManager();
  
  const allTasks = Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  const toDelete = allTasks.filter(t => ['done', 'exists', 'failed', 'copyright'].includes(t.status)).slice(keepCount);
  
  for (const t of toDelete) {
    tasks.delete(t.id);
  }
  
  if (toDelete.length > 0) saveTasks();
  return toDelete.length;
}

/**
 * 获取统计信息
 */
export function getTaskStats(): { total: number; active: number; done: number; failed: number } {
  if (!isInitialized) initTaskManager();
  
  let active = 0, done = 0, failed = 0;
  for (const [, t] of tasks) {
    if (['pending', 'searching', 'downloading', 'translating', 'saving'].includes(t.status)) active++;
    else if (t.status === 'done') done++;
    else if (['failed', 'copyright'].includes(t.status)) failed++;
  }
  
  return { total: tasks.size, active, done, failed };
}

// ==================== 本地书籍学习 ====================

/** 学习并发控制 */
const MAX_CONCURRENT_LEARNING = 1;
let localLearningActive = 0;
let localLearningQueue: string[] = []; // taskId队列
let localLearningStarted = false;

/**
 * 开始学习所有本地内置书籍
 * 从fulltext-search获取本地书籍列表，创建学习任务，按队列逐本学习
 */
export async function startLearningAllLocalBooks(): Promise<{ total: number; started: number; message: string }> {
  if (!isInitialized) initTaskManager();
  
  // 先确保 Supabase 中的数据已经被加载到内存（生产环境本地 fs 是空的）
  try {
    const { loadBookCacheAsync } = await import('./fulltext-search');
    await loadBookCacheAsync();
  } catch (e) {
    console.warn('[startLearningAllLocalBooks] 预加载书目失败', e);
  }
  
  // 同步从 Supabase 拉一次最新 task 状态，避免 init 异步竞争
  try {
    await loadTasksFromDb();
  } catch (e) {
    console.warn('[startLearningAllLocalBooks] loadTasksFromDb 失败', e);
  }

  // 关键防御：从 db 直接读 done 列表（避免内存 task 残留 learning 状态导致 done 书被重启）
  const dbDoneBooks = new Set<string>();
  try {
    const rows = await repoListTasks();
    for (const r of rows) {
      if (r.learning_status === 'done') dbDoneBooks.add(r.book_name);
    }
  } catch (e) {
    console.warn('[startLearningAllLocalBooks] 读 db done 列表失败', e);
  }
  
  // 动态导入避免循环依赖
  const { getLocalBookInfo } = await import('./fulltext-search');
  const localBooks = getLocalBookInfo();
  
  if (localBooks.total === 0) {
    return { total: 0, started: 0, message: '没有可学习的书籍（请先添加书籍到知识库）' };
  }
  
  let started = 0;
  let skipped = 0;
  
  for (const bookName of localBooks.bookNames) {
    // 防御 1：db 已经 done → 直接跳过（即便内存 task 状态混乱）
    if (dbDoneBooks.has(bookName)) {
      skipped++;
      continue;
    }
    // 按 bookName 查找已有任务（不限 isLocalBook，防止同名任务重复）
    const existingTask = Array.from(tasks.values()).find(
      t => t.bookName === bookName
    );
    
    if (existingTask) {
      // 已有任务，检查学习状态
      if (existingTask.learningStatus === 'done') {
        skipped++;
        continue; // 已学完，跳过
      }
      // pending/learning/failed → 都强制标记为 learning 并入队（除非已在队列中）
      const wasNotInQueue = !localLearningQueue.includes(existingTask.id);
      if (wasNotInQueue) {
        localLearningQueue.push(existingTask.id);
      }
      // 状态强制更新为 learning，立即生效让前端看到
      const now = Date.now();
      if (existingTask.learningStatus !== 'learning') {
        existingTask.learningStatus = 'learning';
        existingTask.learningMessage = '学习已加入队列';
        existingTask.startedAt = existingTask.startedAt || now;
        existingTask.updatedAt = now;
        // 保证 isLocalBook 标记正确
        existingTask.isLocalBook = true;
      }
      // 不管之前是否在队列中，本次都算 started（用户期望"启动学习"）
      started++;
      continue;
    }
    
    // 创建新的本地书籍任务
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const task: BookTask = {
      id,
      bookName,
      status: 'done', // 本地书籍内容已存在，直接标记为done
      progress: 100,
      totalChapters: 0,
      currentChapter: 0,
      currentChapterName: '',
      remainingChapters: 0,
      chapterStructure: '',
      message: '本地内置书籍，内容已就绪',
      source: 'local',
      size: '',
      chars: 0,
      chapters: [],
      isLocalBook: true,
      logs: ['本地书籍，加入学习队列'],
      learningStatus: 'learning', // 立刻进入学习中，让用户看到状态变化
      learningProgress: 0,
      learningCurrentChunk: 0,
      learningTotalChunks: 0,
      learningMessage: '学习已加入队列',
      learningLayersDone: [],
      hasMissingChapters: false,
    missingChapterNames: [],
    learningCurrentChapter: 0,
    learningCurrentChapterName: '',
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      error: '',
    };
    
    // 写入独立学习任务文件（绕过 saveTasks HMR 闭包问题）
    // 用 bookName 作为 key，保持与 syncLocalLearnStatus 一致
    const learnTaskFile = path.join(TASKS_DIR, 'local-learn-tasks.json');
    let learnTasks: Record<string, Record<string, unknown>> = {};
    if (fs.existsSync(learnTaskFile)) {
      try { learnTasks = JSON.parse(fs.readFileSync(learnTaskFile, 'utf-8')); } catch {}
    }
    learnTasks[bookName] = {
      learningStatus: 'learning',
      learningProgress: 0,
      learningMessage: '学习已加入队列',
      taskId: id,
      startedAt: now,
    };
    fs.writeFileSync(learnTaskFile, JSON.stringify(learnTasks, null, 2), 'utf-8');
    
    tasks.set(id, task);
    localLearningQueue.push(id);
    started++;
  }
  
  // 同时写主任务文件（直接写磁盘，不依赖 saveTasks）
  try {
    const taskDir = path.dirname(TASKS_FILE);
    if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
    const allTasks = Array.from(tasks.values());
    const data = { tasks: allTasks, deletedIds: [] };
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[startLearningAllLocalBooks] 直接写磁盘失败:', e);
  }
  
  // 双写到 Supabase（持久化学习状态，确保退出 APP 后状态不丢失）
  try {
    saveTasks();
  } catch (e) {
    console.error('[startLearningAllLocalBooks] saveTasks 异常:', e);
  }

  // 关键：await 所有 task 同步到 Supabase 完成，保证返回前 db 已有完整状态
  try {
    const newTasks = Array.from(tasks.values()).filter(t => t.isLocalBook && t.learningStatus === 'learning');
    await Promise.all(newTasks.map(t => syncTaskToDb(t).catch(() => {})));
  } catch (e) {
    console.error('[startLearningAllLocalBooks] await syncTaskToDb 异常:', e);
  }

  // 启动队列处理
  processLocalLearningQueue();
  
  return { 
    total: localBooks.total, 
    started, 
    message: started > 0 
      ? `已启动 ${started} 本书的学习（${skipped} 本已学完跳过），并发数 ${MAX_CONCURRENT_LEARNING}` 
      : `共 ${localBooks.total} 本书，${skipped} 本已学完，无需再学习`
  };
}

/**
 * 启动单本书的学习
 * 用户在知识库每本书旁边点"开始学习"按钮调用此函数
 */
export async function startLearningSingleBook(bookName: string): Promise<{ success: boolean; message: string; taskId?: string }> {
  if (!isInitialized) initTaskManager();
  if (!bookName) return { success: false, message: '书名不能为空' };

  // 预加载书目 + 同步 db 任务
  try {
    const { loadBookCacheAsync } = await import('./fulltext-search');
    await loadBookCacheAsync();
  } catch (e) {
    console.warn('[startLearningSingleBook] 预加载失败', e);
  }
  try {
    await loadTasksFromDb();
  } catch (e) {
    console.warn('[startLearningSingleBook] loadTasksFromDb 失败', e);
  }

  // 检查 db 是否已 done
  try {
    const dbTask = await repoGetTaskByName(bookName);
    if (dbTask?.learning_status === 'done') {
      return { success: false, message: `《${bookName}》已学完，无需再学` };
    }
  } catch { /* 忽略 */ }

  // 检查是否已有任务
  let existingTask = Array.from(tasks.values()).find(t => t.bookName === bookName);
  
  const now = Date.now();
  if (existingTask) {
    if (existingTask.learningStatus === 'done') {
      return { success: false, message: `《${bookName}》已学完，无需再学` };
    }
    // 强制标记为 learning + 入队
    if (!localLearningQueue.includes(existingTask.id)) {
      localLearningQueue.push(existingTask.id);
    }
    existingTask.learningStatus = 'learning';
    existingTask.learningMessage = '学习已加入队列（单本启动）';
    existingTask.startedAt = existingTask.startedAt || now;
    existingTask.updatedAt = now;
    existingTask.isLocalBook = true;
  } else {
    // 创建新本地学习任务
    const id = `local-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const task: BookTask = {
      id,
      bookName,
      status: 'done',
      progress: 100,
      totalChapters: 0,
      currentChapter: 0,
      currentChapterName: '',
      remainingChapters: 0,
      chapterStructure: '',
      message: '本地内置书籍，内容已就绪',
      source: 'local',
      size: '',
      chars: 0,
      chapters: [],
      isLocalBook: true,
      logs: ['本地书籍，单本启动学习'],
      learningStatus: 'learning',
      learningProgress: 0,
      learningCurrentChunk: 0,
      learningTotalChunks: 0,
      learningMessage: '学习已加入队列（单本启动）',
      learningLayersDone: [],
      hasMissingChapters: false,
      missingChapterNames: [],
      learningCurrentChapter: 0,
      learningCurrentChapterName: '',
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      error: '',
    };
    tasks.set(id, task);
    localLearningQueue.push(id);
    existingTask = task;
  }

  // 持久化到 local-learn-tasks.json
  try {
    const learnTaskFile = path.join(TASKS_DIR, 'local-learn-tasks.json');
    let learnTasks: Record<string, Record<string, unknown>> = {};
    if (fs.existsSync(learnTaskFile)) {
      try { learnTasks = JSON.parse(fs.readFileSync(learnTaskFile, 'utf-8')); } catch {}
    }
    learnTasks[bookName] = {
      learningStatus: 'learning',
      learningProgress: 0,
      learningMessage: '学习已加入队列（单本启动）',
      taskId: existingTask.id,
      startedAt: now,
    };
    fs.writeFileSync(learnTaskFile, JSON.stringify(learnTasks, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[startLearningSingleBook] 写 local-learn-tasks.json 失败', e);
  }

  // 写主任务文件 + Supabase（关键：await 等 Supabase 持久化完成再返回，保证退出页面后状态不丢）
  try { saveTasks(); } catch (e) { console.warn('[startLearningSingleBook] saveTasks 异常', e); }
  try { await syncTaskToDb(existingTask); } catch (e) { console.warn('[startLearningSingleBook] syncTaskToDb 异常', e); }

  // 启动队列处理
  processLocalLearningQueue();
  
  return { success: true, message: `已启动《${bookName}》的学习`, taskId: existingTask.id };
}

/**
 * 处理本地书籍学习队列
 */
function processLocalLearningQueue(): void {
  while (localLearningActive < MAX_CONCURRENT_LEARNING && localLearningQueue.length > 0) {
    const taskId = localLearningQueue.shift()!;
    localLearningActive++;
    
    learnLocalBook(taskId).finally(() => {
      localLearningActive--;
      if (localLearningQueue.length > 0 || localLearningActive > 0) {
        processLocalLearningQueue();
      } else {
        localLearningStarted = false;
      }
    });
  }
}

/**
 * 同步本地学习状态到 local-learn-tasks.json
 * 用于跨 HMR / 重启时恢复学习进度
 */
function syncLocalLearnStatus(bookName: string, partial: {
  learningStatus?: 'pending' | 'learning' | 'done' | 'failed';
  learningProgress?: number;
  learningMessage?: string;
  learningLayersDone?: number[];
  learningCurrentChunk?: number;
  learningTotalChunks?: number;
  completedAt?: number | null;
}): void {
  try {
    const learnTaskFile = path.join(TASKS_DIR, 'local-learn-tasks.json');
    let learnTasks: Record<string, Record<string, unknown>> = {};
    if (fs.existsSync(learnTaskFile)) {
      try { learnTasks = JSON.parse(fs.readFileSync(learnTaskFile, 'utf-8')); } catch {}
    }
    const existing = learnTasks[bookName] || {};
    learnTasks[bookName] = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(learnTaskFile, JSON.stringify(learnTasks, null, 2), 'utf-8');
  } catch (e) {
    console.error('[syncLocalLearnStatus] 写入失败:', e);
  }
}

/**
 * 学习单本本地书籍
 */
async function learnLocalBook(taskId: string): Promise<void> {
  const task = tasks.get(taskId);
  if (!task) {
    return;
  }
  
  try {
    // 标记为 learning 状态（持久化到磁盘）
    updateTask(taskId, {
      learningStatus: 'learning',
      startedAt: task.startedAt || Date.now(),
      learningMessage: `开始读取《${task.bookName}》全文...`,
    });
    syncLocalLearnStatus(task.bookName, {
      learningStatus: 'learning',
      learningMessage: `开始读取《${task.bookName}》全文...`,
    });
    
    // 从fulltext-search读取本地书籍内容（先确保 Supabase 缓存已加载，再读 cache）
    const fulltextSearchMod = await import('./fulltext-search');
    const { getBookFullText, getBookFullTextAsync, markBookAsLearned, loadBookCacheAsync } = fulltextSearchMod as unknown as {
      getBookFullText: (n: string) => string;
      getBookFullTextAsync?: (n: string) => Promise<string | null>;
      markBookAsLearned: (n: string, c: number, t: number, s?: string) => void;
      loadBookCacheAsync: () => Promise<void>;
    };
    try {
      updateTask(taskId, { learningMessage: `📚 正在加载知识库缓存...` });
      await loadBookCacheAsync();
    } catch {}
    let bookContent = '';
    if (typeof getBookFullTextAsync === 'function') {
      updateTask(taskId, { learningMessage: `📖 正在从云端读取《${task.bookName}》全文...` });
      try { bookContent = (await getBookFullTextAsync(task.bookName)) || ''; } catch {}
    }
    if (!bookContent || bookContent.length < 100) {
      updateTask(taskId, { learningMessage: `📖 正在从本地读取《${task.bookName}》全文...` });
      bookContent = getBookFullText(task.bookName) || '';
    }
    if (bookContent && bookContent.length > 0) {
      updateTask(taskId, { learningMessage: `🔍 已读取全文 ${bookContent.length} 字，准备深度学习...` });
    }
    
    if (!bookContent || bookContent.trim().length === 0) {
      updateTask(taskId, {
        learningStatus: 'failed',
        learningMessage: `无法读取《${task.bookName}》的内容`,
      });
      syncLocalLearnStatus(task.bookName, {
        learningStatus: 'failed',
        learningMessage: `无法读取《${task.bookName}》的内容`,
      });
      return;
    }
    
    // 检测章节结构（按当前实际内容重新评估字数+章节数）
    const chaptersInfo = detectBookChapters(bookContent);
    const chapters = parseBookChapters(bookContent);
    if (chapters.length > 0) {
      updateTask(taskId, {
        totalChapters: chapters.length,
        currentChapter: chapters.length, // 本地书录入完成，currentChapter = totalChapters
        chapterStructure: chaptersInfo.structureType || '章',
        chars: bookContent.length,
      });
    }
    
    // 用最新的字数和章节数刷新 book-learn-status.json（覆盖之前过时的简版数据）
    markBookAsLearned(task.bookName, bookContent.length, chaptersInfo.totalChapters, chaptersInfo.structureType || '章');
    
    // 调用已有的processLearning（学习过程中会通过 updateTask 持续更新进度）
    await processLearning(taskId, bookContent);
    
    // 学习完成后更新learn-status
    const fulltextMod = await import('./fulltext-search');
    if (typeof fulltextMod.markBookLearned === 'function') {
      fulltextMod.markBookLearned(task.bookName, true);
    }
    
    // 最终状态同步到 local-learn-tasks.json
    const finalTask = tasks.get(taskId);
    syncLocalLearnStatus(task.bookName, {
      learningStatus: finalTask?.learningStatus === 'done' ? 'done' : 'failed',
      learningProgress: finalTask?.learningProgress ?? 100,
      learningMessage: finalTask?.learningMessage || '学习完成',
      learningLayersDone: finalTask?.learningLayersDone || [1, 2, 3, 4],
      learningCurrentChunk: finalTask?.learningCurrentChunk,
      learningTotalChunks: finalTask?.learningTotalChunks,
      completedAt: Date.now(),
    });
    
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack || '').split('\n').slice(0, 5).join('\n') : '';
    console.error(`[learnLocalBook] ❌ ${tasks.get(taskId)?.bookName} 学习失败: ${errMsg}\n${stack}`);
    updateTask(taskId, {
      learningStatus: 'failed',
      learningMessage: `学习失败: ${errMsg}`,
    });
    const bookName = tasks.get(taskId)?.bookName;
    if (bookName) {
      syncLocalLearnStatus(bookName, {
        learningStatus: 'failed',
        learningMessage: `学习失败: ${errMsg}`,
      });
    }
  }
}

/**
 * 获取本地书籍学习进度概览
 */
export function getLocalLearningProgress(): { 
  total: number; 
  learned: number; 
  learning: number; 
  pending: number; 
  failed: number;
  currentBooks: { name: string; progress: number; status: string }[];
} {
  if (!isInitialized) initTaskManager();
  
  const localTasks = Array.from(tasks.values()).filter(t => t.isLocalBook);
  let learned = 0, learning = 0, pending = 0, failed = 0;
  const currentBooks: { name: string; progress: number; status: string }[] = [];
  
  for (const t of localTasks) {
    switch (t.learningStatus) {
      case 'done': learned++; break;
      case 'learning': learning++; currentBooks.push({ name: t.bookName, progress: t.learningProgress, status: '学习中' }); break;
      case 'failed': failed++; break;
      default: pending++; break;
    }
  }
  
  return { total: localTasks.length, learned, learning, pending, failed, currentBooks };
}

// ============================================================================
// 🌐 Universal Crawler 一路到底的搜索-爬取-入库流程
//   - 这是 APP 的唯一搜索工具，按用户指令固化
//   - 替代之前的 webSearch + xuanji_fetch.py 双路并行
// ============================================================================
import { runCrawler, extractCandidateLinks, extractChapterLinks, buildSeedUrls } from './universal-crawler-client';

/**
 * 用 Universal Crawler 一路到底完成搜索 → 爬取目录 → 爬全部章节 → 拼接 → 入库
 * 成功返回 true（已写知识库 + 标记 done），失败返回 false（调用方可走兜底）
 */
async function tryUniversalCrawlerPipeline(taskId: string): Promise<boolean> {
  const task = tasks.get(taskId);
  if (!task) return false;
  const bookName = task.bookName;

  try {
    // ============ Step 1: 爬种子 URL（搜索引擎 + 全数据源搜索页）============
    updateTask(taskId, { status: 'searching', message: `🌐 Universal Crawler 搜索《${bookName}》中...` });
    addLog(taskId, `[Universal] Step 1: 爬种子 URL（搜索引擎 + 17 个数据源搜索页）`);

    const seedUrls = buildSeedUrls(bookName);
    const seedResult = await runCrawler({ urls: seedUrls, delay: 0.6, timeoutMs: 90_000 });
    const seedPagesOk = (seedResult.pages || []).filter(p => p.status_code === 200).length;
    addLog(taskId, `[Universal] 种子页爬完: ${seedPagesOk}/${seedUrls.length} 成功`);

    if (seedPagesOk === 0) {
      addLog(taskId, `[Universal] ⚠️ 所有种子 URL 均失败，回退兜底`);
      return false;
    }

    // ============ Step 2: 从种子页提取候选 URL ============
    const candidates = extractCandidateLinks(seedResult, bookName, 80);
    addLog(taskId, `[Universal] Step 2: 提取候选 URL ${candidates.length} 个`);

    if (candidates.length === 0) {
      addLog(taskId, `[Universal] ⚠️ 候选 URL 为 0，回退兜底`);
      return false;
    }

    // ============ Step 3: 爬候选 URL（拿到目录页 / 详情页） ============
    updateTask(taskId, { status: 'downloading', message: `🌐 Universal Crawler 抓取目录页...` });
    addLog(taskId, `[Universal] Step 3: 爬候选目录页 ${Math.min(candidates.length, 30)} 个...`);
    const dirResult = await runCrawler({ urls: candidates.slice(0, 30), delay: 0.6, timeoutMs: 120_000 });
    const dirPagesOk = (dirResult.pages || []).filter(p => p.status_code === 200);
    addLog(taskId, `[Universal] 目录页爬完: ${dirPagesOk.length}/30 成功`);

    // ============ Step 4: 提取章节链接 ============
    const chapterUrls = extractChapterLinks(dirResult, bookName, 300);
    addLog(taskId, `[Universal] Step 4: 发现章节链接 ${chapterUrls.length} 个`);

    let bookFullText = '';
    let chapterCount = 0;

    if (chapterUrls.length >= 3) {
      // ====== 走"目录 + 多章节"模式 ======
      updateTask(taskId, {
        status: 'downloading',
        message: `🌐 Universal Crawler 抓取 ${chapterUrls.length} 章正文...`,
      });
      addLog(taskId, `[Universal] Step 5: 批量爬 ${chapterUrls.length} 个章节...`);

      const chResult = await runCrawler({
        urls: chapterUrls,
        delay: 0.6,
        timeoutMs: 5 * 60_000,
      });
      const chPages = (chResult.pages || []).filter(p => p.status_code === 200 && (p.word_count ?? 0) > 100);
      chapterCount = chPages.length;
      addLog(taskId, `[Universal] 章节爬完: ${chapterCount}/${chapterUrls.length} 成功`);

      if (chapterCount < 3) {
        addLog(taskId, `[Universal] ⚠️ 有效章节数 < 3，回退兜底`);
        return false;
      }

      // 按 url 内的数字 ID 排序（章节通常按 ID 递增）
      chPages.sort((a, b) => {
        const numA = (a.url.match(/(\d{3,})/) || ['', '0'])[1];
        const numB = (b.url.match(/(\d{3,})/) || ['', '0'])[1];
        return Number(numA) - Number(numB);
      });

      const chapterContents: string[] = [];
      for (const p of chPages) {
        const title = (p.title || '').replace(/[-_].*$/, '').trim();
        chapterContents.push(`========== ${title} ==========\n\n${p.content_text}\n`);
      }
      bookFullText = chapterContents.join('\n\n');
    } else {
      // ====== 走"单页全文"模式（如维基文库/CText/archive.org）======
      addLog(taskId, `[Universal] 未识别多章节结构，启用单页全文模式`);
      const longestPage = dirPagesOk
        .filter(p => p.content_text && p.content_text.includes(bookName.slice(0, 2)))
        .sort((a, b) => b.word_count - a.word_count)[0];
      if (!longestPage || longestPage.word_count < 500) {
        addLog(taskId, `[Universal] ⚠️ 单页全文模式下未找到有效正文，回退兜底`);
        return false;
      }
      bookFullText = `========== ${longestPage.title} ==========\n\n${longestPage.content_text}`;
      chapterCount = 1;
      addLog(taskId, `[Universal] 单页全文: ${longestPage.word_count} 字`);
    }

    // ============ Step 5: 入库 ============
    updateTask(taskId, { status: 'saving', message: `🌐 录入知识库...` });
    addLog(taskId, `[Universal] Step 6: 入库 (${bookFullText.length} 字, ${chapterCount} 章)`);

    const sources = (dirResult.pages || []).map(p => p.url).filter(Boolean).slice(0, 10);
    const metadataHeader = [
      `《${bookName}》`,
      `来源: ${sources.join(' | ')}`,
      `字数: ${bookFullText.length}`,
      `章节: ${chapterCount}`,
      `录入方式: Universal Crawler`,
      ``,
    ].join('\n');

    const fullContent = metadataHeader + '\n' + bookFullText;
    addBookToKnowledgeBase(bookName, fullContent);
    saveBook(bookName, fullContent);

    // ============ Step 6: 完成 → 待学习 ============
    updateTask(taskId, {
      status: 'done',
      progress: 100,
      message: `✅ 已录入 ${chapterCount} 章, ${bookFullText.length} 字`,
      completedAt: Date.now(),
      learningStatus: 'pending',
      learningMessage: `✅ 录入完成。当前状态：待学习。请到知识库页面点击「开始学习」按钮统一启动学习。`,
    });
    addLog(taskId, `[Universal] ✅ 录入完成，等待用户手动开始学习`);
    return true;
  } catch (e) {
    addLog(taskId, `[Universal] ❌ 异常: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

