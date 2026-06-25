'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

// ========== 进度状态类型 ==========
interface ProgressInfo {
  stage: string;
  message: string;
  bookName: string;
  progress: number;
  total: number;
  // 摘录进度
  currentChapter: string;
  chaptersDone: number;
  totalChapters: number;
  remainingChapters: number;
  // 翻译进度
  translateCurrent: number;
  translateTotal: number;
  // 预估
  elapsedSeconds: number;
  estimatedRemaining: string;
  // 搜索
  sourcesFound: number;
  currentSource: string;
  sourceTried: number;
  totalSources: number;
}

// ========== 书籍列表项 ==========
interface BookItem {
  name: string;
  status: 'transcribing' | 'completed' | 'exists' | 'copyright' | 'error';
  progress: ProgressInfo | null;
  completedAt: string | null;
  totalChapters: number;
  totalChars: number;
  errorMessage: string | null;
}

const defaultProgress: ProgressInfo = {
  stage: '', message: '', bookName: '', progress: 0, total: 100,
  currentChapter: '', chaptersDone: 0, totalChapters: 0, remainingChapters: 0,
  translateCurrent: 0, translateTotal: 0,
  elapsedSeconds: 0, estimatedRemaining: '',
  sourcesFound: 0, currentSource: '', sourceTried: 0, totalSources: 0,
};

// ========== 格式化时间 ==========
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
}

// ========== 阶段图标 ==========
function StageIcon({ stage }: { stage: string }) {
  if (stage === 'done') return <span className="text-green-400 text-xl">✓</span>;
  if (stage === 'error' || stage === 'copyright') return <span className="text-red-400 text-xl">✗</span>;
  return <span className="text-yellow-400 animate-spin inline-block">◆</span>;
}

