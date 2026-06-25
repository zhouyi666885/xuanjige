import { NextRequest, NextResponse } from 'next/server';
import {
  initTaskManager,
  createTask,
  getAllTasks,
  getTask,
  deleteTask,
  getTaskStats,
} from '@/lib/book-task-manager';
import { getLearningProgress } from '@/lib/fulltext-search';

// 确保任务管理器初始化
initTaskManager();

/**
 * GET /api/add-book
 * 获取所有任务列表 + 统计信息
 */
export async function GET() {
  try {
    const taskList = getAllTasks();
    const stats = getTaskStats();

    // 过滤掉 exists 状态的旧任务（已有书不再创建任务）
    const nonExistsTasks = taskList.filter(t => t.status !== 'exists');

    // 版权问题/录入失败的任务：本次显示，但立即从持久化中清除（下次进入就消失）
    const copyrightAndFailedTasks = nonExistsTasks.filter(t => 
      t.status === 'copyright' || t.status === 'failed'
    );
    if (copyrightAndFailedTasks.length > 0) {
      for (const t of copyrightAndFailedTasks) {
        try { deleteTask(t.id); } catch {}
      }
    }

    // 历史记录显示规则：
    // - 已100%完整录入成功、且不缺任何章节的书籍 → 隐藏
    // - 没录完的书籍 → 显示
    // - 进度100%但实际缺章节的书籍 → 显示并标注"缺章节"
    // - 版权问题/录入失败 → 本次显示（已从持久化清除，下次消失）
    const visibleTasks = nonExistsTasks.filter(t => {
      // 版权问题和录入失败：本次显示
      if (t.status === 'copyright' || t.status === 'failed') return true;
      if (t.status !== 'done') return true; // 没录完的继续显示
      // done 状态：检查是否缺章节
      const total = t.totalChapters || 0;
      const current = t.currentChapter || 0;
      // totalChapters=0 说明没检测到章节结构，视为完整
      if (total === 0) return false;
      // currentChapter < totalChapters 说明缺章节
      return current < total;
    });

    // 获取所有书籍的学习进度
    const learningProgressList = getLearningProgress();
    const learningMap = new Map(learningProgressList.map(p => [p.name, p]));

    return NextResponse.json({
      bookCount: nonExistsTasks.filter(t => t.status === 'done').length,
      stats,
      tasks: visibleTasks.map(t => {
        const total = t.totalChapters || 0;
        const current = t.currentChapter || 0;
        const hasMissingChapters = t.status === 'done' && total > 0 && current < total;
        // 从知识库学习进度中获取
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
          hasMissingChapters, // 缺章节标记
          // 知识库学习进度（按原书章节结构）
          knowledgeLearning: learnProgress ? {
            learnedChapters: learnProgress.learnedChapters,
            totalChapters: learnProgress.totalChapters,
            chapterStructure: learnProgress.chapterStructure,
            learned: learnProgress.learned,
            charCount: learnProgress.charCount,
          } : null,
        };
      }),
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
