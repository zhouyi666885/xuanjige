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
import { Config, LLMClient, SearchClient, FetchClient, FetchContentItem, KnowledgeClient } from 'coze-coding-dev-sdk';
import { isBookExists, addBookToKnowledgeBase, findBooksByName, getLocalBookInfo } from './fulltext-search';
import { saveBook } from './book-storage';

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

const TASKS_FILE = path.join(process.cwd(), 'public', 'book-tasks.json');
const TASKS_DIR = path.join(process.cwd(), 'public');
// 独立的墓碑文件（旧 HMR 闭包不会触碰它，确保已删除任务不会被旧逻辑复活）
const TOMBSTONE_FILE = path.join(process.cwd(), 'public', 'book-tasks-tombstones.json');
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

export function cancelTask(taskId: string): boolean {
  const task = tasks.get(taskId);
  if (!task) {
    return false;
  }
  cancelledTasks.add(taskId);
  pausedTasks.delete(taskId);
  tasks.delete(taskId);
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
  tasks.set(id, task);
  saveTasks(); // 每次更新都持久化
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
      const localFile = path.join(process.cwd(), 'public/book-content', `${task.bookName}.txt`);
      if (fs.existsSync(localFile)) {
        const chars = fs.statSync(localFile).size;
        updateTask(taskId, {
          status: 'done',
          progress: 100,
          message: `《${task.bookName}》已录入完成（检测到本地全文文件）`,
          chars: chars > 0 ? chars : task.chars,
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
    // 🌐 Book Finder 与 Book Crawler 共用同一份全网数据源池（18个固定站点），平等遍历无分工
    // 每个站点都用 site: 限定 webSearch 查询一次，确保 A 路覆盖到全部站点
    const ALL_SITE_DOMAINS = [
      'ctext.org',                  // CText 中国哲学书电子化计划
      'so.gushiwen.cn',             // 古诗文网
      'guoxuedashi.net',            // 国学大师
      'cidianwang.com',             // 词典网
      'shicimingju.com',            // 诗词名句网
      'zhonghuadiancang.com',       // 中华典藏
      'guoxuemeng.com',             // 国学梦
      'zh.wikisource.org',          // 中文维基文库
      'reader.qq.com',              // QQ阅读
      'dingdiann.com',              // 顶点小说
      'guidaye.cn',                 // 鬼大爷
      '25zw.com',                   // 25zw
      'xbiquge.so',                 // 笔趣阁
      'quanben5.com',               // 全本小说网
      'shuhai.tw',                  // 书海小说网
      '360doc.com',                 // 360doc个人图书馆
      'archive.org',                // Internet Archive
      'openlibrary.org',            // OpenLibrary
      'gutenberg.org',              // Project Gutenberg
      'en.wikisource.org',          // 英文维基文库
    ];

    // ⚡ 用户规则：搜索只用书名，不拼接任何关键词
    // 通用一条 + 为每个固定站点单发一条 site: 查询（仅在站点内搜书名）
    const initialSearchQueries = [
      `${task.bookName}`,
      ...ALL_SITE_DOMAINS.map(domain => `${task.bookName} site:${domain}`),
    ];

    let allResults: Array<{ url: string; title: string; snippet: string }> = [];

    // 基础搜索：先快速搜一遍（使用 webSearch 推荐方法）
    for (const query of initialSearchQueries) {
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
    addLog(taskId, `基础搜索完成，找到 ${allResults.length} 个来源`);

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
            timeout: 5 * 60 * 1000, // 5分钟超时
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
    // 🔴🔴🔴 没有搜索时间限制！没有搜索次数限制！没有搜索轮数限制！
    // 用户明确要求：不限时间、不限轮数、不限次数
    // 唯一的停止条件：连续3个完整循环都没有新结果 = 真正穷尽了所有可能性

    // 🔴🔴🔴 核心逻辑：搜遍全网
    // 每个searchRound都要完整跑一遍，一轮都不能跳过
    // 全跑完后，如果还没找到，再从头循环继续搜
    // 🔴 没有连续几轮的限制！不存在"连续X轮没新结果就停"这回事
    // 只要还在发现新结果，就继续搜；只有真正穷尽一切可能性，确认 nowhere to be found，才停下
    // "搜了三遍没找到" ≠ 搜遍全网。搜遍全网 = 真的 nowhere to be found
    const TOTAL_ROUNDS = searchRounds.length; // 16轮

    let completedFullCycles = 0;
    let resultsInCurrentCycle = 0;
    let consecutiveEmptyCycles = 0;

    // 🔴🔴🔴 没有时间限制！没有轮数限制！没有次数限制！
    // 唯一停止条件：连续3个完整循环都没发现新结果（真正穷尽了）
    while (consecutiveEmptyCycles < 3) {
      // 🔴 检查暂停/取消
      const checkResult = checkTaskControl(taskId);
      if (checkResult === 'cancelled') return;
      if (checkResult === 'paused') break; // 退出搜索循环，暂停

      const round = searchRounds[roundIndex % TOTAL_ROUNDS];
      const beforeCount = allResults.length;

      for (const query of round.queries) {
        // 🔴 每个查询前也检查暂停/取消
        const qCheck = checkTaskControl(taskId);
        if (qCheck === 'cancelled') return;
        if (qCheck === 'paused') break;

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
          // 继续搜索下一个
        }
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

    // 只有一种情况判定版权问题：全网所有渠道全部搜遍，确认找不到
    if (allResults.length === 0) {
      updateTask(taskId, {
        status: 'copyright',
        message: `已穷尽全网搜索（${completedFullCycles}轮完整循环×${TOTAL_ROUNDS}个渠道=共${roundIndex}轮搜索，涵盖百度/搜狗/必应/360搜索引擎+百度文库/道客巴巴/豆丁文档平台+知乎/豆瓣/贴吧/微博社区+古籍数据库/学术平台+网盘/书源），确认 nowhere to be found，均未找到《${task.bookName}》的完整内容`,
        progress: 0,
        completedAt: Date.now(),
      });
      addLog(taskId, `共${roundIndex}轮搜索均未找到此书，判定为版权问题`);
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
      // ⚡ 用户规则：搜索只用书名
      const tocResponse = await searchClient.webSearch(`${task.bookName}`, 10);
      if (tocResponse?.web_items && tocResponse.web_items.length > 0) {
        // 从搜索结果摘要中提取原书章节信息
        const tocSnippets = tocResponse.web_items
          .map((item: { snippet?: string; title?: string }) => `${item.title || ''} ${item.snippet || ''}`)
          .join('\n');
        
        // 尝试获取前2个目录页面的完整内容
        let fullTocContent = tocSnippets;
        for (const item of tocResponse.web_items.slice(0, 2)) {
          try {
            const itemUrl = (item as { url?: string }).url;
            if (!itemUrl) continue;
            const tocFetch = await fetchClient.fetch(itemUrl);
            if (tocFetch && Array.isArray(tocFetch.content)) {
              const tocText = tocFetch.content
                .filter((c: FetchContentItem): c is FetchContentItem & { text: string } => c.type === 'text' && typeof c.text === 'string')
                .map((c: FetchContentItem & { text: string }) => c.text)
                .join('\n');
              fullTocContent += '\n' + tocText;
            }
          } catch { /* continue */ }
        }

        // 从目录内容中解析章节
        const detected = detectBookChapters(fullTocContent);
        if (detected.chapterNames.length > 0) {
          confirmedChapterInfo = detected;
          // 立即更新结构信息，让前端可以显示原书叫法
          updateTask(taskId, {
            chapterStructure: detected.structureType || '章',
            totalChapters: detected.totalChapters,
          });
          addLog(taskId, `确认原书章节: ${detected.structureType || '章'}, 共 ${detected.totalChapters} ${detected.structureType || '章'}`);
        }
      }
    } catch {
      // 确认失败不影响后续流程
      addLog(taskId, '无法确认原书章节数，将从内容中推断');
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

    // 跨网站拼接：如果单个来源不够长，尝试将多个来源的内容拼接
    if (bookContent.length < 2000 && contentFragments.length >= 2) {
      addLog(taskId, `单个来源最长仅 ${bookContent.length} 字符，尝试跨网站拼接 ${contentFragments.length} 个来源的内容...`);
      bookContent = mergeContentFragments(contentFragments, taskId);
      usedSource = contentFragments.map(f => f.source).join(' + ');
      addLog(taskId, `拼接后总内容: ${bookContent.length} 字符`);
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
    const cnChars = [...bookContent.substring(0, 2000)].filter(c => c.charCodeAt(0) >= 0x4e00 && c.charCodeAt(0) <= 0x9fff).length;
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

    updateTask(taskId, {
      status: 'done',
      message: `《${task.bookName}》已录入知识库，准备开始AI学习...`,
      progress: 100,
      totalChapters: finalChapterCount,
      currentChapter: finalChapterCount,
      remainingChapters: 0,
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
async function processLearning(taskId: string, bookContent: string): Promise<void> {
  const task = tasks.get(taskId);
  if (!task) return;
  // 允许已录入完成的书和本地内置书籍进行学习
  if (!task.isLocalBook && task.status !== 'done') return;

  // 如果已经在学习中或已学完，跳过
  if (task.learningStatus === 'learning' || task.learningStatus === 'done') return;

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
    const CHUNK_SIZE = 3000;
    const chunks: string[] = [];
    
    const paragraphs = bookContent.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
    let currentChunk = '';
    
    for (const para of paragraphs) {
      if (currentChunk.length + para.length + 2 > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    const totalChunks = chunks.length;
    updateTask(taskId, {
      learningTotalChunks: totalChunks,
      learningCurrentChunk: 0,
      learningMessage: `AI学习中: 共${totalChunks}块内容待学习...`,
    });
    addLog(taskId, `学习分块: ${totalChunks} 块, 目标表: ${tableName}`);

    // ======== 第二步：逐块深度学习 ========
    // 对每一块内容，AI进行4层理解：术语→逻辑→关联→应用
    const llmClient = new LLMClient(config);
    const learnedChunks: string[] = [];
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

      processedChunks = i + 1;
      const progress = Math.floor((processedChunks / totalChunks) * 100);
      // 更新学习层次进度
      const layersDone: number[] = [];
      if (progress >= 25) layersDone.push(1); // ①术语理解
      if (progress >= 50) layersDone.push(2); // ②逻辑推理
      if (progress >= 75) layersDone.push(3); // ③交叉关联
      updateTask(taskId, {
        learningProgress: progress,
        learningCurrentChunk: processedChunks,
        learningLayersDone: layersDone,
        learningMessage: `AI学习中: ${processedChunks}/${totalChunks}块 (${progress}%) - 正在理解术语/逻辑/关联/应用`,
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
          learningMessage: `AI学习中: ${processedChunks}/${totalChunks}块 (${progress}%)`,
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

    // ======== 学习完成 ========
    updateTask(taskId, {
      learningStatus: 'done',
      learningProgress: 100,
      learningCurrentChunk: totalChunks,
      learningTotalChunks: totalChunks,
      learningLayersDone: [1, 2, 3, 4],
      learningMessage: `AI已深度学完《${task.bookName}》全部内容 (${totalChunks}块, 含术语理解+逻辑掌握+知识关联+应用方法)`,
    });
    addLog(taskId, `深度学习完成: ${totalChunks}块 → ${tableName} (含4层学习笔记)`);

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    updateTask(taskId, {
      learningStatus: 'failed',
      learningMessage: `AI学习失败: ${errMsg}`,
    });
    addLog(taskId, `学习失败: ${errMsg}`);
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
        const filePath = path.join(process.cwd(), 'public/book-content', `${task.bookName}.txt`);
        let chars = task.chars;
        try {
          if (fs.existsSync(filePath)) {
            chars = fs.statSync(filePath).size; // 用文件大小作为字符数近似值
          }
        } catch {}
        
        // 从 local-learn-tasks.json 恢复学习状态（如果之前学完了，保持 done）
        const learnInfo = localLearnStatus[task.bookName];
        const isLearningDone = learnInfo?.learningStatus === 'done';
        
        updateTask(id, {
          status: 'done',
          progress: 100,
          message: `《${task.bookName}》已录入完成（状态自动同步：检测到本地全文文件）`,
          chars: chars > 0 ? chars : task.chars,
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
export function createTask(bookName: string): { task: BookTask; isNew: boolean } {
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
  
  // 🔴 状态同步铁律：本地物理文件已存在 → 直接标 done，不进入搜索
  // 避免出现"知识库有该书"但"添加书籍页还显示搜索中"的矛盾
  let localFileExists = false;
  let localFileChars = 0;
  try {
    const filePath = path.join(process.cwd(), 'public/book-content', `${bookName}.txt`);
    if (fs.existsSync(filePath)) {
      localFileExists = true;
      localFileChars = fs.statSync(filePath).size;
    }
  } catch { /* 忽略 */ }
  
  const id = generateId();
  const task: BookTask = {
    id,
    bookName,
    status: localFileExists ? 'done' : 'pending',
    message: localFileExists 
      ? `《${bookName}》已存在于知识库（检测到本地全文文件）` 
      : '等待开始...',
    progress: localFileExists ? 100 : 0,
    currentChapter: 0,
    totalChapters: 0,
    currentChapterName: '',
    remainingChapters: 0,
    source: localFileExists ? '本地' : '',
    size: '',
    chars: localFileChars,
    learningStatus: 'pending',
    learningProgress: 0,
    learningCurrentChunk: 0,
    learningTotalChunks: 0,
    learningMessage: localFileExists 
      ? '⏳ 待学习（在知识库点击"开始学习"启动）' 
      : '等待录入完成...',
    learningLayersDone: [],
    hasMissingChapters: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: localFileExists ? Date.now() : null,
    completedAt: localFileExists ? Date.now() : null,
    error: '',
    logs: localFileExists ? [`[${new Date().toLocaleTimeString()}] 检测到本地全文文件，直接标记为已录入`] : [],
    chapterStructure: '',
    chapters: [],
  };

  tasks.set(id, task);
  saveTasks();
  
  // 异步开始处理（不阻塞返回）；如果本地已存在则跳过录入流程
  if (!localFileExists) {
    setTimeout(() => processTask(id), 500);
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
  
  // 如果任务已完成（done）或进行中（processing），都要从知识库删除
  // 进行中的任务可能已经部分写入了知识库，必须清除残留
  if (task.status === 'done' || task.status === 'saving') {
    try {
      const { removeBookFromKnowledgeBase } = require('./fulltext-search');
      removeBookFromKnowledgeBase(task.bookName);
    } catch {
      // 忽略删除错误
    }
  }
  
  tasks.delete(taskId);
  saveTasks();
  return true;
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
const MAX_CONCURRENT_LEARNING = 3;
let localLearningActive = 0;
let localLearningQueue: string[] = []; // taskId队列
let localLearningStarted = false;

/**
 * 开始学习所有本地内置书籍
 * 从fulltext-search获取本地书籍列表，创建学习任务，按队列逐本学习
 */
export async function startLearningAllLocalBooks(): Promise<{ total: number; started: number; message: string }> {
  if (!isInitialized) initTaskManager();
  
  if (localLearningStarted) {
    return { total: 0, started: 0, message: '学习已在进行中' };
  }
  localLearningStarted = true;
  
  // 动态导入避免循环依赖
  const { getLocalBookInfo } = await import('./fulltext-search');
  const localBooks = getLocalBookInfo();
  
  if (localBooks.total === 0) {
    localLearningStarted = false;
    return { total: 0, started: 0, message: '没有本地书籍需要学习' };
  }
  
  let started = 0;
  let skipped = 0;
  
  for (const bookName of localBooks.bookNames) {
    // 检查是否已有任务
    const existingTask = Array.from(tasks.values()).find(
      t => t.bookName === bookName && t.isLocalBook
    );
    
    if (existingTask) {
      // 已有任务，检查学习状态
      if (existingTask.learningStatus === 'done') {
        skipped++;
        continue; // 已学完，跳过
      }
      if (existingTask.learningStatus === 'learning') {
        skipped++;
        continue; // 正在学习，跳过
      }
      // 待学习或失败，加入队列
      localLearningQueue.push(existingTask.id);
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
      logs: ['本地书籍，等待学习'],
      learningStatus: 'pending',
      learningProgress: 0,
      learningCurrentChunk: 0,
      learningTotalChunks: 0,
      learningMessage: '等待开始学习',
      learningLayersDone: [],
      hasMissingChapters: false,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
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
      learningStatus: 'pending',
      learningProgress: 0,
      learningMessage: '等待开始学习',
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
  
  // 启动队列处理
  processLocalLearningQueue();
  
  return { 
    total: localBooks.total, 
    started, 
    message: `开始学习 ${started} 本本地书籍（${skipped} 本已学完跳过），并发数 ${MAX_CONCURRENT_LEARNING}` 
  };
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
    
    // 从fulltext-search读取本地书籍内容
    const { getBookFullText } = await import('./fulltext-search');
    const bookContent = getBookFullText(task.bookName);
    
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
    
    // 检测章节结构
    const chapters = parseBookChapters(bookContent);
    if (chapters.length > 0) {
      updateTask(taskId, {
        totalChapters: chapters.length,
        chapterStructure: chapters.map(c => c.name).join(', '),
      });
    }
    
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