// ========== 进度条组件 ==========
function ProgressBar({ progress, total, stage }: { progress: number; total: number; stage: string }) {
  const pct = total > 0 ? Math.min(Math.round((progress / total) * 100), 100) : 0;
  const barColor = stage === 'done' ? 'bg-green-500' : stage === 'translating' ? 'bg-blue-500' : 'bg-yellow-500';
  return (
    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ========== 主页面 ==========
export default function AddBookPage() {
  const [bookName, setBookName] = useState('');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 添加书籍
  const handleAdd = useCallback(async () => {
    const name = bookName.trim();
    if (!name || isAdding) return;

    setIsAdding(true);
    const newBook: BookItem = {
      name,
      status: 'transcribing',
      progress: { ...defaultProgress, bookName: name, stage: 'searching', message: '正在搜索...' },
      completedAt: null,
      totalChapters: 0,
      totalChars: 0,
      errorMessage: null,
    };
    setBooks(prev => [newBook, ...prev]);
    setBookName('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/add-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookName: name }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('请求失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            setBooks(prev => prev.map(b => {
              if (b.name !== name) return b;

              if (data.stage === 'done') {
                return {
                  ...b,
                  status: 'completed',
                  progress: { ...b.progress!, ...data, stage: 'done' },
                  completedAt: new Date().toLocaleString(),
                  totalChapters: data.totalChapters || b.progress?.totalChapters || 0,
                  totalChars: data.chars || 0,
                };
              }

              if (data.stage === 'error') {
                return {
                  ...b,
                  status: 'error',
                  errorMessage: data.message || '未知错误',
                  progress: { ...b.progress!, ...data },
                };
              }

              if (data.stage === 'copyright') {
                return {
                  ...b,
                  status: 'copyright',
                  errorMessage: data.message || '因版权问题无法摘录',
                  progress: { ...b.progress!, ...data },
                };
              }

              if (data.stage === 'exists') {
                return {
                  ...b,
                  status: 'exists',
                  completedAt: new Date().toLocaleString(),
                  progress: { ...b.progress!, ...data, stage: 'exists' },
                };
              }

              return {
                ...b,
                progress: { ...b.progress!, ...data },
              };
            }));
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户主动取消
        setBooks(prev => prev.map(b =>
          b.name === name ? { ...b, status: 'error', errorMessage: '已取消摘录' } : b
        ));
      } else {
        setBooks(prev => prev.map(b =>
          b.name === name ? { ...b, status: 'error', errorMessage: '请求失败，请重试' } : b
        ));
      }
    } finally {
      setIsAdding(false);
      abortRef.current = null;
    }
  }, [bookName, isAdding]);

  // 取消摘录
  const handleCancel = useCallback((name: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setBooks(prev => prev.map(b =>
      b.name === name ? { ...b, status: 'error', errorMessage: '已取消摘录' } : b
    ));
  }, []);

  // 删除书籍（从知识库移除）
  const handleDelete = useCallback(async (name: string) => {
    try {
      await fetch('/api/add-book', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookName: name }),
      });
    } catch {
      // 即使API调用失败也从列表移除
    }
    setBooks(prev => prev.filter(b => b.name !== name));
  }, []);

  // 热门推荐
  const hotBooks = ['易经', '黄帝内经', '山海经', '鬼谷子', '金刚经', '心经', '六祖坛经', '楞严经', '滴天髓', '穷通宝鉴'];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e0d0]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#d4a853]/20 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/" className="text-[#8a8070] hover:text-[#d4a853] transition-colors">
            ← 返回
          </Link>
          <h1 className="text-lg font-bold text-[#d4a853] flex-1 text-center">添加书籍</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 输入区域 */}
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#d4a853]/20">
          <div className="flex gap-2">
            <input
              type="text"
              value={bookName}
              onChange={e => setBookName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="输入书名，自动搜索添加..."
              disabled={isAdding}
              className="flex-1 bg-[#0a0a0f] border border-[#d4a853]/30 rounded-lg px-4 py-3 text-[#e8e0d0] placeholder-[#8a8070]/50 focus:outline-none focus:border-[#d4a853] disabled:opacity-50"
            />
            <button
              onClick={handleAdd}
              disabled={isAdding || !bookName.trim()}
              className="bg-[#d4a853] text-[#0a0a0f] font-bold px-5 py-3 rounded-lg hover:bg-[#e8c06a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isAdding ? '添加中...' : '添加'}
            </button>
          </div>

          {/* 使用说明 */}
          <p className="text-xs text-[#8a8070] mt-3 leading-relaxed">
            输入书名后，系统自动在全网搜索书籍全文并录入知识库。
            从第一页第一个字到最后一页最后一个字完整摘录，一个字都不会少。
            摘录过程中和完成后均可随时删除。
          </p>
        </div>

        {/* 热门推荐 */}
        {!isAdding && books.length === 0 && (
          <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#d4a853]/20">
            <h3 className="text-sm font-bold text-[#d4a853] mb-3">热门推荐</h3>
            <div className="flex flex-wrap gap-2">
              {hotBooks.map(name => (
                <button
                  key={name}
                  onClick={() => { setBookName(name); }}
                  className="bg-[#0a0a0f] border border-[#d4a853]/20 text-[#e8e0d0] text-sm px-3 py-1.5 rounded-lg hover:border-[#d4a853] hover:text-[#d4a853] transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 书籍列表 */}
        {books.length > 0 && (
          <div className="space-y-3">
            {books.map(book => (
              <BookCard
                key={book.name}
                book={book}
                onCancel={handleCancel}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== 书籍卡片组件 ==========
function BookCard({
  book,
  onCancel,
  onDelete,
}: {
  book: BookItem;
  onCancel: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const isTranscribing = book.status === 'transcribing';
  const isCompleted = book.status === 'completed' || book.status === 'exists';
  const isError = book.status === 'error' || book.status === 'copyright';
  const p = book.progress;

  return (
    <div className={`bg-[#1a1a2e] rounded-xl p-4 border ${
      isCompleted ? 'border-green-500/30' : isError ? 'border-red-500/30' : 'border-[#d4a853]/30'
    }`}>
      {/* 书名 + 状态 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <StageIcon stage={isCompleted ? 'done' : isError ? 'error' : 'transcribing'} />
          <h3 className="font-bold text-[#d4a853] truncate">《{book.name}》</h3>
        </div>
        {/* 删除/取消按钮 */}
        {isTranscribing ? (
          <button
            onClick={() => onCancel(book.name)}
            className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded hover:bg-red-400/10 transition-colors whitespace-nowrap"
          >
            取消
          </button>
        ) : (
          <button
            onClick={() => onDelete(book.name)}
            className="text-xs text-[#8a8070] border border-[#8a8070]/30 px-2 py-1 rounded hover:text-red-400 hover:border-red-400/30 transition-colors whitespace-nowrap"
          >
            删除
          </button>
        )}
      </div>

      {/* 已完成状态 */}
      {isCompleted && (
        <div className="mt-3 space-y-1">
          <div className="text-green-400 font-bold text-lg">已进入知识库</div>
          {book.totalChars > 0 && (
            <div className="text-xs text-[#8a8070]">
              共 {book.totalChapters} 章 · {book.totalChars.toLocaleString()} 字
              {p?.elapsedSeconds ? ` · 耗时 ${formatDuration(p.elapsedSeconds)}` : ''}
            </div>
          )}
        </div>
      )}

      {/* 已存在 */}
      {book.status === 'exists' && (
        <div className="mt-2 text-yellow-400 text-sm">已添加 — 此书已在知识库中</div>
      )}

      {/* 错误/版权 */}
      {isError && (
        <div className="mt-2 space-y-1">
          <div className={`text-sm ${book.status === 'copyright' ? 'text-yellow-400' : 'text-red-400'}`}>
            {book.errorMessage || '摘录失败'}
          </div>
          {p?.totalSources && p.totalSources > 0 && (
            <div className="text-xs text-[#8a8070]">
              已遍历 {p.totalSources} 个来源网站
            </div>
          )}
        </div>
      )}

      {/* 摘录中 — 进度可视化 */}
      {isTranscribing && p && (
        <div className="mt-3 space-y-2">
          {/* 进度条 */}
          <ProgressBar progress={p.progress} total={p.total} stage={p.stage} />

          {/* 章节进度 */}
          {p.totalChapters > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[#d4a853]">
                  第 {p.chaptersDone}/{p.totalChapters} 章
                </span>
                <span className="text-[#8a8070]">
                  剩余 {p.remainingChapters} 章
                </span>
              </div>
              {/* 章节进度条 */}
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-[#d4a853] rounded-full transition-all duration-300"
                  style={{ width: `${p.totalChapters > 0 ? Math.round((p.chaptersDone / p.totalChapters) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* 当前章节名称 */}
          {p.currentChapter && (
            <div className="text-xs text-[#e8e0d0]/80 truncate">
              正在摘录: {p.currentChapter}
            </div>
          )}

          {/* 翻译进度 */}
          {p.translateTotal > 0 && (
            <div className="text-xs text-blue-400">
              翻译进度: {p.translateCurrent}/{p.translateTotal} 段
              ({p.translateTotal > 0 ? Math.round(p.translateCurrent / p.translateTotal * 100) : 0}%)
            </div>
          )}

          {/* 搜索/下载进度 */}
          {p.stage === 'searching' && (
            <div className="text-xs text-[#8a8070]">
              {p.sourcesFound > 0 ? `找到 ${p.sourcesFound} 个来源` : '正在全网搜索...'}
            </div>
          )}
          {p.stage === 'fetching' && p.totalSources > 0 && (
            <div className="text-xs text-[#8a8070]">
              尝试来源 {p.sourceTried}/{p.totalSources}
            </div>
          )}

          {/* 预估剩余时间 */}
          {p.estimatedRemaining && p.stage === 'saving' && (
            <div className="text-xs text-[#8a8070]">
              预计剩余 {p.estimatedRemaining}
            </div>
          )}

          {/* 百分比 */}
          <div className="text-right text-xs text-[#8a8070]">
            {p.total > 0 ? Math.round(p.progress / p.total * 100) : 0}%
          </div>
        </div>
      )}
    </div>
  );
}
