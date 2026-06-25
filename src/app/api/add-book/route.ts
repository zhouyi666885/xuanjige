import { NextRequest, NextResponse } from 'next/server';
import {
  initTaskManager,
  createTask,
  getAllTasks,
  getTask,
  deleteTask,
  getTaskStats,
} from '@/lib/book-task-manager';

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
    const visibleTasks = taskList.filter(t => t.status !== 'exists');

    return NextResponse.json({
      bookCount: visibleTasks.filter(t => t.status === 'done').length,
      stats,
      tasks: visibleTasks.map(t => ({
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
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        completedAt: t.completedAt,
        error: t.error,
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
