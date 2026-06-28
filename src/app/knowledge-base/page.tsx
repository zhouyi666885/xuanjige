'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface BookInfo {
  name: string;
  category: string;
  learned: boolean;
  learnedAt: number | null;
  charCount: number;
  // 录入阶段（task.status）：pending/searching/searched/entering/done/failed/unknown
  entryStatus?: string;
  entryProgress?: number;
  entryMessage?: string;
  reallyInLibrary?: boolean;
  learningStatus: 'pending' | 'learning' | 'done';
  learningProgress: number;
  learningCurrentChunk: number;
  learningTotalChunks: number;
  learningMessage: string;
  learningCurrentChapter?: number;
  learningCurrentChapterName?: string;
  hasMissingChapters: boolean;
  missingChapterNames?: string[];
  currentChapter: number;
  totalChapters: number;
  chapterStructure: string;
}

interface KnowledgeBaseStats {
  total: number;
  totalChars: number;
  bookCount: number;
  learnedCount: number;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [stats, setStats] = useState<KnowledgeBaseStats>({ total: 0, totalChars: 0, bookCount: 0, learnedCount: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingBook, setDeletingBook] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMissingFor, setShowMissingFor] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [isStartingLearning, setIsStartingLearning] = useState(false);
  // 单本书启动状态：bookName → true
  const [startingOne, setStartingOne] = useState<Record<string, boolean>>({});
  // 缺失章节弹层
  const [showMissing, setShowMissing] = useState<{ name: string; list: string[] } | null>(null);
  const pageSize = 50;

