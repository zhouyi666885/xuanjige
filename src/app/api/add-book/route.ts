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

    return NextResponse.json({
      bookCount: taskList.filter(t => t.status === 'done').length,
      stats,
      tasks: taskList.map(t => ({
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
 * 任务在后台自动运行，不依赖HTTP连接
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bookName = body.bookName?.trim();

    if (!bookName) {
      return NextResponse.json(
        { error: '请输入书名' },
        { status: 400 }
      );
    }

    const { task, isNew } = createTask(bookName);

    return NextResponse.json({
      id: task.id,
      bookName: task.bookName,
      status: task.status,
      message: task.message,
      progress: task.progress,
      isNew,
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
