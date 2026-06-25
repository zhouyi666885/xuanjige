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
import { Config, LLMClient, SearchClient, FetchClient, FetchContentItem } from 'coze-coding-dev-sdk';
import { isBookExists, addBookToKnowledgeBase, findBooksByName } from './fulltext-search';
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
  chapters: BookChapter[]; // 原书章节结构
  chapterStructure: string; // 原书编排方式描述，如"卷+章"、"篇"、"章"
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

    // 3. 确认原书章节数（搜索"书名 目录"获取原书结构）
    updateTask(taskId, {
      status: 'searching',
      message: `正在确认《${task.bookName}》原书章节结构...`,
      progress: 3,
    });

    let confirmedChapterInfo: ConfirmedChapters | null = null;

    try {
      const tocResponse = await searchClient.search({ query: `${task.bookName} 目录 章节 全部` });
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
          addLog(taskId, `确认原书章节: ${detected.structureType || '章'}, 共 ${detected.totalChapters} 章`);
        }
      }
    } catch {
      // 确认失败不影响后续流程
      addLog(taskId, '无法确认原书章节数，将从内容中推断');
    }

    // 4. 逐个来源尝试获取全文
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
      message: `《${task.bookName}》已进入知识库`,
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
      currentChapterName: '准备摘录...',
      message: `原书结构: 共 ${totalChapterCount} ${chapterType}`,
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
      // 优先显示确认的章节名
      const currentChapterName = (finalChapters[currentChapterIdx - 1] || currentChapterInfo).name;

      // 只在章节变化时更新章节信息
      if (currentChapterIdx !== lastChapterIdx || progress >= 99) {
        lastChapterIdx = currentChapterIdx;
        updateTask(taskId, {
          progress,
          currentChapter: currentChapterIdx,
          totalChapters: totalChapterCount,
          remainingChapters: totalChapterCount - currentChapterIdx,
          currentChapterName: currentChapterName,
          message: `正在摘录: ${currentChapterName.substring(0, 20)} (${currentChapterIdx}/${totalChapterCount})`,
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
  
  // 4. 一次性保存完整内容到知识库
  const task = tasks.get(taskId);
  if (!task || !processingQueue.has(taskId)) return;
  
  try {
    addBookToKnowledgeBase(task.bookName, content);
    saveBook(task.bookName, content);
    const chapterCount = totalChapterCount > 0 ? totalChapterCount : content.split(/\n{2,}/).filter((p: string) => p.trim().length > 0).length;
    addLog(taskId, `保存完成: ${chapterCount} ${chapterType}, ${content.length} 字`);
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
      chapters: [],
      chapterStructure: '',
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
    chapterStructure: '',
    chapters: [],
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
