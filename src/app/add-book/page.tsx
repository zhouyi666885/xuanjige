'use client';

import { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Search, BookOpen, Plus, Check, AlertCircle, Loader2, Library } from 'lucide-react';
import Link from 'next/link';

interface ProgressMessage {
  stage: string;
  message: string;
  bookName?: string;
  source?: string;
  size?: string;
  chars?: number;
  searchResults?: { title: string; url: string; snippet: string }[];
}

export default function AddBookPage() {
  const [bookName, setBookName] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const [result, setResult] = useState<'idle' | 'exists' | 'success' | 'error' | 'not_found'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddBook = useCallback(async () => {
    if (!bookName.trim() || loading) return;

    setLoading(true);
    setResult('idle');
    setMessages([]);

    try {
      const response = await fetch('/api/add-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookName: bookName.trim() }),
      });

      // 检查是否直接返回 JSON（已存在的情况）
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.status === 'exists') {
          setResult('exists');
          setMessages([{ stage: 'exists', message: data.message }]);
        } else {
          setResult('error');
          setMessages([{ stage: 'error', message: data.error || '未知错误' }]);
        }
        setLoading(false);
        return;
      }

      // SSE 流式处理
      const reader = response.body?.getReader();
      if (!reader) {
        setResult('error');
        setMessages([{ stage: 'error', message: '无法读取响应流' }]);
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: ProgressMessage = JSON.parse(line.slice(6));
              setMessages(prev => [...prev, data]);

              if (data.stage === 'done') {
                setResult('success');
              } else if (data.stage === 'error' || data.stage === 'not_found') {
                setResult(data.stage as 'error' | 'not_found');
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setResult('error');
      setMessages([{ stage: 'error', message: `请求失败: ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  }, [bookName, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleAddBook();
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'searching': return <Search className="w-4 h-4 text-[#d4a853] animate-pulse" />;
      case 'downloading': return <Loader2 className="w-4 h-4 text-[#d4a853] animate-spin" />;
      case 'fetching': return <Loader2 className="w-4 h-4 text-[#d4a853] animate-spin" />;
      case 'translating': return <Loader2 className="w-4 h-4 text-[#d4a853] animate-spin" />;
      case 'saving': return <BookOpen className="w-4 h-4 text-[#d4a853] animate-pulse" />;
      case 'done': return <Check className="w-4 h-4 text-emerald-400" />;
      case 'exists': return <Check className="w-4 h-4 text-[#d4a853]" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'not_found': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default: return <Loader2 className="w-4 h-4 text-[#d4a853] animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e0d0]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-[#d4a853]/20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-[#1a1a2e] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#d4a853]" />
          </Link>
          <Library className="w-5 h-5 text-[#d4a853]" />
          <h1 className="text-lg font-bold text-[#d4a853]">添加书籍</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* 搜索框 */}
        <div className="relative mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8a8070]" />
              <input
                ref={inputRef}
                type="text"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入书名，自动搜索并添加到知识库..."
                disabled={loading}
                className="w-full pl-11 pr-4 py-3 bg-[#1a1a2e] border border-[#d4a853]/30 rounded-xl text-[#e8e0d0] placeholder-[#8a8070]/60 focus:outline-none focus:border-[#d4a853] focus:ring-1 focus:ring-[#d4a853]/30 transition-all disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleAddBook}
              disabled={loading || !bookName.trim()}
              className="px-6 py-3 bg-[#d4a853] text-[#0a0a0f] font-bold rounded-xl hover:bg-[#e5b860] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">{loading ? '添加中' : '添加'}</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-[#8a8070]">
            输入书名后，系统将自动搜索公开资源库，获取全文并添加到知识库。外文书籍会自动翻译为中文。
          </p>
        </div>

        {/* 进度消息 */}
        {messages.length > 0 && (
          <div className="space-y-2 mb-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  msg.stage === 'done'
                    ? 'bg-emerald-900/20 border-emerald-500/30'
                    : msg.stage === 'error'
                    ? 'bg-red-900/20 border-red-500/30'
                    : msg.stage === 'exists'
                    ? 'bg-[#d4a853]/10 border-[#d4a853]/30'
                    : msg.stage === 'not_found'
                    ? 'bg-amber-900/20 border-amber-500/30'
                    : 'bg-[#1a1a2e] border-[#d4a853]/20'
                }`}
              >
                {getStageIcon(msg.stage)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#e8e0d0]">{msg.message}</p>
                  {msg.stage === 'done' && msg.source && (
                    <p className="text-xs text-[#8a8070] mt-1">来源: {msg.source}</p>
                  )}
                  {msg.stage === 'done' && msg.size && (
                    <p className="text-xs text-[#8a8070]">大小: {msg.size} | 字数: {msg.chars?.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 成功后快速添加 */}
        {result === 'success' && (
          <div className="text-center py-4">
            <button
              onClick={() => {
                setBookName('');
                setResult('idle');
                setMessages([]);
                inputRef.current?.focus();
              }}
              className="text-[#d4a853] hover:underline text-sm"
            >
              继续添加下一本
            </button>
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-8 p-4 bg-[#1a1a2e]/50 rounded-xl border border-[#d4a853]/10">
          <h3 className="text-sm font-bold text-[#d4a853] mb-3">使用说明</h3>
          <ul className="space-y-2 text-xs text-[#8a8070]">
            <li className="flex gap-2">
              <span className="text-[#d4a853]">1.</span>
              输入你想要添加的书名，如「道德经」「易经」「The Art of War」
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853]">2.</span>
              系统会自动在公开资源库中搜索该书的完整全文
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853]">3.</span>
              如果原文是外文，会自动翻译为中文后入库
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853]">4.</span>
              如果该书已在知识库中，会提示「已添加」
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853]">5.</span>
              添加成功后，书籍内容立即可被AI问答检索引用
            </li>
          </ul>
        </div>

        {/* 热门推荐 */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[#d4a853] mb-3">热门推荐</h3>
          <div className="flex flex-wrap gap-2">
            {['道德经', '论语', '孙子兵法', '黄帝内经', '周易', '庄子', '山海经', '金刚经', '心经', '六祖坛经', '滴天髓', '子平真诠', '穷通宝鉴', '三命通会', '渊海子平'].map(name => (
              <button
                key={name}
                onClick={() => { setBookName(name); inputRef.current?.focus(); }}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-[#1a1a2e] border border-[#d4a853]/20 rounded-lg text-[#e8e0d0] hover:border-[#d4a853]/50 hover:bg-[#16213e] transition-all disabled:opacity-50"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
