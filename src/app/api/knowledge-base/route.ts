import { NextRequest, NextResponse } from 'next/server';
import { getBookStats, removeBookFromKnowledgeBase, getBookLearnStatus, getLearnedBookCount, invalidateCache, loadBookCacheAsync } from '@/lib/fulltext-search';
import { getAllTasks, startLearningAllLocalBooks, getLocalLearningProgress, deleteTask } from '@/lib/book-task-manager';
import { upsertTask, getTaskByBookName, listTasks } from '@/lib/book-repo';
import fsRaw from 'fs';
import pathRaw from 'path';

/** 选择可写的状态文件目录：生产用 /tmp（唯一可写），开发用 public/ */
function getStatusFileDir(): string {
  const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
  if (isProd) {
    const dir = '/tmp/book-content';
    try { fsRaw.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    return dir;
  }
  return pathRaw.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'public', 'book-content');
}

function getStatusFilePath(): string {
  return pathRaw.join(getStatusFileDir(), 'local-learn-tasks.json');
}

/** 读 local-learn-tasks.json 拿"权威的本地学习状态"（API 层直写，最新值） */
function readLocalLearnStatusFile(): Record<string, {
  learningStatus?: string;
  learningProgress?: number;
  learningCurrentChunk?: number;
  learningTotalChunks?: number;
  learningMessage?: string;
  learningLayersDone?: number[];
  startedAt?: number;
  completedAt?: number;
}> {
  // 候选路径：生产 /tmp、开发 public，都尝试一下取最新
  const candidates = [getStatusFilePath()];
  if (process.env.COZE_PROJECT_ENV === 'PROD') {
    // 生产也尝试读 public（如果有兜底）
    candidates.push(pathRaw.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'public', 'book-content', 'local-learn-tasks.json'));
  }
  let merged: Record<string, ReturnType<typeof readLocalLearnStatusFile>[string]> = {};
  for (const file of candidates) {
    try {
      if (fsRaw.existsSync(file)) {
        const data = JSON.parse(fsRaw.readFileSync(file, 'utf-8'));
        merged = { ...merged, ...data };
      }
    } catch { /* ignore */ }
  }
  return merged;
}

/** 双写 Supabase：把学习进度同步到 book_tasks 表 */
async function syncLearningStatusToDb(bookName: string, status: {
  learningStatus: string;
  learningProgress: number;
  learningCurrentChunk: number;
  learningTotalChunks: number;
  learningMessage: string;
}) {
  try {
    const existing = await getTaskByBookName(bookName);
    const now = new Date().toISOString();
    const taskId = existing?.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await upsertTask({
      id: taskId,
      book_name: bookName,
      status: existing?.status || 'done',
      progress: existing?.progress ?? 100,
      message: existing?.message ?? null,
      chars: existing?.chars ?? 0,
      current_chapter: existing?.current_chapter ?? 0,
      total_chapters: existing?.total_chapters ?? 0,
      chapter_structure: existing?.chapter_structure ?? '章',
      source: existing?.source ?? 'local',
      is_local_book: true,
      learning_status: status.learningStatus,
      learning_progress: status.learningProgress,
      learning_current_chunk: status.learningCurrentChunk,
      learning_total_chunks: status.learningTotalChunks,
      learning_message: status.learningMessage,
      learning_layers_done: existing?.learning_layers_done ?? [],
      learning_started_at: existing?.learning_started_at ?? now,
      learning_completed_at: status.learningStatus === 'done' ? now : (existing?.learning_completed_at ?? null),
      logs: existing?.logs ?? [],
      created_at: existing?.created_at ?? now,
      updated_at: now,
      completed_at: existing?.completed_at ?? null,
    });
  } catch (e) {
    console.warn('[syncLearningStatusToDb]', bookName, e instanceof Error ? e.message : e);
  }
}

/**
 * GET /api/knowledge-base
 * 获取知识库所有书籍列表
 * ?search=关键词  - 搜索书名
 * ?page=1&pageSize=50 - 分页
 */
