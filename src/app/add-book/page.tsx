'use client';

import { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Search, BookOpen, Plus, Check, AlertCircle, Loader2, Library, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface ProgressMessage {
  stage: string;
  message: string;
  bookName?: string;
  source?: string;
  size?: string;
  chars?: number;
  progress?: number;
  total?: number;
  currentChapter?: number;
  totalChapters?: number;
  chapterName?: string;
  currentSource?: string;
  triedSources?: number;
  totalSources?: number;
  translateCurrent?: number;
  translateTotal?: number;
  searchResults?: { title: string; url: string; snippet: string }[];
}

export default function AddBookPage() {
  const [bookName, setBookName] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const [result, setResult] = useState<'idle' | 'exists' | 'success' | 'error' | 'not_found' | 'copyright'>('idle');
  const [latestProgress, setLatestProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddBook = useCallback(async () => {
    if (!bookName.trim() || loading) return;

    setLoading(true);
    setResult('idle');
    setMessages([]);
    setLatestProgress(0);
    setCurrentStage('searching');

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

              // 更新进度
              if (data.progress !== undefined) {
                setLatestProgress(data.progress);
              }
              if (data.stage) {
                setCurrentStage(data.stage);
              }

              if (data.stage === 'done') {
                setResult('success');
                setLatestProgress(100);
              } else if (data.stage === 'error') {
                setResult('error');
              } else if (data.stage === 'copyright') {
                setResult('copyright');
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

  const getStageLabel = (stage: string): string => {
    switch (stage) {
      case 'searching': return '搜索中';
      case 'downloading': return '获取中';
      case 'fetching': return '抓取中';
      case 'translating': return '翻译中';
      case 'saving': return '摘录中';
      case 'done': return '已完成';
      case 'exists': return '已存在';
      case 'error': return '失败';
      case 'copyright': return '版权限制';
      default: return stage;
    }
  };

  const getStageColor = (stage: string): string => {
    switch (stage) {
      case 'searching': return 'text-blue-400';
      case 'downloading':
      case 'fetching': return 'text-cyan-400';
      case 'translating': return 'text-purple-400';
      case 'saving': return 'text-[#d4a853]';
      case 'done': return 'text-emerald-400';
      case 'exists': return 'text-[#d4a853]';
      case 'error': return 'text-red-400';
      case 'copyright': return 'text-amber-400';
      default: return 'text-[#8a8070]';
    }
  };

  const getProgressColor = (): string => {
    if (result === 'success') return 'bg-emerald-500';
    if (result === 'copyright' || result === 'error') return 'bg-red-500';
    if (currentStage === 'translating') return 'bg-purple-500';
    if (currentStage === 'saving') return 'bg-[#d4a853]';
    return 'bg-cyan-500';
  };

  // 获取最后一条消息（用于显示当前状态）
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

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
                placeholder="输入书名，自动搜索并摘录到知识库..."
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
              <span className="hidden sm:inline">{loading ? '摘录中' : '添加'}</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-[#8a8070]">
            输入书名后，系统将全网搜索完整全文，从第一页第一个字到最后一页最后一个字完整摘录入库。外文书籍自动翻译为中文。
          </p>
        </div>

        {/* ===== 进度可视化面板 ===== */}
        {(loading || result !== 'idle') && (
          <div className="mb-6 bg-[#1a1a2e] rounded-xl border border-[#d4a853]/20 overflow-hidden">
            {/* 书名 */}
            <div className="px-4 py-3 border-b border-[#d4a853]/10 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#d4a853]" />
              <span className="text-sm font-bold text-[#d4a853]">《{bookName.trim()}》</span>
              {loading && (
                <span className={`ml-auto text-xs ${getStageColor(currentStage)}`}>
                  {getStageLabel(currentStage)}...
                </span>
              )}
            </div>

            {/* 进度条 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between text-xs text-[#8a8070] mb-1.5">
                <span>{lastMsg?.message || '准备中...'}</span>
                <span>{latestProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#0a0a0f] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                  style={{ width: `${latestProgress}%` }}
                />
              </div>
            </div>

            {/* 章节进度 */}
            {lastMsg?.totalChapters && lastMsg.totalChapters > 0 && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 text-xs text-[#8a8070]">
                  <span>章节: {lastMsg.currentChapter || 0}/{lastMsg.totalChapters}</span>
                  {lastMsg.chapterName && (
                    <span className="text-[#d4a853] truncate">· {lastMsg.chapterName}</span>
                  )}
                </div>
              </div>
            )}

            {/* 翻译进度 */}
            {lastMsg?.translateTotal && lastMsg.translateTotal > 0 && (
              <div className="px-4 pb-3">
                <div className="text-xs text-[#8a8070]">
                  翻译段落: {lastMsg.translateCurrent || 0}/{lastMsg.translateTotal} 
                  {lastMsg.translateTotal > 0 && (
                    <span className="text-purple-400 ml-1">
                      ({Math.round((lastMsg.translateCurrent || 0) / lastMsg.translateTotal * 100)}%)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ===== 完成状态 ===== */}
            {result === 'success' && lastMsg && (
              <div className="px-4 py-4 bg-emerald-900/20 border-t border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-base font-bold text-emerald-400">已进入知识库</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#8a8070]">
                  {lastMsg.size && <span>大小: {lastMsg.size}</span>}
                  {lastMsg.chars && <span>字数: {lastMsg.chars?.toLocaleString()}</span>}
                  {lastMsg.totalChapters && <span>章节: {lastMsg.totalChapters}</span>}
                  {lastMsg.source && <span className="col-span-2 truncate">来源: {lastMsg.source}</span>}
                </div>
              </div>
            )}

            {/* 已存在 */}
            {result === 'exists' && (
              <div className="px-4 py-4 bg-[#d4a853]/10 border-t border-[#d4a853]/20">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#d4a853]" />
                  <span className="text-base font-bold text-[#d4a853]">《{bookName.trim()}》已添加</span>
                </div>
                <p className="text-xs text-[#8a8070] mt-1">该书已在知识库中，无需重复添加</p>
              </div>
            )}

            {/* 版权限制 */}
            {result === 'copyright' && (
              <div className="px-4 py-4 bg-amber-900/20 border-t border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span className="text-base font-bold text-amber-400">因版权问题无法摘录</span>
                </div>
                <p className="text-xs text-[#8a8070]">
                  已搜索所有可访问的公开资源网站，均未找到《{bookName.trim()}》的公开全文内容。
                  该书可能受版权保护，暂无公开电子版本。
                </p>
                {lastMsg?.triedSources && (
                  <p className="text-xs text-[#8a8070] mt-1">已尝试来源数: {lastMsg.triedSources}</p>
                )}
              </div>
            )}

            {/* 错误 */}
            {result === 'error' && lastMsg && (
              <div className="px-4 py-4 bg-red-900/20 border-t border-red-500/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-sm text-red-400">{lastMsg.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 成功后快速添加 */}
        {result === 'success' && (
          <div className="text-center py-2">
            <button
              onClick={() => {
                setBookName('');
                setResult('idle');
                setMessages([]);
                setLatestProgress(0);
                setCurrentStage('');
                inputRef.current?.focus();
              }}
              className="text-[#d4a853] hover:underline text-sm"
            >
              继续添加下一本
            </button>
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-6 p-4 bg-[#1a1a2e]/50 rounded-xl border border-[#d4a853]/10">
          <h3 className="text-sm font-bold text-[#d4a853] mb-3">摘录规则</h3>
          <ul className="space-y-2 text-xs text-[#8a8070]">
            <li className="flex gap-2">
              <span className="text-[#d4a853] shrink-0">1.</span>
              从第一页第一个字到最后一页最后一个字，完整摘录，一字不漏
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853] shrink-0">2.</span>
              摘录过程实时可视化：书名、章节、进度条全程显示
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853] shrink-0">3.</span>
              摘录100%完成后显示「已进入知识库」
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853] shrink-0">4.</span>
              已添加的书会提示「已添加」，无需重复操作
            </li>
            <li className="flex gap-2">
              <span className="text-[#d4a853] shrink-0">5.</span>
              版权判断标准：所有网站都搜遍找不到才显示「因版权问题无法摘录」
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
