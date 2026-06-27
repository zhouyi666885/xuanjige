import { NextRequest, NextResponse } from 'next/server';
import { getBookStats, removeBookFromKnowledgeBase, getBookLearnStatus, getLearnedBookCount, invalidateCache, loadBookCacheAsync } from '@/lib/fulltext-search';
import { getAllTasks, startLearningAllLocalBooks, startLearningSingleBook, getLocalLearningProgress, deleteTask } from '@/lib/book-task-manager';
import { upsertTask, getTaskByBookName, listTasks, type BookTaskRow } from '@/lib/book-repo';
import { getSupabaseClient } from '@/storage/database/supabase-client';
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
      missing_chapter_names?: string[] | null;
      has_missing_chapters?: boolean | null;
      learning_current_chapter?: number | null;
      learning_current_chapter_name?: string | null;
    }> = new Map();
    try {
      const dbTasks = await listTasks();
      // listTasks 已按 created_at DESC 排序，第一个就是最新
      // 🔴 学习状态优先：learning > 其他；其次按 created_at（已天然 DESC）
      for (const t of dbTasks) {
        const existing = dbTaskMap.get(t.book_name);
        if (!existing || (t.learning_status === 'learning' && existing.learning_status !== 'learning')) {
          dbTaskMap.set(t.book_name, t);
        }
      }
    } catch (e) {
      console.warn('[GET /api/knowledge-base] listTasks 从 Supabase 拉失败:', e instanceof Error ? e.message : e);
    }
    // 🔴 latestDbTaskMap：按 created_at DESC 取最新（listTasks 已 DESC 排序，首个即最新）
    // 专用于"缺章/录入状态"显示，解决 sticky bug
    const latestDbTaskMap = new Map<string, {
      learning_status?: string;
      learning_progress?: number;
      learning_current_chunk?: number;
      learning_total_chunks?: number;
      learning_message?: string | null;
      missing_chapter_names?: string[] | null;
      has_missing_chapters?: boolean | null;
      learning_current_chapter?: number | null;
      learning_current_chapter_name?: string | null;
      created_at?: string;
    }>();
    try {
      const dbTasksLatest = await listTasks();
      for (const t of dbTasksLatest) {
        if (!latestDbTaskMap.has(t.book_name)) {
          latestDbTaskMap.set(t.book_name, t);
        }
      }
    } catch {
      // 静默：上一处已警告
    }
    // 多个 task 同名时优先选 learningStatus=learning > done > pending > failed
    // 用于"学习状态"查询（避免新录入 pending task 把"学习中"挡掉）
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
    // 🔴 latestTaskMap：按 createdAt 取最新 task，专用于"缺章/录入状态"
    // 解决 bug：用户补回缺章后，旧 task 的 missingChapterNames 永远 sticky
    const latestTaskMap = new Map<string, typeof allTasks[number]>();
    for (const t of allTasks) {
      const existing = latestTaskMap.get(t.bookName);
      const tCreated = t.createdAt ?? 0;
      const eCreated = existing?.createdAt ?? 0;
      if (!existing || tCreated > eCreated) {
        latestTaskMap.set(t.bookName, t);
      }
    }

    // 为每本书附加基本信息
    const bookList = await Promise.all(pagedBooks.map(async name => {
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
      // 章节数：优先 learnStatus → task → 从书内容正则推断（保证所有书都显示）
      let detectedStructure = learnStatus?.chapterStructure ?? task?.chapterStructure ?? '';
      let detectedTotal = (learnStatus?.totalChapters && learnStatus.totalChapters > 0)
        ? learnStatus.totalChapters
        : (task?.totalChapters ?? 0);
      if (!detectedTotal || !detectedStructure) {
        // 兜底：扫一遍书的内容，统计章/卷/篇/卦/回 的数量
        try {
          const content = (await import('@/lib/fulltext-search')).getBookFullText(name) || '';
          if (content) {
            const patterns: Array<{ unit: string; regex: RegExp }> = [
              { unit: '章', regex: /第[一二三四五六七八九十百千零0-9]+章/g },
              { unit: '卷', regex: /第[一二三四五六七八九十百千零0-9]+卷/g },
              { unit: '篇', regex: /第[一二三四五六七八九十百千零0-9]+篇/g },
              { unit: '回', regex: /第[一二三四五六七八九十百千零0-9]+回/g },
              { unit: '卦', regex: /第[一二三四五六七八九十百千零0-9]+卦/g },
            ];
            let best = { unit: '', count: 0 };
            for (const p of patterns) {
              const matches = content.match(p.regex);
              const count = matches ? new Set(matches).size : 0;
              if (count > best.count) best = { unit: p.unit, count };
            }
            if (best.count >= 2) {
              detectedTotal = best.count;
              detectedStructure = best.unit;
            } else {
              // 仍找不到：按章节符号「○」「●」「◇」分段，或按 5000 字一段估算
              const approxChapters = Math.max(1, Math.ceil(content.length / 5000));
              detectedTotal = approxChapters;
              detectedStructure = '段';
            }
          }
        } catch {
          // 忽略，保持原值
        }
      }
      const realTotalChapters = detectedTotal || 1;
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
      let finalLearningStatus = best.s ?? (learnStatus?.learned ? 'done' : 'pending');
      let finalLearningProgress = doneCandidate ? 100 : (best.p ?? (learnStatus?.learned ? 100 : 0));
      let finalLearningMessage = best.m ?? '';
      let finalLearningCurrentChunk = doneCandidate ? (best.t ?? 0) : (best.c ?? 0);
      const finalLearningTotalChunks = best.t ?? 0;
      // 🔴 进度→状态自动翻转兜底（永久规则）：
      // 任何任务，只要进度到 100%，状态必须立刻翻为"已完成"，不允许卡在"进行中"。
      // 这一层是 API 层兜底，即便 task 层兜底失效（HMR/persist 时序异常），也能保证 UI 与 AI 拿到的状态正确。
      if (finalLearningProgress >= 100 && finalLearningStatus !== 'done' && finalLearningStatus !== 'failed') {
        finalLearningStatus = 'done';
        finalLearningProgress = 100;
        if (!finalLearningMessage || /学习中|进行中/.test(finalLearningMessage)) {
          finalLearningMessage = `✅ 已学完《${name}》全部内容`;
        }
        if (finalLearningTotalChunks > 0 && finalLearningCurrentChunk < finalLearningTotalChunks) {
          finalLearningCurrentChunk = finalLearningTotalChunks;
        }
      }
      // 同理：录入进度 100% → 状态翻 done（如本卡有录入字段）
      // （此处不直接改 task.status，因为 task.status 在前置 dbTaskMap 已处理）
      // 从 task/dbTask 中提取缺失章节信息 + 学习当前章节
      // 🔴 缺章/录入字段必须从【最新 task】取，不能用 sticky OR fallback
      // bug 复现：旧 task 标过 hasMissing=true 后，新 task 即使补全了，UI 仍显示缺失
      const latestTask = latestTaskMap.get(name);
      const latestDbTask = latestDbTaskMap.get(name);
      const missingFromLatest = (latestTask?.missingChapterNames && latestTask.missingChapterNames.length > 0)
        ? latestTask.missingChapterNames
        : (Array.isArray(latestDbTask?.missing_chapter_names) ? latestDbTask!.missing_chapter_names! : []);
      const missingNames = missingFromLatest;
      const hasMissing = missingNames.length > 0;
      const learningCurChapter = (dbTask?.learning_current_chapter ?? task?.learningCurrentChapter ?? 0) || 0;
      const learningCurChapterName = dbTask?.learning_current_chapter_name ?? task?.learningCurrentChapterName ?? '';
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
        learningCurrentChapter: learningCurChapter,
        learningCurrentChapterName: learningCurChapterName,
        hasMissingChapters: hasMissing,
        missingChapterNames: missingNames,
        currentChapter: realCurrentChapter,
        totalChapters: realTotalChapters,
        chapterStructure: detectedStructure || learnStatus?.chapterStructure || task?.chapterStructure || '章',
      };
    }));
    const resolvedBookList = bookList;

    // learnedCount 直接从已解析的书目列表统计（与 UI 显示的 learned 字段完全一致）
    const learnedCount = resolvedBookList.filter(b => b.learned).length;

    return NextResponse.json({
      books: resolvedBookList,
      total,
      totalPages,
      page,
      pageSize,
      totalChars: stats.totalChars,
      bookCount: stats.bookCount,
      learnedCount,
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

    // 3. 从 Supabase book_tasks 表删除（防止进程重启后 loadTasksFromDb 恢复）
    let dbDeleted = 0;
    try {
      const dbTasks = await listTasks();
      const dbMatched = dbTasks.filter((t: BookTaskRow) => {
        const tn = (t.book_name || '').trim();
        return tn === bookName || tn.includes(bookName) || bookName.includes(tn);
      });
      for (const dt of dbMatched) {
        try {
          const db = getSupabaseClient();
          await db.from('book_tasks').delete().match({ book_name: dt.book_name });
          dbDeleted++;
        } catch (_e) { /* ignore */ }
      }
      // 立墓碑防止种子自愈恢复
      try {
        const db = getSupabaseClient();
        await db.from('book_task_tombstones').upsert({
          kind: 'book_name', value: bookName, created_at: new Date().toISOString()
        }, { onConflict: 'kind,value' });
      } catch (_e) { /* ignore */ }
    } catch (_e) { /* ignore */ }

    // 4. 从 Supabase books 表删除内容（防止已取消的书内容残留）
    let contentDeleted = 0;
    try {
      const db = getSupabaseClient();
      const { error: delErr } = await db.from('books').delete().match({ name: bookName });
      if (!delErr) contentDeleted = 1;
    } catch (_e) { /* ignore */ }

    if (removed || taskDeleted > 0 || dbDeleted > 0 || contentDeleted > 0) {
      return NextResponse.json({
        success: true,
        message: `《${bookName}》已清理${removed ? '（知识库+' : '（'}${taskDeleted}个内存任务+${dbDeleted}个db任务+${contentDeleted}条内容）`,
        knowledge_base_removed: removed,
        tasks_deleted: taskDeleted,
        db_tasks_deleted: dbDeleted,
        content_deleted: contentDeleted,
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
      // 1) 让 task manager 创建任务 + 写 Supabase + 入队 + 自动 learnLocalBook
      //    learnLocalBook 内部会 updateTask 持续持久化进度，进程重启后会从 Supabase 自动恢复
      const result = await startLearningAllLocalBooks();

      // 2) 立即把所有 learning 状态的 task 写到本地 statusFile，确保下次 GET 接口能立刻拿到 learning
      try {
        const fs = await import('fs');
        const path = await import('path');
        const STATUS_DIR = getStatusFileDir();
        const statusFile = path.join(STATUS_DIR, 'local-learn-tasks.json');
        let learningStatus: Record<string, any> = {};
        try { learningStatus = JSON.parse(fs.readFileSync(statusFile, 'utf-8')); } catch {}

        const { listTasks } = await import('@/lib/book-repo');
        const tasksFromDb = await listTasks();
        for (const t of tasksFromDb) {
          if (t.learning_status === 'learning' || t.learning_status === 'done') {
            learningStatus[t.book_name] = {
              learningStatus: t.learning_status,
              learningProgress: t.learning_progress ?? 0,
              learningCurrentChunk: t.learning_current_chunk ?? 0,
              learningTotalChunks: t.learning_total_chunks ?? 0,
              learningMessage: t.learning_message || (t.learning_status === 'done' ? '✅ 已学完，可用于回答问题' : '准备学习...'),
              learningLayersDone: t.learning_status === 'done' ? [1, 2, 3, 4] : [],
              startedAt: t.learning_started_at ? new Date(t.learning_started_at).getTime() : Date.now(),
            };
          }
        }
        try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch (writeErr) { console.warn('[start-learning] 写 statusFile 失败:', writeErr); }
      } catch (e) {
        console.warn('[start-learning] 同步 statusFile 失败:', e);
      }

      return NextResponse.json({ success: true, data: result });
    }

    // 启动单本书学习
    if (action === 'start-learning-one') {
      const bookName: string = body.bookName;
      if (!bookName) {
        return NextResponse.json({ success: false, error: 'bookName 必填' }, { status: 400 });
      }
      const result = await startLearningSingleBook(bookName);
      // 同步写 statusFile，让下次 GET 立即看到 learning 状态
      try {
        const fs = await import('fs');
        const path = await import('path');
        const STATUS_DIR = getStatusFileDir();
        const statusFile = path.join(STATUS_DIR, 'local-learn-tasks.json');
        let learningStatus: Record<string, any> = {};
        try { learningStatus = JSON.parse(fs.readFileSync(statusFile, 'utf-8')); } catch {}
        learningStatus[bookName] = {
          learningStatus: 'learning',
          learningProgress: 0,
          learningCurrentChunk: 0,
          learningTotalChunks: 0,
          learningMessage: '学习已加入队列（单本启动）',
          learningLayersDone: [],
          startedAt: Date.now(),
        };
        try { fs.writeFileSync(statusFile, JSON.stringify(learningStatus, null, 2)); } catch {}
      } catch {}
      return NextResponse.json({ success: result.success, data: result });
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
