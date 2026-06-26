/**
 * POST /api/knowledge-base/start-learning
 * 批量启动知识库中所有"待学习"书籍的学习流程
 */
import { NextResponse } from 'next/server';
import { startLearningPendingBooks } from '@/lib/book-task-manager';

export async function POST() {
  try {
    const result = await startLearningPendingBooks();
    return NextResponse.json({
      success: true,
      started: result.started,
      alreadyLearning: result.alreadyLearning,
      bookNames: result.bookNames,
      message:
        result.started > 0
          ? `已开始学习 ${result.started} 本书：${result.bookNames.join('、')}`
          : '没有待学习的书籍',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
