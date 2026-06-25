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
import { Config, LLMClient, SearchClient, FetchClient } from 'coze-coding-dev-sdk';
import { isBookExists, addBookToKnowledgeBase, findBooksByName } from './fulltext-search';
import { saveBook } from './book-storage';

// ==================== 类型定义 ====================

interface BookTask {
  id: string;
  bookName: string;
  status: 'pending' | 'searching' | 'downloading' | 'translating' | 'saving' | 'done' | 'failed' | 'copyright' | 'exists';
  progress: number; // 0-100
  currentChapter: number;
  totalChapters: number;
  currentChapterName: string;
  remainingChapters: number;
  message: string;
  source: string;
  size: string;
  chars: number;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string;
  logs: string[];
}

// ==================== 全局状态 ====================

const TASKS_FILE = path.join(process.cwd(), 'public', 'book-tasks.json');
let tasks: Map<string, BookTask> = new Map();
let processingQueue: Set<string> = new Set();
let isInitialized = false;

// ==================== 持久化 ====================

function loadTasks(): void {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
      const arr: BookTask[] = data.tasks || [];
      for (const task of arr) {
        tasks.set(task.id, task);
      }
      console.log(`[TaskManager] 已加载 ${tasks.size} 个任务`);
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
    const arr = Array.from(tasks.values());
    fs.writeFileSync(TASKS_FILE, JSON.stringify({ tasks: arr }, null, 2));
  } catch (e) {
    console.error('[TaskManager] 保存任务失败:', e);
  }
}

// ==================== 任务操作 ====================

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function updateTask(id: string, updates: Partial<BookTask>): BookTask | null {
  const task = tasks.get(id);
  if (!task) return null;
  
  Object.assign(task, updates, { updatedAt: Date.now() });
  tasks.set(id, task);
  saveTasks(); // 每次更新都持久化
  return task;
}

