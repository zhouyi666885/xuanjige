'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface TaskInfo {
  id: string;
  bookName: string;
  status: string;
  progress: number;
  message: string;
  currentChapter: number;
  totalChapters: number;
  currentChapterName: string;
  remainingChapters: number;
  source: string;
  size: string;
  chars: number;
  chapterStructure: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  error: string;
}

export default function AddBookPage() {
  const router = useRouter();
  const [bookName, setBookName] = useState('');
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, done: 0, failed: 0 });
  const [bookCount, setBookCount] = useState(0);

  // 轮询获取任务列表
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/add-book');
      const data = await res.json();
      setTasks(data.tasks || []);
      setStats(data.stats || { total: 0, active: 0, done: 0, failed: 0 });
      setBookCount(data.bookCount || 0);
    } catch {
      // 静默失败
    }
  }, []);

  // 自动轮询：有活跃任务时每2秒刷新，否则每10秒
  useEffect(() => {
    fetchTasks();
    const hasActive = tasks.some(t =>
      ['pending', 'searching', 'downloading', 'translating', 'saving'].includes(t.status)
    );
    const interval = setInterval(fetchTasks, hasActive ? 2000 : 10000);
    return () => clearInterval(interval);
  }, [fetchTasks, tasks]);

  // 添加书籍
  const handleAdd = async () => {
    if (!bookName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/add-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookName: bookName.trim() }),
      });
      const data = await res.json();
      if (data.status === 'exists') {
        // 已有这本书
      }
      setBookName('');
      // 立即刷新任务列表
      await fetchTasks();
    } catch {
      // 错误处理
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除任务
  const handleDelete = async (taskId: string) => {
    try {
      await fetch('/api/add-book', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      await fetchTasks();
    } catch {
      // 错误处理
    }
  };

  // 状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'searching': return '🔍';
      case 'downloading': return '📥';
      case 'translating': return '🌐';
      case 'saving': return '📝';
      case 'done': return '✅';
      case 'exists': return '📚';
      case 'failed': return '❌';
      case 'copyright': return '🔒';
      default: return '📄';
    }
  };

  // 状态标签样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-900/60 text-green-300 border border-green-700';
      case 'exists': return 'bg-amber-900/60 text-amber-300 border border-amber-700';
      case 'failed': return 'bg-red-900/60 text-red-300 border border-red-700';
      case 'copyright': return 'bg-orange-900/60 text-orange-300 border border-orange-700';
      default: return 'bg-blue-900/60 text-blue-300 border border-blue-700';
    }
  };

  // 进度条颜色
  const getProgressColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'exists': return 'bg-amber-500';
      case 'failed': return 'bg-red-500';
      case 'copyright': return 'bg-orange-500';
      default: return 'bg-gradient-to-r from-[#d4a853] to-[#f0c674]';
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // 预计剩余时间
  const getEstimatedTime = (task: TaskInfo) => {
    if (task.status !== 'saving' && task.status !== 'translating') return '';
    if (task.progress <= 0) return '';
    const elapsed = Date.now() - (task.updatedAt - (task.progress / 100) * (task.updatedAt - task.createdAt));
    const totalEstimate = (elapsed / task.progress) * 100;
    const remaining = totalEstimate - elapsed;
    if (remaining < 1000) return '即将完成';
    if (remaining < 60000) return `约 ${Math.ceil(remaining / 1000)} 秒`;
    return `约 ${Math.ceil(remaining / 60000)} 分钟`;
  };

  const isActive = (status: string) =>
    ['pending', 'searching', 'downloading', 'translating', 'saving'].includes(status);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e0d0]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-[#2a2a3e]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-[#8a8070] hover:text-[#d4a853] transition-colors text-sm"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-[#d4a853] flex-1 text-center">
            添加书籍
          </h1>
          <span className="text-xs text-[#8a8070]">
            知识库 {bookCount} 本
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 输入区 */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e]">
          <p className="text-sm text-[#8a8070] mb-3">
            输入书名，系统自动搜索并摘录到知识库。退出APP不影响，后台持续录入。
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="输入书名，如：滴天髓"
              className="flex-1 bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-4 py-3 text-[#e8e0d0] placeholder-[#5a5a6e] focus:border-[#d4a853] focus:outline-none transition-colors"
              disabled={isSubmitting}
            />
            <button
              onClick={handleAdd}
              disabled={isSubmitting || !bookName.trim()}
              className="bg-[#d4a853] hover:bg-[#e0b860] disabled:bg-[#3a3a4e] disabled:text-[#6a6a7e] text-[#0a0a0f] font-bold px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
            >
              {isSubmitting ? '添加中...' : '添加'}
            </button>
          </div>
        </div>

        {/* 活跃任务统计 */}
        {stats.active > 0 && (
          <div className="bg-[#16213e] rounded-xl p-4 border border-blue-800/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center text-sm animate-pulse">
              📥
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-300">
                后台录入中 · {stats.active} 本书正在处理
              </p>
              <p className="text-xs text-blue-400/60">
                退出APP不影响，下次打开可查看进度
              </p>
            </div>
          </div>
        )}

        {/* 任务列表 */}
        {tasks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#8a8070] uppercase tracking-wider">
              录入记录
            </h2>
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-[#1a1a2e] rounded-xl p-4 border transition-colors ${
                  isActive(task.status)
                    ? 'border-[#d4a853]/50'
                    : 'border-[#2a2a3e]'
                }`}
              >
                {/* 书名和状态 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getStatusIcon(task.status)}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[#e8e0d0] truncate">
                        《{task.bookName}》
                      </h3>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${getStatusStyle(task.status)}`}>
                        {task.status === 'exists' ? '已有这本书' :
                         task.status === 'done' ? '已进入知识库' :
                         task.status === 'copyright' ? '因版权问题无法摘录' :
                         task.status === 'failed' ? '摘录失败' :
                         task.status === 'pending' ? '等待开始' :
                         task.status === 'searching' ? '搜索中' :
                         task.status === 'downloading' ? '获取中' :
                         task.status === 'translating' ? '翻译中' :
                         task.status === 'saving' ? '摘录中' :
                         task.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {/* 取消/删除按钮 */}
                    {isActive(task.status) ? (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 px-2 py-1 rounded hover:bg-red-900/30 transition-colors"
                      >
                        取消
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-xs text-[#8a8070] hover:text-red-400 border border-[#2a2a3e] px-2 py-1 rounded hover:border-red-800/50 transition-colors"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                {(isActive(task.status) || task.status === 'done') && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-[#8a8070] mb-1">
                      <span>{task.message}</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="h-2 bg-[#0a0a0f] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(task.status)}`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 章节进度 */}
                {task.totalChapters > 0 && task.status !== 'done' && task.status !== 'exists' && (
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[#8a8070]">全书结构</p>
                      <p className="text-[#d4a853] font-bold text-sm">{task.chapterStructure || `${task.totalChapters} 章`}</p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[#8a8070]">当前</p>
                      <p className="text-[#d4a853] font-bold text-sm truncate" title={task.currentChapterName}>{task.currentChapterName || `${task.currentChapter}/${task.totalChapters}`}</p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[#8a8070]">剩余</p>
                      <p className="text-[#d4a853] font-bold text-sm">{task.remainingChapters}</p>
                    </div>
                  </div>
                )}

                {/* 预计剩余时间 */}
                {isActive(task.status) && getEstimatedTime(task) && (
                  <p className="text-xs text-[#8a8070] mt-1">
                    预计剩余: {getEstimatedTime(task)}
                  </p>
                )}

                {/* 完成信息 */}
                {task.status === 'done' && (
                  <div className="mt-2 bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                    <p className="text-green-300 font-bold text-center text-sm">
                      已进入知识库
                    </p>
                    <div className="flex justify-center gap-4 mt-1 text-xs text-green-400/70">
                      <span>{task.chapterStructure || `${task.totalChapters} 章`}</span>
                      <span>{task.size}</span>
                      <span>{task.chars?.toLocaleString()} 字</span>
                    </div>
                  </div>
                )}

                {/* 已有此书 */}
                {task.status === 'exists' && (
                  <div className="mt-2 bg-amber-900/20 border border-amber-800/30 rounded-lg p-3">
                    <p className="text-amber-300 text-center text-sm">
                      已有这本书 — 此书已在知识库中，无需重复添加
                    </p>
                  </div>
                )}

                {/* 版权限制 */}
                {task.status === 'copyright' && (
                  <div className="mt-2 bg-orange-900/20 border border-orange-800/30 rounded-lg p-3">
                    <p className="text-orange-300 text-center text-sm">
                      因版权问题无法摘录
                    </p>
                    <p className="text-xs text-orange-400/60 text-center mt-1">
                      已遍历所有可访问来源，均未找到此书公开内容
                    </p>
                  </div>
                )}

                {/* 时间信息 */}
                <div className="flex justify-between text-xs text-[#5a5a6e] mt-2">
                  <span>创建: {formatTime(task.createdAt)}</span>
                  {task.completedAt && (
                    <span>完成: {formatTime(task.completedAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {tasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📖</p>
            <p className="text-[#8a8070] text-sm">
              输入书名，自动搜索摘录到知识库
            </p>
            <p className="text-[#5a5a6e] text-xs mt-1">
              后台永久运行，退出APP不中断
            </p>
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a3e]">
          <h3 className="text-sm font-bold text-[#d4a853] mb-2">使用说明</h3>
          <ul className="text-xs text-[#8a8070] space-y-1">
            <li>• 输入书名后系统自动搜索并完整摘录</li>
            <li>• 后台永久运行，退出APP不影响录入进度</li>
            <li>• 下次打开自动恢复进度，继续录入</li>
            <li>• 已有此书会提示「已有这本书」</li>
            <li>• 摘录中可取消，完成后也可删除</li>
            <li>• 因版权限制无法获取的书籍会明确提示</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
