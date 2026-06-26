import { NextRequest, NextResponse } from 'next/server';
import {
  initTaskManager,
  createTask,
  getAllTasks,
  deleteTask,
  getTaskStats,
  forceSaveTasks,
  pauseTask,
  resumeTask,
  cancelTask,
} from '@/lib/book-task-manager';
import { getLearningProgress, getLocalBookInfo, loadBookCacheAsync } from '@/lib/fulltext-search';

// 确保任务管理器初始化
initTaskManager();

/**
 * GET /api/add-book
 * 获取所有任务列表 + 统计信息
 */
export async function GET() {
  try {
    // 首先从云端拉取最新书目（开发/生产共享 Supabase 数据）
    await loadBookCacheAsync();

    const taskList = getAllTasks();
    const stats = getTaskStats();

    // 过滤掉 exists 状态的旧任务（已有书不再创建任务）
    const nonExistsTasks = taskList.filter(t => t.status !== 'exists');

    // 🔴 录入记录显示规则：
    // 1. 录入成功(done) → 不在录入记录里显示（已完成的不占位置）
    // 2. 录入失败(copyright/failed) → 不在任务列表显示，而是作为一次性通知返回
    // 3. 退出APP再回来 → 失败记录也不显示，清空不保留
    // 4. 录入中途(还没完成但也没失败) → 继续显示，带进度条

    // 活跃任务：正在录入中的（带进度条），包括暂停状态
    const activeTasks = nonExistsTasks.filter(t =>
      t.status !== 'done' && t.status !== 'copyright' && t.status !== 'failed' && t.status !== 'exists' && t.status !== 'cleared'
    );

    // 缺章节任务：录入完成但缺少章节的书，需要显示"缺章节"标注
    // 注意：本地物理 .txt 文件已存在的书，永远不算"缺章节"
    const localBookSet = new Set(getLocalBookInfo().bookNames);
    const missingChapterTasks = nonExistsTasks.filter(t =>
      t.status === 'done'
      && t.totalChapters > 0
      && t.currentChapter < t.totalChapters
      && !localBookSet.has(t.bookName) // 本地文件已存在 = 完整录入，不算缺章节
    );

    // 版权/失败通知：一次性提示，前端sessionStorage控制退出后消失
    const copyrightNotices = nonExistsTasks.filter(t =>
      t.status === 'copyright' || t.status === 'failed'
    );

    // 获取所有书籍的学习进度
    const learningProgressList = getLearningProgress();
    const learningMap = new Map(learningProgressList.map(p => [p.name, p]));

    return NextResponse.json({
      bookCount: nonExistsTasks.filter(t => t.status === 'done').length,
      stats,
      // 只显示正在录入中的任务（带进度条）
      tasks: activeTasks.map(t => {
        const total = t.totalChapters || 0;
        const current = t.currentChapter || 0;
        const hasMissingChapters = t.status === 'done' && total > 0 && current < total;
        const learnProgress = learningMap.get(t.bookName);
        return {
          id: t.id,
          bookName: t.bookName,
          status: t.status,
          progress: t.progress,
          message: t.message,
          currentChapter: t.currentChapter,
          totalChapters: t.totalChapters,
          currentChapterName: t.currentChapterName,
          remainingChapters: t.remainingChapters,
          source: t.source,
          size: t.size,
          chars: t.chars,
          chapterStructure: t.chapterStructure,
          learningStatus: t.learningStatus,
          learningProgress: t.learningProgress,
          learningCurrentChunk: t.learningCurrentChunk,
          learningTotalChunks: t.learningTotalChunks,
          learningMessage: t.learningMessage,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          completedAt: t.completedAt,
          error: t.error,
          hasMissingChapters,
          knowledgeLearning: learnProgress ? {
            learnedChapters: learnProgress.learnedChapters,
            totalChapters: learnProgress.totalChapters,
            chapterStructure: learnProgress.chapterStructure,
            learned: learnProgress.learned,
            charCount: learnProgress.charCount,
          } : null,
        };
      }),
      // 一次性版权/失败通知（前端控制：退出APP后消失）
      copyrightNotices: copyrightNotices.map(t => ({
        bookName: t.bookName,
        status: t.status,
        message: t.message,
        createdAt: t.createdAt,
      })),
      // 缺章节书籍：录入完成但章节不全，需要标注"缺章节"
      missingChapterBooks: missingChapterTasks.map(t => ({
        bookName: t.bookName,
        currentChapter: t.currentChapter,
        totalChapters: t.totalChapters,
        chapterStructure: t.chapterStructure || '章',
      })),
      // 已完成录入但仍在学习的书籍（被隐藏的任务，学习进度仍需显示）
      learningBooks: learningProgressList
        .filter(p => !p.learned && p.totalChapters > 0)
        .map(p => ({
          name: p.name,
          learnedChapters: p.learnedChapters,
          totalChapters: p.totalChapters,
          chapterStructure: p.chapterStructure,
          learned: p.learned,
          charCount: p.charCount,
        })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取任务列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/add-book
 * 创建新的书籍录入任务
 * 支持单本（bookName）和批量（bookNames 数组）
 * 任务在后台自动运行，不依赖HTTP连接
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookName, bookNames } = body;

    // 收集所有书名
    const rawNames: string[] = [];
    if (bookNames && Array.isArray(bookNames)) {
      rawNames.push(...bookNames);
    } else if (bookName?.trim()) {
      // 支持逗号/换行/顿号分隔的多个书名
      rawNames.push(bookName.trim());
    }

    // 解析书名：按逗号、换行、顿号等分隔
    const names: string[] = [];
    for (const raw of rawNames) {
      const parts = raw
        .split(/[,，、\n\r;；]+/)
        .map((n: string) => n.trim())
        .filter(Boolean);
      names.push(...parts);
    }

    if (names.length === 0) {
      return NextResponse.json(
        { error: '请输入书名' },
        { status: 400 }
      );
    }

    // 批量创建任务
    const results = names.map(name => {
      const { task, isNew } = createTask(name);
      return {
        id: task.id,
        bookName: task.bookName,
        status: task.status,
        message: task.message,
        progress: task.progress,
        isNew,
        alreadyExists: task.status === 'exists',
      };
    });

    if (results.length === 1) {
      return NextResponse.json(results[0]);
    }

    return NextResponse.json({
      total: results.length,
      added: results.filter(r => !r.alreadyExists).length,
      alreadyExists: results.filter(r => r.alreadyExists).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '创建任务失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/add-book
 * 删除任务（摘录中可取消，完成后从知识库移除）
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, bookName } = body;

    if (taskId) {
      const success = deleteTask(taskId);
      return NextResponse.json({
        success,
        message: success ? '已删除' : '任务不存在',
      });
    }

    if (bookName) {
      // 按书名查找并删除
      const taskList = getAllTasks();
      const target = taskList.find(t => t.bookName === bookName);
      if (target) {
        const success = deleteTask(target.id);
        return NextResponse.json({
          success,
          message: success ? '已删除' : '删除失败',
        });
      }
      return NextResponse.json({
        success: false,
        message: '未找到该书',
      });
    }

    return NextResponse.json(
      { error: '请提供 taskId 或 bookName' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}

// PATCH: 暂停/继续/取消任务，或清除版权/失败条目
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { taskId?: string; action?: 'pause' | 'resume' | 'cancel' | 'clear-copyright' };
    const { taskId, action } = body;

    // 清除版权/失败条目（用户重新进入APP时调用）
    if (action === 'clear-copyright') {
      const tasks = getAllTasks();
      const removedCount = tasks.filter(
        (t) => t.status === 'copyright' || t.status === 'failed'
      ).length;

      for (const task of tasks) {
        if (task.status === 'copyright' || task.status === 'failed') {
          task.status = 'cleared';
        }
      }
      await import('@/lib/book-task-manager').then((m) => m.forceSaveTasks());

      return NextResponse.json({
        success: true,
        removedCount,
      });
    }

    // 暂停/继续/取消指定任务
    if (!taskId || !action) {
      return NextResponse.json({ error: '缺少taskId或action参数' }, { status: 400 });
    }

    if (action === 'pause') {
      const success = await pauseTask(taskId);
      return NextResponse.json({ success, message: success ? '已暂停' : '暂停失败（任务状态不允许）' });
    } else if (action === 'resume') {
      const success = await resumeTask(taskId);
      return NextResponse.json({ success, message: success ? '已继续' : '继续失败（任务状态不允许）' });
    } else if (action === 'cancel') {
      const success = await cancelTask(taskId);
      return NextResponse.json({ success, message: success ? '已取消' : '取消失败' });
    } else {
      return NextResponse.json({ error: '无效的action参数' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    );
  }
}
