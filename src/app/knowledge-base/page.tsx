'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface BookInfo {
  name: string;
  category: string;
  learned: boolean;
  learnedAt: number | null;
  charCount: number;
  learningStatus: 'pending' | 'learning' | 'done';
  learningProgress: number;
  learningCurrentChunk: number;
  learningTotalChunks: number;
  learningMessage: string;
  hasMissingChapters: boolean;
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
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [isStartingLearning, setIsStartingLearning] = useState(false);
  const [learningStarted, setLearningStarted] = useState(false);
  const pageSize = 50;

  const fetchBooks = useCallback(async (search = '', p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        page: String(p),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/knowledge-base?${params}`);
      const data = await res.json();
      setBooks(data.books || []);
      setStats({
        total: data.total,
        totalChars: data.totalChars,
        bookCount: data.bookCount,
        learnedCount: data.learnedCount || 0,
      });
      setTotalPages(data.totalPages || 1);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks(searchQuery, page);
  }, [fetchBooks, searchQuery, page]);

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
    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setLearningStarted(true);
      }
    } catch {
      // 静默
    } finally {
      setIsStartingLearning(false);
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
          {/* 开始学习按钮 */}
          {stats.learnedCount < stats.bookCount && (
            <div className="mt-3">
              <button
                onClick={handleStartLearning}
                disabled={isStartingLearning || learningStarted}
                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
                  learningStarted
                    ? 'bg-[#2a2a3e] text-[#8a8070] cursor-not-allowed'
                    : isStartingLearning
                    ? 'bg-[#2a2a3e] text-[#8a8070] animate-pulse'
                    : 'bg-gradient-to-r from-[#d4a853] to-[#c0392b] text-[#0a0a0f] hover:shadow-lg hover:shadow-[#d4a853]/20'
                }`}
              >
                {learningStarted
                  ? '学习中…后台自动进行'
                  : isStartingLearning
                  ? '正在启动学习…'
                  : `开始学习（${stats.bookCount - stats.learnedCount} 本待学习）`}
              </button>
            </div>
          )}
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
                      {book.learningStatus === 'done' && (
                        <span className="text-[10px] bg-[#4ade80]/10 text-[#4ade80] px-1.5 py-0.5 rounded-full flex-shrink-0 border border-[#4ade80]/20">
                          已深度学习
                        </span>
                      )}
                      {book.learningStatus === 'learning' && (
                        <span className="text-[10px] bg-[#d4a853]/10 text-[#d4a853] px-1.5 py-0.5 rounded-full flex-shrink-0 border border-[#d4a853]/20 animate-pulse">
                          深度学习中
                        </span>
                      )}
                      {book.learningStatus === 'pending' && (
                        <span className="text-[10px] bg-[#5a5a6e]/10 text-[#5a5a6e] px-1.5 py-0.5 rounded-full flex-shrink-0 border border-[#5a5a6e]/20">
                          待学习
                        </span>
                      )}
                      {book.hasMissingChapters && (
                        <span className="text-[10px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-amber-700/30">
                          缺章节 {book.currentChapter}/{book.totalChapters}{book.chapterStructure}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] bg-[#0a0a0f] text-[#8a8070] px-2 py-0.5 rounded-full">
                        {book.category}
                      </span>
                      {book.charCount > 0 && (
                        <span className="text-[10px] text-[#5a5a6e]">
                          {formatChars(book.charCount)}字
                        </span>
                      )}
                    </div>
                    {/* 学习进度条 */}
                    {book.learningStatus !== 'pending' && (
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[9px] text-[#8a8070] mb-0.5">
                          <span>{book.learningStatus === 'done' ? '深度学习完成' : (book.learningMessage || 'AI深度学习中...')}</span>
                          <span>{book.learningTotalChunks > 0 ? `${book.learningCurrentChunk}/${book.learningTotalChunks}块` : `${book.learningProgress}%`}</span>
                        </div>
                        <div className="h-1 bg-[#0a0a0f] rounded-full overflow-hidden relative">
                          <div 
                            className={`h-full rounded-full transition-all duration-700 ${
                              book.learningStatus === 'done' 
                                ? 'bg-gradient-to-r from-[#4ade80] to-[#22c55e]' 
                                : 'bg-gradient-to-r from-[#d4a853] to-[#f59e0b]'
                            }`}
                            style={{ width: `${book.learningProgress}%` }}
                          />
                          {book.learningStatus === 'learning' && book.learningProgress > 0 && (
                            <div
                              className="absolute top-0 left-0 h-full rounded-full opacity-50"
                              style={{
                                width: `${book.learningProgress}%`,
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
                      </div>
                    )}
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
    </div>
  );
}