function addLog(id: string, message: string): void {
  const task = tasks.get(id);
  if (!task) return;
  task.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (task.logs.length > 100) task.logs = task.logs.slice(-50);
  task.updatedAt = Date.now();
  saveTasks();
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
    // 1. 检查是否已存在
    if (isBookExists(task.bookName)) {
      updateTask(taskId, {
        status: 'exists',
        message: `《${task.bookName}》已有这本书`,
        progress: 100,
        completedAt: Date.now(),
      });
      addLog(taskId, '检测到知识库中已有此书');
      return;
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

    // 2. 搜索书籍来源
    const searchQueries = [
      `${task.bookName} 全文`,
      `${task.bookName} 原文 完整版`,
      `${task.bookName} text full`,
      `${task.bookName} site:gutenberg.org`,
      `${task.bookName} filetype:txt`,
    ];

    let allResults: Array<{ url: string; title: string; snippet: string }> = [];

    for (const query of searchQueries) {
      try {
        const response = await searchClient.search({ query });
        if (response?.web_items) {
          for (const r of response.web_items) {
            if (r.url && !allResults.some(x => x.url === r.url)) {
              allResults.push({ url: r.url, title: r.title || '', snippet: r.snippet || '' });
            }
          }
        }
      } catch (e) {
        // 继续尝试下一个搜索词
      }
    }

    addLog(taskId, `搜索到 ${allResults.length} 个来源`);

    if (allResults.length === 0) {
      updateTask(taskId, {
        status: 'copyright',
        message: `因版权问题无法摘录《${task.bookName}》`,
        progress: 0,
        completedAt: Date.now(),
      });
      addLog(taskId, '所有来源均未找到此书');
      return;
    }

    // 3. 逐个来源尝试获取全文
    let bookContent = '';
    let usedSource = '';
    let foundContent = false;

    updateTask(taskId, {
      status: 'downloading',
      message: `找到 ${allResults.length} 个来源，正在获取内容...`,
      progress: 5,
    });

    for (let i = 0; i < allResults.length; i++) {
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
            bookContent = texts.join('\n\n');
            usedSource = source.url;
            foundContent = true;
            addLog(taskId, `从 ${source.url} 获取到 ${bookContent.length} 字符`);
            break;
          }
        }
      } catch (e) {
        addLog(taskId, `来源 ${source.url} 获取失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!foundContent || bookContent.length < 200) {
      updateTask(taskId, {
        status: 'copyright',
        message: `因版权问题无法摘录《${task.bookName}》`,
        progress: 0,
        completedAt: Date.now(),
      });
      addLog(taskId, `遍历 ${allResults.length} 个来源均未获取到有效内容`);
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

    await saveWithProgress(taskId, bookContent);

    // 6. 完成
    const chapters = bookContent.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
    const sizeKB = (Buffer.byteLength(bookContent, 'utf-8') / 1024).toFixed(1);

    updateTask(taskId, {
      status: 'done',
      message: `《${task.bookName}》已进入知识库`,
      progress: 100,
      totalChapters: chapters.length,
      currentChapter: chapters.length,
      remainingChapters: 0,
      source: usedSource,
      size: `${sizeKB}KB`,
      chars: bookContent.length,
      completedAt: Date.now(),
    });
    addLog(taskId, `摘录完成: ${chapters.length} 章, ${bookContent.length} 字`);

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

// ==================== 分章保存 ====================

async function saveWithProgress(taskId: string, content: string): Promise<void> {
  const paragraphs = content.split(/\n{2,}/).filter(p => p.trim().length > 0);
  const total = paragraphs.length;
  
  // 先构建完整内容再一次性保存（确保完整性）
  // 但实时更新进度
  const batchSize = Math.max(1, Math.floor(total / 20)); // 分20次更新进度
  
  for (let i = 0; i < total; i += batchSize) {
    if (!processingQueue.has(taskId)) {
      addLog(taskId, '摘录被取消');
      return;
    }
    
    const current = Math.min(i + batchSize, total);
    const progress = 50 + Math.floor((current / total) * 50);
    const chapterName = paragraphs[i]?.substring(0, 20)?.replace(/\n/g, '') || `第${current}段`;
    
    updateTask(taskId, {
      progress,
      currentChapter: current,
      totalChapters: total,
      remainingChapters: total - current,
      currentChapterName: chapterName,
      message: `正在摘录: ${chapterName.substring(0, 15)} (${current}/${total})`,
    });
    
    // 小延迟让进度可见
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 一次性保存完整内容到知识库
  const task = tasks.get(taskId);
  if (!task || !processingQueue.has(taskId)) return;
  
  try {
    addBookToKnowledgeBase(task.bookName, content);
    saveBook(task.bookName, content);
    addLog(taskId, `保存完成: ${total} 章, ${content.length} 字`);
  } catch (e) {
    addLog(taskId, `保存失败: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

// ==================== 公开API ====================

/**
 * 初始化任务管理器（服务器启动时调用）
 */
export function initTaskManager(): void {
  if (isInitialized) return;
  isInitialized = true;
  
  loadTasks();
  
  // 自动恢复未完成的任务
  let resumed = 0;
  for (const [id, task] of tasks) {
    if (['pending', 'searching', 'downloading', 'translating', 'saving'].includes(task.status)) {
      // 重置为pending让任务重新开始
      updateTask(id, { status: 'pending', progress: 0, message: '等待自动恢复...' });
      resumed++;
      // 异步处理，不阻塞初始化
      setTimeout(() => processTask(id), Math.random() * 5000);
    }
  }
  
  if (resumed > 0) {
    console.log(`[TaskManager] 自动恢复 ${resumed} 个未完成任务`);
  }
}

/**
 * 创建新任务
 */
export function createTask(bookName: string): { task: BookTask; isNew: boolean } {
  if (!isInitialized) initTaskManager();
  
  // 检查是否已有同名任务
  for (const [, existing] of tasks) {
    if (existing.bookName === bookName && ['pending', 'searching', 'downloading', 'translating', 'saving'].includes(existing.status)) {
      return { task: existing, isNew: false };
    }
  }
  
  // 检查知识库是否已有此书
  if (isBookExists(bookName)) {
    const id = generateId();
    const task: BookTask = {
      id,
      bookName,
      status: 'exists',
      message: `《${bookName}》已有这本书`,
      progress: 100,
      currentChapter: 0,
      totalChapters: 0,
      currentChapterName: '',
      remainingChapters: 0,
      source: '',
      size: '',
      chars: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: '',
      logs: ['检测到知识库中已有此书'],
    };
    tasks.set(id, task);
    saveTasks();
    return { task, isNew: true };
  }
  
  const id = generateId();
  const task: BookTask = {
    id,
    bookName,
    status: 'pending',
    message: '等待开始...',
    progress: 0,
    currentChapter: 0,
    totalChapters: 0,
    currentChapterName: '',
    remainingChapters: 0,
    source: '',
    size: '',
    chars: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: null,
    completedAt: null,
    error: '',
    logs: [],
  };
  
  tasks.set(id, task);
  saveTasks();
  
  // 异步开始处理（不阻塞返回）
  setTimeout(() => processTask(id), 500);
  
  return { task, isNew: true };
}

/**
 * 获取所有任务
 */
export function getAllTasks(): BookTask[] {
  if (!isInitialized) initTaskManager();
  return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 获取单个任务
 */
export function getTask(taskId: string): BookTask | null {
  if (!isInitialized) initTaskManager();
  return tasks.get(taskId) || null;
}

/**
 * 取消/删除任务
 */
export function deleteTask(taskId: string): boolean {
  if (!isInitialized) initTaskManager();
  
  // 如果正在处理，从处理队列移除
  processingQueue.delete(taskId);
  
  const task = tasks.get(taskId);
  if (!task) return false;
  
  // 如果任务已完成（done），同时从知识库删除
  if (task.status === 'done') {
    const { deleteBookFromKnowledgeBase } = require('./fulltext-search');
    deleteBookFromKnowledgeBase(task.bookName);
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
