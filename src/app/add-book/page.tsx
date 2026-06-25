'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  hasMissingChapters?: boolean;
  source: string;
  size: string;
  chars: number;
  chapterStructure: string;
  learningStatus: string;
  learningProgress: number;
  learningCurrentChunk: number;
  learningTotalChunks: number;
  learningMessage: string;
  learningChapterStructure: string;
  learningTotalChapters: number;
  learningLearnedChapters: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  error: string;
}

interface LearningBook {
  name: string;
  learnedChapters: number;
  totalChapters: number;
  chapterStructure: string;
  learned: boolean;
  charCount: number;
  learningProgress: number;
}

// 平滑进度条组件：在轮询间隔内插值动画
function SmoothProgressBar({ progress, status, message }: {
  progress: number;
  status: string;
  message: string;
}) {
  const [displayProgress, setDisplayProgress] = useState(progress);
  const [prevProgress, setPrevProgress] = useState(progress);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (progress !== prevProgress) {
      // 新进度到来，启动插值动画
      setPrevProgress(displayProgress);
      startTimeRef.current = Date.now();
      const fromProgress = displayProgress;
      const toProgress = progress;
      const duration = 1800; // 1.8秒内平滑过渡到新进度

      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const t = Math.min(elapsed / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const current = fromProgress + (toProgress - fromProgress) * eased;
        setDisplayProgress(current);
        if (t < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(animate);
    }
  }, [progress, prevProgress, displayProgress]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const getProgressColor = (s: string) => {
    switch (s) {
      case 'done': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'copyright': return 'bg-orange-500';
      default: return 'bg-gradient-to-r from-[#d4a853] to-[#f0c674]';
    }
  };

  const getIsActive = (s: string) =>
    ['pending', 'searching', 'downloading', 'translating', 'saving'].includes(s);

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-[#8a8070] mb-1">
        <span>{message}</span>
        <span>{Math.round(displayProgress)}%</span>
      </div>
      <div className="h-2.5 bg-[#0a0a0f] rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full ${getProgressColor(status)}`}
          style={{
            width: `${displayProgress}%`,
            transition: getIsActive(status) ? 'none' : 'width 0.5s ease-out',
          }}
        />
        {/* 活跃状态流光效果 */}
        {getIsActive(status) && displayProgress > 0 && (
          <div
            className="absolute top-0 left-0 h-full rounded-full opacity-60"
            style={{
              width: `${displayProgress}%`,
              background: 'linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.4) 50%, transparent 100%)',
              animation: 'shimmer 2s infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function AddBookPage() {
  const router = useRouter();
  const [bookName, setBookName] = useState('');
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [copyrightNotices, setCopyrightNotices] = useState<{bookName: string; status: string; message: string; createdAt: number}[]>([]);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, done: 0, failed: 0 });
  const [bookCount, setBookCount] = useState(0);
  const [learningBooks, setLearningBooks] = useState<LearningBook[]>([]);

  // 新会话清除版权提示（退出APP后再进入时版权提示消失）
  useEffect(() => {
    const cleared = sessionStorage.getItem('xuanjige_copyright_cleared');
    if (!cleared) {
      // 新会话，清除服务端的版权/失败任务
      fetch('/api/add-book', { method: 'DELETE' }).catch(() => {});
      sessionStorage.setItem('xuanjige_copyright_cleared', '1');
    }
  }, []);

  // 轮询获取任务列表
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/add-book');
      const data = await res.json();
      setTasks(data.tasks || []);
      setCopyrightNotices(data.copyrightNotices || []);
      setStats(data.stats || { total: 0, active: 0, done: 0, failed: 0 });
      setBookCount(data.bookCount || 0);
      setLearningBooks(data.learningBooks || []);
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

  // 添加书籍（支持批量）
  const handleAdd = async () => {
    if (!bookName.trim()) return;
    setIsSubmitting(true);
    try {
      // 解析书名：支持换行、逗号、顿号分隔
      const names = bookName
        .split(/[\n,，、;；\t]+/)
        .map(n => n.trim())
        .filter(Boolean);

      // 去重
      const uniqueNames = [...new Set(names)];

      if (uniqueNames.length === 0) {
        setIsSubmitting(false);
        return;
      }

      const res = await fetch('/api/add-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookName: uniqueNames.length === 1 ? uniqueNames[0] : undefined,
          bookNames: uniqueNames.length > 1 ? uniqueNames : undefined,
        }),
      });
      const data = await res.json();

      // 批量添加时显示结果提示
      if (data.total && data.total > 1) {
        const msgs: string[] = [];
        if (data.added > 0) msgs.push(`${data.added} 本开始录入`);
        if (data.alreadyExists > 0) msgs.push(`${data.alreadyExists} 本已有`);
        // 可以用 alert 或 toast，这里简单通过刷新展示
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
          <button
            onClick={() => router.push('/knowledge-base')}
            className="text-xs text-[#d4a853] hover:text-[#f0c674] transition-colors font-medium"
          >
            📚 知识库 {bookCount} 本
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 知识库入口 */}
        <button
          onClick={() => router.push('/knowledge-base')}
          className="w-full bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[#d4a853]/20 rounded-xl p-4 flex items-center gap-4 hover:border-[#d4a853]/40 hover:from-[#1a1a2e] hover:to-[#1a2a4e] transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-[#d4a853]/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            📚
          </div>
          <div className="flex-1 text-left">
            <p className="text-[#d4a853] font-bold text-sm">查看知识库</p>
            <p className="text-xs text-[#8a8070] mt-0.5">
              已收录 {bookCount} 本典籍，点击查看全部书籍
            </p>
          </div>
          <span className="text-[#d4a853]/30 text-xl group-hover:text-[#d4a853]/60 transition-colors">›</span>
        </button>
        {/* 输入区 */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e]">
          <p className="text-sm text-[#8a8070] mb-3">
            输入书名，支持一次添加多本（换行或逗号分隔）。退出APP不影响，后台持续录入。
          </p>
          <div className="flex gap-2">
            <textarea
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl+Enter 或 单行时 Enter 提交
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey && !bookName.includes('\n'))) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="输入书名，支持批量添加&#10;每行一个，或用逗号分隔&#10;如：滴天髓&#10;      渊海子平，三命通会"
              className="flex-1 bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-4 py-3 text-[#e8e0d0] placeholder-[#5a5a6e] focus:border-[#d4a853] focus:outline-none transition-colors resize-none min-h-[80px]"
              disabled={isSubmitting}
              rows={3}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleAdd}
                disabled={isSubmitting || !bookName.trim()}
                className="bg-[#d4a853] hover:bg-[#e0b860] disabled:bg-[#3a3a4e] disabled:text-[#6a6a7e] text-[#0a0a0f] font-bold px-5 py-3 rounded-lg transition-colors whitespace-nowrap flex-1"
              >
                {isSubmitting ? '添加中...' : (
                  bookName.includes('\n') || bookName.split(/[，,、;；]/).filter(Boolean).length > 1
                    ? '批量添加'
                    : '添加'
                )}
              </button>
              {bookName.trim() && (
                <p className="text-[10px] text-[#5a5a6e] text-center">
                  {bookName.split(/[\n,，、;；\t]+/).filter(n => n.trim()).length} 本
                </p>
              )}
            </div>
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

        {/* 版权失败一次性提示 */}
        {copyrightNotices.filter(n => !dismissedNotices.has(n.bookName)).length > 0 && (
          <div className="space-y-2">
            {copyrightNotices.filter(n => !dismissedNotices.has(n.bookName)).map((notice) => (
              <div
                key={notice.bookName}
                className="bg-red-950/60 rounded-xl p-4 border border-red-800/40 flex items-start gap-3"
              >
                <span className="text-lg mt-0.5">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-300 font-medium">
                    《{notice.bookName}》因版权问题录入失败
                  </p>
                  <p className="text-xs text-red-400/60 mt-1">
                    已搜遍全网所有渠道，均未找到完整内容
                  </p>
                </div>
                <button
                  onClick={() => setDismissedNotices(prev => new Set(prev).add(notice.bookName))}
                  className="text-xs text-red-400/60 hover:text-red-300 border border-red-800/30 px-2 py-1 rounded transition-colors"
                >
                  知道了
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 正在录入中的任务列表（只显示活跃任务，带进度条） */}
        {tasks.filter(t => isActive(t.status)).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#8a8070] uppercase tracking-wider">
              正在录入
            </h2>
            {tasks.filter(t => isActive(t.status)).map((task) => (
              <div
                key={task.id}
                className="bg-[#1a1a2e] rounded-xl p-4 border border-[#d4a853]/50 transition-colors"
              >
                {/* 书名和状态 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getStatusIcon(task.status)}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[#e8e0d0] truncate">
                        《{task.bookName}》
                      </h3>
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1 bg-[#d4a853]/20 text-[#d4a853] border border-[#d4a853]/30">
                        {task.status === 'pending' ? '等待开始' :
                         task.status === 'searching' ? '搜索中' :
                         task.status === 'downloading' ? '获取中' :
                         task.status === 'translating' ? '翻译中' :
                         task.status === 'saving' ? '摘录中' :
                         task.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 px-2 py-1 rounded hover:bg-red-900/30 transition-colors ml-2"
                  >
                    取消
                  </button>
                </div>

                {/* 进度条1 - 录入进度 */}
                {(isActive(task.status)) && (
                  <div className="mb-1">
                    <div className="flex justify-between text-[10px] text-[#8a8070] mb-0.5">
                      <span>录入进度</span>
                      <span>
                        {task.totalChapters > 0
                          ? `第${task.currentChapter}${task.chapterStructure || '章'}/共${task.totalChapters}${task.chapterStructure || '章'}`
                          : `${task.progress}%`}
                      </span>
                    </div>
                    <SmoothProgressBar
                      progress={task.progress}
                      status={task.status}
                      message={task.message}
                    />
                    {/* 章节结构指示 */}
                    {task.totalChapters > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                        <div className="bg-[#0a0a0f] rounded-lg p-1.5 text-center">
                          <p className="text-[#8a8070] text-[9px]">全书</p>
                          <p className="text-[#d4a853] font-bold">{task.totalChapters}{task.chapterStructure || '章'}</p>
                        </div>
                        <div className="bg-[#0a0a0f] rounded-lg p-1.5 text-center">
                          <p className="text-[#8a8070] text-[9px]">当前</p>
                          <p className="text-[#d4a853] font-bold truncate" title={task.currentChapterName}>
                            {task.currentChapterName || `第${task.currentChapter}${task.chapterStructure || '章'}`}
                          </p>
                        </div>
                        <div className="bg-[#0a0a0f] rounded-lg p-1.5 text-center">
                          <p className="text-[#8a8070] text-[9px]">剩余</p>
                          <p className="text-[#d4a853] font-bold">{task.remainingChapters}{task.chapterStructure || '章'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 进度条2 - AI深度学习（录入完成后显示） */}
                {(task.status === 'done' && task.learningStatus && task.learningStatus !== 'pending') && (
                  <div className="mb-1">
                    <div className="flex justify-between text-[10px] text-[#8a8070] mb-0.5">
                      <span>AI深度学习进度</span>
                      <span>
                        {task.learningChapterStructure && task.learningTotalChapters > 0
                          ? `第${task.learningLearnedChapters}${task.learningChapterStructure}/共${task.learningTotalChapters}${task.learningChapterStructure}`
                          : `${task.learningProgress}%`}
                      </span>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-[#8a8070] mb-1">
                        <span>
                          {task.learningStatus === 'done' ? '已学完全部内容' :
                           task.learningChapterStructure && task.learningTotalChapters > 0
                             ? `正在学习第${task.learningLearnedChapters}${task.learningChapterStructure}...`
                             : (task.learningMessage || 'AI深度学习中...')}
                        </span>
                        <span>{task.learningProgress}%</span>
                      </div>
                      <div className="h-2 bg-[#0a0a0f] rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full ${
                            task.learningStatus === 'done' ? 'bg-gradient-to-r from-[#4ade80] to-[#22c55e]' :
                            task.learningStatus === 'failed' ? 'bg-red-500' :
                            'bg-gradient-to-r from-[#4ade80] to-[#d4a853]'
                          }`}
                          style={{ width: `${task.learningProgress}%`, transition: 'width 0.5s ease-out' }}
                        />
                        {task.learningStatus === 'learning' && task.learningProgress > 0 && (
                          <div
                            className="absolute top-0 left-0 h-full rounded-full opacity-60"
                            style={{
                              width: `${task.learningProgress}%`,
                              background: 'linear-gradient(90deg, transparent 0%, rgba(74,222,128,0.4) 50%, transparent 100%)',
                              animation: 'shimmer 2s infinite',
                            }}
                          />
                        )}
                      </div>
                      {/* 章节结构学习进度 */}
                      {task.learningChapterStructure && task.learningTotalChapters > 0 && task.learningStatus === 'learning' && (
                        <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                          <div className="bg-[#0a0a0f] rounded-lg p-1.5 text-center">
                            <p className="text-[#8a8070] text-[9px]">全书</p>
                            <p className="text-[#4ade80] font-bold">{task.learningTotalChapters}{task.learningChapterStructure}</p>
                          </div>
                          <div className="bg-[#0a0a0f] rounded-lg p-1.5 text-center">
                            <p className="text-[#8a8070] text-[9px]">已学到</p>
                            <p className="text-[#4ade80] font-bold">第{task.learningLearnedChapters}{task.learningChapterStructure}</p>
                          </div>
                          <div className="bg-[#0a0a0f] rounded-lg p-1.5 text-center">
                            <p className="text-[#8a8070] text-[9px]">剩余</p>
                            <p className="text-[#4ade80] font-bold">{task.learningTotalChapters - task.learningLearnedChapters}{task.learningChapterStructure}</p>
                          </div>
                        </div>
                      )}
                      {/* 4层学习进度指示 */}
                      {task.learningStatus === 'learning' && task.learningTotalChunks > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-[#d4a853] border border-[#d4a853]/30">
                            ①术语理解
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-[#d4a853] border border-[#d4a853]/30">
                            ②逻辑掌握
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-[#d4a853] border border-[#d4a853]/30">
                            ③知识关联
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-[#d4a853] border border-[#d4a853]/30">
                            ④应用方法
                          </span>
                          <span className="text-[9px] text-[#5a5a6e] ml-1">
                            {task.learningCurrentChunk}/{task.learningTotalChunks}块
                          </span>
                        </div>
                      )}
                      {task.learningStatus === 'done' && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/30">
                            ✓ 术语已理解
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/30">
                            ✓ 逻辑已掌握
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/30">
                            ✓ 关联已建立
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/30">
                            ✓ 应用已学会
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 章节进度 */}
                {task.totalChapters > 0 && task.status !== 'done' && task.status !== 'exists' && (
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[#8a8070]">全书结构</p>
                      <p className="text-[#d4a853] font-bold text-sm">{task.chapterStructure ? `${task.totalChapters} ${task.chapterStructure}` : `${task.totalChapters} 章`}</p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[#8a8070]">当前</p>
                      <p className="text-[#d4a853] font-bold text-sm truncate" title={task.currentChapterName}>
                        {task.currentChapterName || `第${task.currentChapter}${task.chapterStructure || '章'}`}
                      </p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[#8a8070]">剩余</p>
                      <p className="text-[#d4a853] font-bold text-sm">{task.remainingChapters} {task.chapterStructure || '章'}</p>
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
                  <div className={`mt-2 border rounded-lg p-3 ${
                    task.learningStatus === 'done' 
                      ? 'bg-green-900/20 border-green-800/30' 
                      : task.learningStatus === 'failed'
                      ? 'bg-red-900/20 border-red-800/30'
                      : 'bg-blue-900/20 border-blue-800/30'
                  }`}>
                    <p className={`font-bold text-center text-sm ${
                      task.learningStatus === 'done' 
                        ? 'text-green-300' 
                        : task.learningStatus === 'failed'
                        ? 'text-red-300'
                        : 'text-blue-300'
                    }`}>
                      {task.learningStatus === 'done' 
                        ? '已录入并AI学完' 
                        : task.learningStatus === 'failed'
                        ? '录入成功，AI学习失败'
                        : task.learningStatus === 'learning'
                        ? '录入完成，AI学习中...'
                        : '录入完成，等待AI学习...'}
                    </p>
                    <p className={`text-center text-[10px] mt-0.5 ${
                      task.learningStatus === 'done' 
                        ? 'text-green-400/50' 
                        : task.learningStatus === 'failed'
                        ? 'text-red-400/50'
                        : 'text-blue-400/50'
                    }`}>
                      {task.learningStatus === 'done' 
                        ? '全文已学会，回答问题时可随时调用'
                        : task.learningStatus === 'failed'
                        ? 'AI学习失败，可尝试重新录入'
                        : '学习完成后知识点才可被AI调用'}
                    </p>
                    <div className="flex justify-center gap-4 mt-1 text-xs text-[#8a8070]">
                      <span>{task.chapterStructure ? `${task.totalChapters} ${task.chapterStructure}` : `${task.totalChapters} 章`}</span>
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
              支持批量添加，后台永久运行
            </p>
          </div>
        )}

        {/* 学习中的书籍 */}
        {learningBooks.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-[#8b5cf6] mb-3 flex items-center gap-2">
              <span className="animate-pulse">🧠</span>
              深度学习中（{learningBooks.length}本）
            </h3>
            <div className="space-y-3">
              {learningBooks.map((book: LearningBook) => {
                const lp = book.learningProgress || 0;
                const structure = book.chapterStructure || '章';
                const learned = book.learnedChapters || 0;
                const total = book.totalChapters || 0;
                const isLearned = lp >= 100;
                return (
                  <div
                    key={book.name}
                    className="bg-[#1a1a2e] rounded-lg p-3 border border-[#2a2a3e]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-[#e8e0d0] font-medium truncate max-w-[60%]">
                        {book.name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isLearned
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-purple-900/50 text-purple-400'
                      }`}>
                        {isLearned ? '已吃透' : '学习中'}
                      </span>
                    </div>
                    <div className="relative h-2 bg-[#0a0a0f] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isLearned
                            ? 'bg-gradient-to-r from-green-600 to-emerald-400'
                            : 'bg-gradient-to-r from-purple-600 to-violet-400'
                        }`}
                        style={{ width: `${Math.min(lp, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-[#8a8070]">
                        {total > 0
                          ? `第${learned}${structure}/共${total}${structure}`
                          : `${lp.toFixed(0)}%`}
                      </span>
                      <span className="text-xs text-[#8a8070]">
                        {(book.charCount || 0).toLocaleString()}字
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a3e]">
          <h3 className="text-sm font-bold text-[#d4a853] mb-2">使用说明</h3>
          <ul className="text-xs text-[#8a8070] space-y-1">
            <li>• 支持批量添加：每行一个书名，或用逗号/顿号分隔</li>
            <li>• 输入书名后系统自动搜索并完整摘录</li>
            <li>• 后台永久运行，退出APP不影响录入进度</li>
            <li>• 下次打开自动恢复进度，继续录入</li>
            <li>• 已有此书自动跳过，不重复录入</li>
            <li>• 摘录中可取消，完成后也可删除</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