  const fetchBooks = useCallback(async (search = '', p = 1, silent = false) => {
    // silent 模式：后台轮询，不触发 loading 闪烁
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        page: String(p),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/knowledge-base?${params}`);
      const data = await res.json();
      // 数据变化才 setState，避免不必要的 re-render
      setBooks(prev => {
        const raw = data.books || [];
        // 检测"用户在 5 分钟内点过开始学习"的乐观标记
        let learningStartedRecently = false;
        try {
          const ts = parseInt(sessionStorage.getItem('xjg_learning_started') || '0', 10);
          if (ts && Date.now() - ts < 5 * 60 * 1000) {
            learningStartedRecently = true;
          }
        } catch { /* ignore */ }
        // 保护乐观更新：前端已 learning 的书，不被后端 pending 覆盖
        const next = raw.map((b: BookInfo) => {
          const prevBook = prev.find(p => p.name === b.name);
          if (prevBook && prevBook.learningStatus === 'learning' && b.learningStatus === 'pending') {
            return prevBook; // 保持前端的 learning 状态
          }
          // sessionStorage 乐观标记：跨页面切换后，pending 状态强制视为 learning（5分钟内）
          if (learningStartedRecently && b.learningStatus === 'pending') {
            return { ...b, learningStatus: 'learning' as const, learningMessage: b.learningMessage || '准备学习...' };
          }
          return b;
        });
        // 如果后端真的返回了至少一本 learning/done，清除 sessionStorage 标记
        const hasRealLearning = raw.some((b: BookInfo) => b.learningStatus === 'learning' || b.learningStatus === 'done');
        if (hasRealLearning) {
          try { sessionStorage.removeItem('xjg_learning_started'); } catch { /* ignore */ }
        }
        // 浅比较：数量、book.name + learningProgress + learningCurrentChunk 全等则跳过
        if (prev.length === next.length) {
          let allEqual = true;
          for (let i = 0; i < next.length; i++) {
            const a = prev[i];
            const b = next[i];
            if (!a || a.name !== b.name
              || a.learningStatus !== b.learningStatus
              || a.learningProgress !== b.learningProgress
              || a.learningCurrentChunk !== b.learningCurrentChunk
              || a.learningTotalChunks !== b.learningTotalChunks
              || a.learningMessage !== b.learningMessage
              || a.charCount !== b.charCount
              || a.learned !== b.learned) {
              allEqual = false;
              break;
            }
          }
          if (allEqual) return prev;
        }
        return next;
      });
      setStats(prev => {
        const next = {
          total: data.total,
          totalChars: data.totalChars,
          bookCount: data.bookCount,
          learnedCount: data.learnedCount || 0,
        };
        if (prev.total === next.total && prev.totalChars === next.totalChars
          && prev.bookCount === next.bookCount && prev.learnedCount === next.learnedCount) {
          return prev;
        }
        return next;
      });
      setTotalPages(prev => prev === (data.totalPages || 1) ? prev : (data.totalPages || 1));

      // 🛡️ 部署后自愈：检测到数据异常（书数>0 但单本字数 < 50000）→ 自动触发种子同步
      // 只在初次加载（非 silent）时检查，避免轮询时反复触发
      if (!silent) {
        const hasShortBook = (data.books || []).some((b: { charCount: number; name: string }) => b.charCount > 0 && b.charCount < 50000);
        if (hasShortBook && !sessionStorage.getItem('seed-synced')) {
          sessionStorage.setItem('seed-synced', '1');
          try {
            const syncRes = await fetch('/api/knowledge-base', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'force-sync-seed' }),
            });
            const syncData = await syncRes.json();
            if (syncData?.success && syncData?.data?.totalChars > data.totalChars) {
              console.log('[knowledge-base] 部署后自愈：种子数据已同步', syncData.data);
              // 拉新数据
              const res2 = await fetch(`/api/knowledge-base?${params}`);
              const data2 = await res2.json();
              setBooks(data2.books || []);
              setStats({
                total: data2.total,
                totalChars: data2.totalChars,
                bookCount: data2.bookCount,
                learnedCount: data2.learnedCount || 0,
              });
              setTotalPages(data2.totalPages || 1);
            }
          } catch (e) {
            console.warn('[knowledge-base] force-sync-seed 失败', e);
          }
        }
      }
    } catch {
      // 静默
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks(searchQuery, page, false);
  }, [fetchBooks, searchQuery, page]);

  // 自动轮询学习进度：有 learning 状态的书时每 3 秒后台刷新（silent=true 不闪烁）
  // 用 ref 持有最新参数，避免依赖 books 导致 timer 频繁重建
  const pollParamsRef = useRef({ searchQuery, page });
  pollParamsRef.current = { searchQuery, page };
  const hasLearningRef = useRef(false);
  hasLearningRef.current = books.some(b => b.learningStatus === 'learning');
  useEffect(() => {
    const timer = setInterval(() => {
      if (!hasLearningRef.current) return;
      const { searchQuery: sq, page: pg } = pollParamsRef.current;
      fetchBooks(sq, pg, true); // silent=true: 后台刷新不触发 loading
    }, 3000);
    return () => clearInterval(timer);
  }, [fetchBooks]);

  // 搜索防抖
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 分类列表
  const categories = ['全部', ...Array.from(new Set(books.map(b => b.category)))];
  const filteredBooks = activeCategory === '全部'
    ? books
    : books.filter(b => b.category === activeCategory);

  // 删除书籍
  const handleDelete = async (bookName: string) => {
    setDeletingBook(bookName);
    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookName }),
      });
      const data = await res.json();
      if (data.success) {
        // 刷新列表
        await fetchBooks(searchQuery, page);
      }
    } catch {
      // 静默
    } finally {
      setDeletingBook(null);
      setShowDeleteConfirm(null);
    }
  };

  // 开始学习所有书籍
  const handleStartLearning = async () => {
    setIsStartingLearning(true);
    // 持久化"用户已点击开始学习"的乐观标记 → 跨页面切换也能保住按钮状态
    try {
      sessionStorage.setItem('xjg_learning_started', String(Date.now()));
    } catch { /* ignore */ }
    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-learning' }),
      });
      await res.json();
      // 前端乐观更新：立即把 pending 的书设为 learning
      setBooks(prev => prev.map(b =>
        b.learningStatus === 'pending'
          ? { ...b, learningStatus: 'learning' as const, learningMessage: '正在启动学习...', learningProgress: 0 }
          : b
      ));
      // 延迟刷新一次确保后端数据已写入
      await new Promise(r => setTimeout(r, 1500));
      await fetchBooks(searchQuery, page, true);
    } catch {
      // 静默
    }
    // 不立即 setIsStartingLearning(false) —— 等 books 数据中有 learning 再松开
    // 这样即使 fetchBooks 返回时后端还没更新完，按钮也不会闪回
  };

  // 单本书启动学习
  const handleStartLearningOne = async (bookName: string) => {
    setStartingOne(prev => ({ ...prev, [bookName]: true }));
    // 乐观更新：立即把这本书设为 learning
    setBooks(prev => prev.map(b =>
      b.name === bookName
        ? { ...b, learningStatus: 'learning' as const, learningMessage: '正在启动学习...', learningProgress: 0 }
        : b
    ));
    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-learning-one', bookName }),
      });
      await res.json();
      await new Promise(r => setTimeout(r, 1200));
      await fetchBooks(searchQuery, page, true);
    } catch {
      // 失败回滚
      setBooks(prev => prev.map(b =>
        b.name === bookName ? { ...b, learningStatus: 'pending' as const } : b
      ));
    } finally {
      setStartingOne(prev => {
        const next = { ...prev };
        delete next[bookName];
        return next;
      });
    }
  };

  // 格式化字符数
  const formatChars = (chars: number) => {
    if (chars >= 100000000) return `${(chars / 100000000).toFixed(1)}亿`;
    if (chars >= 10000) return `${(chars / 10000).toFixed(0)}万`;
    return String(chars);
  };

  // 分类图标
  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, string> = {
      '易学': '🔮', '八字': '🎋', '紫微': '⭐', '风水': '🏔️',
      '相学': '👁️', '择日': '📅', '姓名': '✍️', '道教': '☯️',
      '佛教': '☸️', '儒学': '📜', '中医': '🌿', '术数': '🧮',
      '其他': '📖',
    };
    return icons[cat] || '📖';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e0d0]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-[#2a2a3e]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-[#8a8070] hover:text-[#d4a853] transition-colors text-sm"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-[#d4a853] flex-1 text-center">
            知识库
          </h1>
          <span className="text-xs text-[#8a8070]">
            {stats.bookCount} 本
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 统计概览 */}
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a3e]">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-[#d4a853]">{stats.bookCount}</p>
              <p className="text-xs text-[#8a8070]">收录书籍</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#4ade80]">{stats.learnedCount}</p>
              <p className="text-xs text-[#8a8070]">已学习</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4a853]">{formatChars(stats.totalChars)}</p>
              <p className="text-xs text-[#8a8070]">总字符数</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4a853]">{stats.total}</p>
              <p className="text-xs text-[#8a8070]">{searchQuery ? '搜索结果' : '当前显示'}</p>
            </div>
          </div>
          {/* 学习进度条 */}
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[#8a8070] mb-1">
              <span>学习进度</span>
              <span>{stats.bookCount > 0 ? Math.round(stats.learnedCount / stats.bookCount * 100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-[#0a0a0f] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#4ade80] to-[#d4a853] rounded-full transition-all duration-500"
                style={{ width: `${stats.bookCount > 0 ? (stats.learnedCount / stats.bookCount * 100) : 0}%` }}
              />
            </div>
          </div>
          {/* 开始学习按钮：状态完全由 books 真实数据推导，避免刷新丢失 */}
          {(() => {
            // 计算 books 中各种状态的数量
            const learningCount = books.filter(b => b.learningStatus === 'learning').length;
            const pendingCount = books.filter(b => b.learningStatus === 'pending').length;
            const doneCount = books.filter(b => b.learningStatus === 'done').length;
            // 全部学完 → 不显示按钮
            if (doneCount > 0 && learningCount === 0 && pendingCount === 0) return null;
            // 没书 → 不显示
            if (books.length === 0) return null;
            // 按钮显示状态：学习中 > 正在启动 > 待学习
            const isLearning = learningCount > 0;
            // 一旦后端确认 learning，自动清除"启动中"临时态
            if (isLearning && isStartingLearning) setIsStartingLearning(false);
            const disabled = isStartingLearning || isLearning;
            const label = isLearning
              ? `深度学习中…正在学习 ${learningCount} 本，已学完 ${doneCount} 本`
              : isStartingLearning
                ? '正在启动学习…'
                : `开始学习（${pendingCount} 本待学习）`;
            const cls = isLearning
              ? 'bg-[#2a2a3e] text-[#d4a853] cursor-not-allowed border border-[#d4a853]/30'
              : isStartingLearning
                ? 'bg-[#2a2a3e] text-[#8a8070] cursor-wait'
                : 'bg-gradient-to-r from-[#d4a853] to-[#c0392b] text-[#0a0a0f] hover:shadow-lg hover:shadow-[#d4a853]/20';
            return (
              <div className="mt-3">
                <button
                  onClick={handleStartLearning}
                  disabled={disabled}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${cls}`}
                >
                  {isLearning && <span className="inline-block w-2 h-2 bg-[#d4a853] rounded-full" />}
                  {label}
                </button>
              </div>
            );
          })()}
        </div>

        {/* 搜索栏 */}
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a3e]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8070]">🔍</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索书名..."
              className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg pl-10 pr-4 py-2.5 text-[#e8e0d0] placeholder-[#5a5a6e] focus:border-[#d4a853] focus:outline-none transition-colors text-sm"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a6e] hover:text-[#e8e0d0] transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 分类筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors ${
                activeCategory === cat
                  ? 'bg-[#d4a853] text-[#0a0a0f] font-bold'
                  : 'bg-[#1a1a2e] text-[#8a8070] border border-[#2a2a3e] hover:border-[#d4a853]/50'
              }`}
            >
              {cat !== '全部' && `${getCategoryIcon(cat)} `}{cat}
            </button>
          ))}
        </div>

        {/* 书籍列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#d4a853] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[#8a8070] text-sm">加载中...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📚</p>
            <p className="text-[#8a8070] text-sm">
              {searchQuery ? `未找到与"${searchQuery}"相关的书籍` : '知识库暂无书籍'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBooks.map((book) => (
              <div
                key={book.name}
                className="bg-[#1a1a2e] rounded-xl p-3 border border-[#2a2a3e] hover:border-[#d4a853]/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">{getCategoryIcon(book.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm text-[#e8e0d0] truncate font-medium">
                        《{book.name}》
                      </h3>
                      {/* 🔴 录入阶段标签：只在书还没真正入库时显示，让用户知道"还在搜索/录入" */}
                      {!book.reallyInLibrary && book.entryStatus === 'searching' && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-blue-500/20 inline-flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                          搜索中
                        </span>
                      )}
                      {!book.reallyInLibrary && book.entryStatus === 'searched' && (
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-purple-500/20">
                          已搜到，待录入
                        </span>
                      )}
                      {!book.reallyInLibrary && book.entryStatus === 'entering' && (
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-indigo-500/20 inline-flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                          录入中
                        </span>
                      )}
                      {!book.reallyInLibrary && book.entryStatus === 'pending' && (
                        <span className="text-[10px] bg-gray-500/10 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-gray-500/20">
                          排队中
                        </span>
                      )}
                      {!book.reallyInLibrary && book.entryStatus === 'failed' && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-red-500/20">
                          录入失败
                        </span>
                      )}
                      {book.learningStatus === 'done' && (
                        <span className="text-[10px] bg-[#4ade80]/10 text-[#4ade80] px-1.5 py-0.5 rounded-full flex-shrink-0 border border-[#4ade80]/20">
                          已深度学习
                        </span>
                      )}
                      {book.learningStatus === 'learning' && (
                        <span className="text-[10px] bg-[#d4a853]/10 text-[#d4a853] px-1.5 py-0.5 rounded-full flex-shrink-0 border border-[#d4a853]/20 inline-flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-[#d4a853] rounded-full" />
                          深度学习中
                        </span>
                      )}
                      {book.learningStatus === 'pending' && book.reallyInLibrary && (
                        <span className="text-[10px] bg-[#5a5a6e]/10 text-[#5a5a6e] px-1.5 py-0.5 rounded-full flex-shrink-0 border border-[#5a5a6e]/20">
                          待学习
                        </span>
                      )}
                      {book.hasMissingChapters && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMissing({
                              name: book.name,
                              list: book.missingChapterNames || [],
                            });
                          }}
                          className="text-[10px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-amber-700/30 hover:bg-amber-900/50 transition-colors"
                          title="点击查看缺失章节详情"
                        >
                          缺 {(book.missingChapterNames?.length) || (book.totalChapters - book.currentChapter)} {book.chapterStructure || '章'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] bg-[#0a0a0f] text-[#8a8070] px-2 py-0.5 rounded-full">
                        {book.category}
                      </span>
                      {book.charCount > 0 && (
                        <span className="text-[10px] text-[#5a5a6e]">
                          {formatChars(book.charCount)}字
                        </span>
                      )}
                      {/* 所有书都显示总章数（按原书结构单位：章/卷/卦/篇/回/段） */}
                      {book.totalChapters > 0 && (
                        <span className="text-[10px] text-[#d4a853]/70 bg-[#d4a853]/5 px-1.5 py-0.5 rounded border border-[#d4a853]/15">
                          共 {book.totalChapters} {book.chapterStructure || '章'}
                        </span>
                      )}
                    </div>
                    {/* 学习进度条（pending/learning/done 全部显示） */}
                    <div className="mt-1.5">
                      <div className="flex justify-between text-[9px] text-[#8a8070] mb-0.5">
                        <span className="truncate flex-1 mr-2">
                          {book.learningStatus === 'done'
                            ? '深度学习完成'
                            : book.learningStatus === 'learning'
                              ? (book.learningCurrentChapter && book.learningCurrentChapter > 0
                                  ? `📖 学到第 ${book.learningCurrentChapter}/${book.totalChapters} ${book.chapterStructure || '章'}${book.learningCurrentChapterName ? `「${book.learningCurrentChapterName.substring(0, 14)}」` : ''}`
                                  : (book.learningMessage || 'AI深度学习中...'))
                              : '⏳ 待学习'}
                        </span>
                        <span className="flex-shrink-0">
                          {book.learningStatus === 'pending'
                            ? '0%'
                            : book.learningTotalChunks > 0
                              ? `${book.learningProgress}%`
                              : `${book.learningProgress}%`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#0a0a0f] rounded-full overflow-hidden relative border border-[#3a3a4e]/40">
                        {book.learningStatus === 'learning' && book.learningProgress === 0 ? (
                          // 学习刚启动（读全文/初始化阶段）：不确定动画，左右滑动金色条
                          <div className="progress-indeterminate" />
                        ) : (
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              book.learningStatus === 'done'
                                ? 'bg-gradient-to-r from-[#4ade80] to-[#22c55e]'
                                : book.learningStatus === 'learning'
                                  ? 'bg-gradient-to-r from-[#d4a853] to-[#f59e0b]'
                                  : 'bg-[#3a3a4e]'
                            }`}
                            style={{
                              width: book.learningStatus === 'pending'
                                ? '100%'
                                : book.learningStatus === 'learning'
                                  ? `${Math.max(3, book.learningProgress)}%`
                                  : `${book.learningProgress}%`,
                              opacity: book.learningStatus === 'pending' ? 0.3 : 1,
                            }}
                          />
                        )}
                        {book.learningStatus === 'learning' && book.learningProgress > 0 && (
                          <div
                            className="absolute top-0 left-0 h-full rounded-full opacity-50"
                            style={{
                              width: `${Math.max(3, book.learningProgress)}%`,
                              background: 'linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.4) 50%, transparent 100%)',
                              animation: 'shimmer 2s infinite',
                            }}
                          />
                        )}
                      </div>
                      {/* 4层学习状态指示 */}
                      {book.learningStatus === 'learning' && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[#0a0a0f] text-[#d4a853] border border-[#d4a853]/20">①术语</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[#0a0a0f] text-[#d4a853] border border-[#d4a853]/20">②逻辑</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[#0a0a0f] text-[#d4a853] border border-[#d4a853]/20">③关联</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[#0a0a0f] text-[#d4a853] border border-[#d4a853]/20">④应用</span>
                        </div>
                      )}
                      {book.learningStatus === 'done' && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[8px] px-1 py-0.5 rounded bg-green-900/20 text-green-400">✓术语</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-green-900/20 text-green-400">✓逻辑</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-green-900/20 text-green-400">✓关联</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-green-900/20 text-green-400">✓应用</span>
                        </div>
                      )}
                      {/* 🔴 单本书"开始学习"按钮：仅 pending 状态显示 */}
                      {book.learningStatus === 'pending' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartLearningOne(book.name);
                          }}
                          disabled={!!startingOne[book.name]}
                          className="mt-2 text-[10px] px-2 py-1 rounded bg-[#d4a853]/10 text-[#d4a853] border border-[#d4a853]/30 hover:bg-[#d4a853]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full"
                        >
                          {startingOne[book.name] ? '⏳ 启动中...' : `📖 开始深度学习《${book.name}》`}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(book.name)}
                    className="text-xs text-[#5a5a6e] hover:text-red-400 border border-transparent hover:border-red-800/50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 py-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-xs text-[#8a8070] hover:text-[#d4a853] disabled:text-[#3a3a4e] disabled:cursor-not-allowed transition-colors"
            >
              ← 上一页
            </button>
            <span className="text-xs text-[#8a8070]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-xs text-[#8a8070] hover:text-[#d4a853] disabled:text-[#3a3a4e] disabled:cursor-not-allowed transition-colors"
            >
              下一页 →
            </button>
          </div>
        )}

        {/* 底部入口 */}
        <div className="pt-2 pb-6">
          <button
            onClick={() => router.push('/add-book')}
            className="w-full bg-gradient-to-r from-[#d4a853]/10 to-[#d4a853]/5 border border-[#d4a853]/20 rounded-xl p-3 text-[#d4a853] font-bold text-sm hover:border-[#d4a853]/40 hover:from-[#d4a853]/20 transition-all"
          >
            ➕ 添加更多书籍
          </button>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 max-w-sm w-full">
            <h3 className="text-[#e8e0d0] font-bold mb-2">确认删除</h3>
            <p className="text-sm text-[#8a8070] mb-4">
              确定要从知识库中删除《{showDeleteConfirm}》吗？删除后此书将从知识库中移除，相关内容将不再出现在AI回答中。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 text-sm py-2 rounded-lg border border-[#2a2a3e] text-[#8a8070] hover:text-[#e8e0d0] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deletingBook === showDeleteConfirm}
                className="flex-1 text-sm py-2 rounded-lg bg-red-900/60 text-red-300 border border-red-800/50 hover:bg-red-900/80 transition-colors disabled:opacity-50"
              >
                {deletingBook === showDeleteConfirm ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 缺失章节详情弹窗 */}
      {showMissingFor && (() => {
        const book = books.find((b) => b.name === showMissingFor);
        if (!book) return null;
        const unit = book.chapterStructure || '章';
        const missing = book.missingChapterNames || [];
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowMissingFor(null)}>
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 max-w-md w-full max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[#e8e0d0] font-bold mb-1">《{book.name}》缺失{unit}节</h3>
              <p className="text-xs text-[#8a8070] mb-3">
                已抓 {book.currentChapter}/{book.totalChapters} {unit}，共缺 {missing.length} {unit}
              </p>
              {missing.length === 0 ? (
                <p className="text-sm text-[#8a8070]">未检测到具体缺失{unit}节名。</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {missing.map((n) => (
                    <span key={n} className="text-[11px] px-2 py-1 rounded bg-[#2a1818] text-red-300 border border-red-900/40">
                      {n}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowMissingFor(null)}
                className="mt-4 w-full text-sm py-2 rounded-lg border border-[#2a2a3e] text-[#8a8070] hover:text-[#e8e0d0]"
              >
                关闭
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