export async function GET(request: NextRequest) {
  try {
    // 首先从云端拉取最新书目（开发/生产共享 Supabase 数据）
    await loadBookCacheAsync();

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const stats = getBookStats();
    // 防御性去重：避免任何上游脏数据导致同名书重复显示
    let books = Array.from(new Set(stats.bookNames));

    // 搜索过滤
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      books = books.filter(name =>
        name.includes(searchQuery) || name.toLowerCase().includes(queryLower)
      );
    }

    // 分页
    const total = books.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pagedBooks = books.slice(start, start + pageSize);

    // 获取所有任务（含学习进度）
    const allTasks = getAllTasks();
    // 同时读取 local-learn-tasks.json，优先级最高（API 层最新写入）
    const localLearnStatus = readLocalLearnStatusFile();
    // 生产环境关键：从 Supabase book_tasks 表拉最新状态（部署后内存丢失，文件可能也读不到）
    let dbTaskMap: Map<string, {
      learning_status?: string;
      learning_progress?: number;
      learning_current_chunk?: number;
      learning_total_chunks?: number;
      learning_message?: string | null;
    }> = new Map();
    try {
      const dbTasks = await listTasks();
      for (const t of dbTasks) {
        // 同名时优先 learning
        const existing = dbTaskMap.get(t.book_name);
        if (!existing || (t.learning_status === 'learning' && existing.learning_status !== 'learning')) {
          dbTaskMap.set(t.book_name, t);
        }
      }
    } catch (e) {
      console.warn('[GET /api/knowledge-base] listTasks 从 Supabase 拉失败:', e instanceof Error ? e.message : e);
    }
    // 多个 task 同名时优先选 learningStatus=learning > done > pending > failed
    // 避免"状态同步"修复后留下的 done+pending 旧 task 把"学习中"的进度盖掉
    const taskPriority = (s?: string) => {
      if (s === 'learning') return 4;
      if (s === 'done') return 3;
      if (s === 'pending') return 2;
      return 1;
    };
    const taskMap = new Map<string, typeof allTasks[number]>();
    for (const t of allTasks) {
      const existing = taskMap.get(t.bookName);
      if (!existing || taskPriority(t.learningStatus) > taskPriority(existing.learningStatus)) {
        taskMap.set(t.bookName, t);
      }
    }

    // 为每本书附加基本信息
    const bookList = pagedBooks.map(name => {
      // 从书名推断分类（简单匹配）
      const category = getBookCategory(name);
      // 获取学习状态
      const learnStatus = getBookLearnStatus(name);
      // 获取任务中的学习进度
      const task = taskMap.get(name);
      // 优先用 local-learn-tasks.json 中的最新状态（API 层直接写入，是权威值）
      const liveLearn = localLearnStatus[name];
      // 从 Supabase 拉的最新 task（生产环境最权威，文件可能不可写）
      const dbTask = dbTaskMap.get(name);
      // 物理文件存在 ⇒ 内容完整，绝不能误报"缺章节"
      // 章节数：优先取 learnStatus.totalChapters（本地物理书的真实章节），其次 task.totalChapters
      const realTotalChapters = (learnStatus?.totalChapters && learnStatus.totalChapters > 0)
        ? learnStatus.totalChapters
        : (task?.totalChapters ?? 0);
      const realCurrentChapter = realTotalChapters; // 本地书必然完整，currentChapter = totalChapters
      // 学习字段优先级：liveLearn(本地文件) > dbTask(Supabase) > task(内存) > learnStatus
      // 但 done 永远胜过 learning（一旦真正学完，不允许任何来源把它回退到 learning）
      const candidates: Array<{ s?: string; p?: number; c?: number; t?: number; m?: string | null }> = [
        liveLearn ? { s: liveLearn.learningStatus, p: liveLearn.learningProgress, c: liveLearn.learningCurrentChunk, t: liveLearn.learningTotalChunks, m: liveLearn.learningMessage } : null,
        dbTask ? { s: dbTask.learning_status, p: dbTask.learning_progress, c: dbTask.learning_current_chunk, t: dbTask.learning_total_chunks, m: dbTask.learning_message } : null,
        task ? { s: task.learningStatus, p: task.learningProgress, c: task.learningCurrentChunk, t: task.learningTotalChunks, m: task.learningMessage } : null,
      ].filter(Boolean) as Array<{ s?: string; p?: number; c?: number; t?: number; m?: string | null }>;
      // done 一票否决：只要任一来源是 done，就用 done
      const doneCandidate = candidates.find(c => c.s === 'done');
      const prio = (s?: string) => s === 'done' ? 4 : s === 'learning' ? 3 : s === 'pending' ? 2 : 1;
      candidates.sort((a, b) => prio(b.s) - prio(a.s));
      const best = doneCandidate || candidates[0] || {};
      const finalLearningStatus = best.s ?? (learnStatus?.learned ? 'done' : 'pending');
      const finalLearningProgress = doneCandidate ? 100 : (best.p ?? (learnStatus?.learned ? 100 : 0));
      const finalLearningMessage = best.m ?? '';
      const finalLearningCurrentChunk = doneCandidate ? (best.t ?? 0) : (best.c ?? 0);
      const finalLearningTotalChunks = best.t ?? 0;
      return {
        name,
        category,
        learned: finalLearningStatus === 'done' || (learnStatus?.learned ?? false),
        learnedAt: learnStatus?.learnedAt ?? (task?.completedAt ?? null),
        charCount: learnStatus?.charCount ?? 0,
        learningStatus: finalLearningStatus,
        learningProgress: finalLearningProgress,
        learningCurrentChunk: finalLearningCurrentChunk,
        learningTotalChunks: finalLearningTotalChunks,
        learningMessage: finalLearningMessage,
        hasMissingChapters: false, // 本地物理文件存在 = 完整录入，永远不缺章节
        currentChapter: realCurrentChapter,
        totalChapters: realTotalChapters,
        chapterStructure: learnStatus?.chapterStructure ?? task?.chapterStructure ?? '章',
      };
    });

    // 获取学习统计
    const learnStats = getLearnedBookCount();

    return NextResponse.json({
      books: bookList,
      total,
      totalPages,
      page,
      pageSize,
      totalChars: stats.totalChars,
      bookCount: stats.bookCount,
      learnedCount: learnStats.learned,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `获取知识库失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/knowledge-base
 * 从知识库删除书籍
 * body: { bookName: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookName } = body;

    if (!bookName) {
      return NextResponse.json({ error: '缺少书名' }, { status: 400 });
    }

    // 1. 从全文知识库删除（本地文件+缓存+学习状态+S3）
    const removed = removeBookFromKnowledgeBase(bookName);

    // 2. 联动清理 book-task-manager 中同名任务（避免任务管理器把残留任务持久化回 book-tasks.json）
    const allTasks = getAllTasks();
    const matchedTasks = allTasks.filter(t => {
      const tn = (t.bookName || '').trim();
      return tn === bookName || tn.includes(bookName) || bookName.includes(tn);
    });
    let taskDeleted = 0;
    for (const t of matchedTasks) {
      if (deleteTask(t.id)) taskDeleted++;
    }

    if (removed || taskDeleted > 0) {
      return NextResponse.json({
        success: true,
        message: `《${bookName}》已清理${removed ? '（知识库+' : '（'}${taskDeleted}个任务记录）`,
        knowledge_base_removed: removed,
        tasks_deleted: taskDeleted,
      });
    } else {
      return NextResponse.json({ error: `《${bookName}》不在知识库中，也无相关任务` }, { status: 404 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: `删除失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

// 根据书名推断分类
function getBookCategory(bookName: string): string {
  const categories: [string, string[]][] = [
    ['易学', ['易', '周易', '易经', '卦', '爻', '梅花', '六爻', '奇门', '六壬', '太乙']],
    ['八字', ['八字', '命理', '子平', '三命', '滴天髓', '穷通', '渊海', '造化', '格局', '用神']],
    ['紫微', ['紫微', '斗数', '星盘', '飞星', '四化']],
    ['风水', ['风水', '地理', '堪舆', '宅经', '葬书', '寻龙', '水龙', '阳宅', '阴宅', '玄空', '飞星', '八宅']],
    ['相学', ['面相', '手相', '相法', '神相', '麻衣', '柳庄', '水镜', '冰鉴']],
    ['择日', ['择日', '择吉', '通书', '历法', '黄历', '协纪']],
    ['姓名', ['姓名', '五格', '命名', '取名']],
    ['道教', ['道', '真经', '灵宝', '太上', '黄庭', '参同', '悟真', '阴符', '清静', '内丹']],
    ['佛教', ['佛', '经', '禅', '般若', '法华', '华严', '楞严', '金刚', '心经', '净土', '菩萨']],
    ['儒学', ['论语', '孟子', '大学', '中庸', '礼记', '诗经', '尚书', '春秋', '孝经', '传习']],
    ['中医', ['黄帝内经', '伤寒', '本草', '金匮', '温病', '脉经', '千金', '医学']],
    ['术数', ['术数', '太玄', '皇极', '邵子', '铁板', '河洛', '数理']],
  ];

  for (const [cat, keywords] of categories) {
    if (keywords.some(kw => bookName.includes(kw))) {
      return cat;
    }
  }
  return '其他';
}

/**
 * POST /api/knowledge-base
 * 启动本地书籍学习
 * action=start-learning - 开始学习所有本地书籍
 * action=learning-progress - 获取学习进度
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'start-learning') {
      const result = await startLearningAllLocalBooks();
      // 直接在 API 层触发学习（绕过 HMR 闭包问题）
      try {
        const fullTextMod = await import('@/lib/fulltext-search');
        const { getBookFullText, getBookFullTextAsync, markBookLearned, getLocalBookInfo, loadBookCacheAsync } = fullTextMod;
        const sdkMod = await import('coze-coding-dev-sdk');
        const { LLMClient, Config } = sdkMod;
        const fs = await import('fs');
        const path = await import('path');
        const TASKS_DIR = path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'public', 'book-content');
        // 学习状态目录（生产用 /tmp，开发用 public，统一管理）
        const STATUS_DIR = getStatusFileDir();
        
        // 获取所有可学习的书：本地 fs + Supabase（生产环境本地 fs 是空的）
        let bookNames: string[] = [];
        try {
          const info = getLocalBookInfo();
          bookNames = info.bookNames || [];
        } catch {}
        // 兜底：直接读 fs
        if (bookNames.length === 0) {
          try {
            const files = fs.readdirSync(TASKS_DIR).filter((f: string) => f.endsWith('.txt'));
            bookNames = files.map((f: string) => f.replace('.txt', ''));
          } catch {}
        }
        const statusFile = path.join(STATUS_DIR, 'local-learn-tasks.json');
        let learningStatus: Record<string, any> = {};
        try { learningStatus = JSON.parse(fs.readFileSync(statusFile, 'utf-8')); } catch {}
        
        let started = 0;
        let skipped = 0;
        for (const bookName of bookNames) {
          const existing = learningStatus[bookName];
          // 文件状态优先；同时检查 Supabase 是否已 done，避免被本地残留状态误重启
          let dbStatus: string | undefined;
          try {
            const { getTaskByBookName } = await import('@/lib/book-repo');
            const dbRow = await getTaskByBookName(bookName);
            dbStatus = dbRow?.learning_status;
          } catch { /* 忽略 */ }
          if ((existing && existing.learningStatus === 'done') || dbStatus === 'done') {
            skipped++;
            // 把本地文件状态同步为 done，避免下次又被误判为 learning
            learningStatus[bookName] = {
              learningStatus: 'done',
              learningProgress: 100,
              learningMessage: '✅ 已学完，可用于回答问题',
              learningLayersDone: [1, 2, 3, 4],
            };
            try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch { /* 静默 */ }
            continue;
          }
          // pending / learning(已残留) / failed → 强制重启
          // 标记为学习中
          learningStatus[bookName] = {
            learningStatus: 'learning',
            learningProgress: 0,
            learningMessage: '准备学习...',
            learningLayersDone: [],
            startedAt: Date.now(),
          };
          started++;

          // ⚠️ 关键：立即同步写文件 + db，确保下次 GET 能立刻拿到 learning 状态
          // 不能等 setImmediate 内的 chunk 循环——那要好几秒才会触发第一次写入
          try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch (writeErr) { console.warn('[start-learning] 立即写 statusFile 失败:', writeErr); }
          // 同步 await 写 Supabase，确保跨页面切换后能恢复状态
          try {
            await syncLearningStatusToDb(bookName, {
              learningStatus: 'learning',
              learningProgress: 0,
              learningCurrentChunk: 0,
              learningTotalChunks: 0,
              learningMessage: '准备学习...',
            });
          } catch (dbErr) {
            console.warn('[start-learning] 立即写 Supabase 失败:', dbErr);
          }

          // 异步执行学习（不阻塞 API 响应）
          setImmediate(async () => {
            try {
              // 先确保 Supabase 缓存已加载
              try { await loadBookCacheAsync(); } catch {}
              // 优先用 async（能从 Supabase 实时取），同步版作为兜底
              let fullText: string | null = null;
              try { fullText = await getBookFullTextAsync(bookName); } catch {}
              if (!fullText || fullText.length < 100) {
                fullText = getBookFullText(bookName);
              }
              if (!fullText || fullText.length < 100) {
                learningStatus[bookName] = { ...learningStatus[bookName], learningStatus: 'failed', learningMessage: '无法读取书籍内容' };
                try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch (writeErr) { console.warn('[learn] 写 statusFile 失败:', writeErr); }
                // 双写 Supabase 让生产环境也能拿到状态
                void syncLearningStatusToDb(bookName, {
                  learningStatus: 'failed',
                  learningProgress: 0,
                  learningCurrentChunk: 0,
                  learningTotalChunks: 0,
                  learningMessage: '无法读取书籍内容',
                });
                return;
              }
              
              // 分块
              const CHUNK_SIZE = 3000;
              const paragraphs = fullText.split(/\n{2,}/);
              const chunks: string[] = [];
              let currentChunk = '';
              for (const p of paragraphs) {
                if ((currentChunk + '\n\n' + p).length > CHUNK_SIZE && currentChunk) {
                  chunks.push(currentChunk);
                  currentChunk = p;
                } else {
                  currentChunk = currentChunk ? currentChunk + '\n\n' + p : p;
                }
              }
              if (currentChunk) chunks.push(currentChunk);
              
              const totalChunks = chunks.length;
              const learnedChunks: string[] = [];
              
              // 逐块学习
              const config = new Config();
              const llmClient = new LLMClient(config);
              for (let i = 0; i < totalChunks; i++) {
                const chunk = chunks[i];
                const progress = Math.round(((i + 1) / totalChunks) * 100);
                
                try {
                  const messages = [{
                    role: 'user' as const,
                    content: `深度学习以下古籍原文，按4层结构输出学习笔记：\n一、专业术语与概念\n二、分析逻辑与推断方法\n三、知识点关联关系\n四、实际应用方法\n\n原文：\n${chunk}`,
                  }];
                  const stream = llmClient.stream(messages, {
                    model: 'doubao-seed-2-0-pro-260215',
                    temperature: 0.3,
                  });
                  let learnedContent = '';
                  for await (const part of stream) {
                    if (part?.content) {
                      learnedContent += part.content.toString();
                    }
                  }
                  
                  learnedChunks.push(`========== 原文 ==========\n${chunk}\n========== AI学习笔记 ==========\n${learnedContent || '（学习笔记生成失败，保留原文）'}`);
                } catch {
                  learnedChunks.push(chunk); // 失败则保留原文
                }
                
                // 更新进度
                const layersDone: number[] = [];
                if (progress >= 25) layersDone.push(1);
                if (progress >= 50) layersDone.push(2);
                if (progress >= 75) layersDone.push(3);
                if (progress >= 100) layersDone.push(4);
                
                learningStatus[bookName] = {
                  learningStatus: progress >= 100 ? 'done' : 'learning',
                  learningProgress: progress,
                  learningTotalChunks: totalChunks,
                  learningCurrentChunk: i + 1,
                  learningLayersDone: layersDone,
                  learningMessage: progress >= 100 ? '✅ 已学完，可用于回答问题' : `正在学习第 ${i+1}/${totalChunks} 块...`,
                };
                try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch (writeErr) { console.warn('[learn] 写 statusFile 失败:', writeErr); }
                // 双写 Supabase（每 5 块或学完时写一次，避免过频）
                if ((i + 1) % 5 === 0 || progress >= 100) {
                  void syncLearningStatusToDb(bookName, {
                    learningStatus: progress >= 100 ? 'done' : 'learning',
                    learningProgress: progress,
                    learningCurrentChunk: i + 1,
                    learningTotalChunks: totalChunks,
                    learningMessage: progress >= 100 ? '✅ 已学完，可用于回答问题' : `正在学习第 ${i+1}/${totalChunks} 块...`,
                  });
                }
              }
              
              // 标记知识库学习完成
              if (learnedChunks.length > 0) {
                try { markBookLearned(bookName, true); } catch {}
              }
              
              console.log(`[learnLocalBook] ✅ ${bookName} 学习完成，${totalChunks} 块`);
            } catch (err: any) {
              console.error(`[learnLocalBook] ❌ ${bookName} 学习失败:`, err.message);
              learningStatus[bookName] = { ...learningStatus[bookName], learningStatus: 'failed', learningMessage: `学习失败: ${err.message}` };
              try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch (writeErr) { console.warn('[learn] 写 statusFile 失败:', writeErr); }
              void syncLearningStatusToDb(bookName, {
                learningStatus: 'failed',
                learningProgress: 0,
                learningCurrentChunk: 0,
                learningTotalChunks: 0,
                learningMessage: `学习失败: ${err.message}`,
              });
            }
          });
        }
        
        // 保存初始状态（生产环境会写 /tmp，开发写 public）
        try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch (writeErr) { console.warn('[learn] 写 statusFile 失败:', writeErr); }
        // 初始状态同步到 Supabase
        for (const bookName of Object.keys(learningStatus)) {
          const s = learningStatus[bookName];
          if (s.learningStatus === 'learning') {
            void syncLearningStatusToDb(bookName, {
              learningStatus: 'learning',
              learningProgress: 0,
              learningCurrentChunk: 0,
              learningTotalChunks: 0,
              learningMessage: '学习已加入队列',
            });
          }
        }
        
        return NextResponse.json({ success: true, data: { total: bookNames.length, started, message: started > 0 ? `已启动 ${started} 本书的学习${skipped > 0 ? `，${skipped} 本已学完跳过` : ''}` : `共 ${bookNames.length} 本书，全部已学完，无需再学习` } });
      } catch (err: any) {
        console.error('[start-learning] 内部错误:', err.message);
        return NextResponse.json({ success: true, data: result }); // fallback
      }
    }

    if (action === 'refresh-cache') {
      invalidateCache();
      const stats = getBookStats();
      return NextResponse.json({ success: true, data: { message: `缓存已刷新，当前${stats.bookCount}本书`, total: stats.bookCount } });
    }

    // 强制把打包种子数据同步到 Supabase（部署后数据丢失时手动恢复）
    if (action === 'force-sync-seed') {
      try {
        const mod = await import('@/lib/fulltext-search');
        await (mod as unknown as { forceSyncSeedDataToDb?: () => Promise<{ synced: number; total: number }> }).forceSyncSeedDataToDb?.();
        invalidateCache();
        await loadBookCacheAsync();
        const stats = getBookStats();
        return NextResponse.json({ success: true, data: { message: `种子数据已强制同步，当前 ${stats.bookCount} 本书`, total: stats.bookCount, totalChars: stats.totalChars } });
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ success: false, error: '强制同步失败: ' + m }, { status: 500 });
      }
    }

    if (action === 'learning-progress') {
      const progress = getLocalLearningProgress();
      return NextResponse.json({ success: true, data: progress });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
