'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface BookInfo {
  name: string;
  category: string;
}

interface KnowledgeBaseStats {
  total: number;
  totalChars: number;
  bookCount: number;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [stats, setStats] = useState<KnowledgeBaseStats>({ total: 0, totalChars: 0, bookCount: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingBook, setDeletingBook] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
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
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-[#d4a853]">{stats.bookCount}</p>
              <p className="text-xs text-[#8a8070]">收录书籍</p>
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
                    <h3 className="text-sm text-[#e8e0d0] truncate font-medium">
                      《{book.name}》
                    </h3>
                    <span className="text-[10px] bg-[#0a0a0f] text-[#8a8070] px-2 py-0.5 rounded-full">
                      {book.category}
                    </span>
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
