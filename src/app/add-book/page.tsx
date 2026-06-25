'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Search, BookOpen, Plus, Check, AlertCircle, Loader2, Library, ShieldCheck, Clock, Layers, Hash } from 'lucide-react';
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
  remainingChapters?: number;
  elapsedSeconds?: number;
  estimatedRemaining?: string;
  searchResults?: { title: string; url: string; snippet: string }[];
}

export default function AddBookPage() {
  const [bookName, setBookName] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const [result, setResult] = useState<'idle' | 'exists' | 'success' | 'error' | 'not_found' | 'copyright'>('idle');
  const [latestProgress, setLatestProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [chapterHistory, setChapterHistory] = useState<{name: string; index: number}[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // 计时器
  useEffect(() => {
    if (loading && !timerRef.current) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    if (!loading && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
  };

  const estimateRemaining = (progress: number, elapsed: number): string => {
    if (progress <= 0 || progress >= 100) return '';
    const rate = progress / elapsed;
    const remaining = Math.round((100 - progress) / rate);
    return formatTime(remaining);
  };

  const handleAddBook = useCallback(async () => {
    if (!bookName.trim() || loading) return;

    setLoading(true);
    setResult('idle');
    setMessages([]);
    setLatestProgress(0);
    setCurrentStage('searching');
    setElapsedTime(0);
    setChapterHistory([]);

    try {
      const response = await fetch('/api/add-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookName: bookName.trim() }),
      });

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

              if (data.progress !== undefined) {
                setLatestProgress(data.progress);
              }
              if (data.stage) {
                setCurrentStage(data.stage);
              }

              // 记录已完成的章节
              if (data.stage === 'saving' && data.chapterName && data.currentChapter) {
                setChapterHistory(prev => {
                  if (prev.length > 0 && prev[prev.length - 1].index === data.currentChapter) return prev;
                  return [...prev, { name: data.chapterName || '', index: data.currentChapter || 0 }];
                });
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
              // ignore parse errors
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
      case 'error': '失败';
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

  const getStageIcon = () => {
    switch (currentStage) {
      case 'searching': return <Search className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'downloading':
      case 'fetching': return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'translating': return <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />;
      case 'saving': return <BookOpen className="w-4 h-4 text-[#d4a853] animate-pulse" />;
      case 'done': return <Check className="w-4 h-4 text-emerald-400" />;
      default: return <Loader2 className="w-4 h-4 text-[#8a8070] animate-spin" />;
    }
  };

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const remaining = lastMsg?.totalChapters && lastMsg?.currentChapter
    ? lastMsg.totalChapters - lastMsg.currentChapter
    : null;
  const eta = loading && latestProgress > 0 && elapsedTime > 2
    ? estimateRemaining(latestProgress, elapsedTime)
    : null;

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
            输入书名后，系统将全网搜索完整全文，从第一页第一个字到最后一页最后一个字完整摘录入库
          </p>
        </div>

        {/* ===== 进度可视化面板 ===== */}
        {(loading || result !== 'idle') && (
          <div className="mb-6 bg-[#1a1a2e] rounded-xl border border-[#d4a853]/20 overflow-hidden">
            {/* 书名 + 当前状态 */}
            <div className="px-4 py-3 border-b border-[#d4a853]/10 flex items-center gap-2">
              {getStageIcon()}
              <span className="text-sm font-bold text-[#d4a853]">《{bookName.trim()}》</span>
              {loading && (
                <span className={`ml-auto text-xs ${getStageColor(currentStage)}`}>
                  {getStageLabel(currentStage)}...
                </span>
              )}
            </div>

            {/* 当前状态描述 */}
            <div className="px-4 py-3 border-b border-[#d4a853]/5">
              <p className="text-sm text-[#e8e0d0]/80">{lastMsg?.message || '准备中...'}</p>
            </div>

            {/* 进度条 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#8a8070]">
                  {currentStage === 'searching' && '搜索进度'}
                  {currentStage === 'downloading' && '获取进度'}
                  {currentStage === 'fetching' && '抓取进度'}
                  {currentStage === 'translating' && '翻译进度'}
                  {currentStage === 'saving' && '摘录进度'}
                  {currentStage === 'done' && '完成'}
                  {!['searching','downloading','fetching','translating','saving','done'].includes(currentStage) && '进度'}
                </span>
                <span className={`font-mono font-bold ${latestProgress >= 100 ? 'text-emerald-400' : 'text-[#d4a853]'}`}>
                  {latestProgress}%
                </span>
              </div>
              <div className="w-full h-3 bg-[#0a0a0f] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressColor()} ${loading ? 'animate-pulse' : ''}`}
                  style={{ width: `${Math.max(latestProgress, 0)}%` }}
                />
              </div>
            </div>

            {/* 统计信息网格 */}
            <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 已用时间 */}
              <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                <Clock className="w-3.5 h-3.5 text-[#8a8070] mx-auto mb-1" />
                <div className="text-xs text-[#8a8070]">已用时</div>
                <div className="text-sm font-mono text-[#e8e0d0]">{formatTime(elapsedTime)}</div>
              </div>

              {/* 章节进度 */}
              {lastMsg?.totalChapters && lastMsg.totalChapters > 0 && (
                <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                  <Layers className="w-3.5 h-3.5 text-[#d4a853] mx-auto mb-1" />
                  <div className="text-xs text-[#8a8070]">章节</div>
                  <div className="text-sm font-mono text-[#d4a853]">
                    {lastMsg.currentChapter || 0}/{lastMsg.totalChapters}
                  </div>
                </div>
              )}

              {/* 剩余章节 */}
              {remaining !== null && remaining > 0 && (
                <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                  <Hash className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
                  <div className="text-xs text-[#8a8070]">剩余章节</div>
                  <div className="text-sm font-mono text-cyan-400">{remaining}</div>
                </div>
              )}

              {/* 预计剩余时间 */}
              {eta && (
                <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                  <Clock className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
                  <div className="text-xs text-[#8a8070]">预计剩余</div>
                  <div className="text-sm font-mono text-purple-400">{eta}</div>
                </div>
              )}

              {/* 翻译进度 */}
              {lastMsg?.translateTotal && lastMsg.translateTotal > 0 && (
                <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                  <Hash className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
                  <div className="text-xs text-[#8a8070]">翻译段落</div>
                  <div className="text-sm font-mono text-purple-400">
                    {lastMsg.translateCurrent || 0}/{lastMsg.translateTotal}
                  </div>
                </div>
              )}

              {/* 搜索来源 */}
              {lastMsg?.totalSources && lastMsg.totalSources > 0 && (
                <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                  <Search className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                  <div className="text-xs text-[#8a8070]">已尝试来源</div>
                  <div className="text-sm font-mono text-blue-400">
                    {lastMsg.triedSources || 0}/{lastMsg.totalSources}
                  </div>
                </div>
              )}
            </div>

            {/* 当前章节名称 */}
            {lastMsg?.chapterName && currentStage === 'saving' && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#d4a853]/5 rounded-lg border border-[#d4a853]/10">
                  <BookOpen className="w-3.5 h-3.5 text-[#d4a853] shrink-0" />
                  <span className="text-xs text-[#d4a853] truncate">
                    正在摘录: {lastMsg.chapterName}
                  </span>
                </div>
              </div>
            )}

            {/* ===== 完成状态 ===== */}
            {result === 'success' && lastMsg && (
              <div className="px-4 py-5 bg-emerald-900/20 border-t border-emerald-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">已进入知识库</div>
                    <div className="text-xs text-emerald-400/60">《{bookName.trim()}》完整录入完成</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {lastMsg.size && (
                    <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                      <div className="text-[#8a8070]">大小</div>
                      <div className="text-[#e8e0d0] font-mono">{lastMsg.size}</div>
                    </div>
                  )}
                  {lastMsg.chars && (
                    <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                      <div className="text-[#8a8070]">字数</div>
                      <div className="text-[#e8e0d0] font-mono">{lastMsg.chars?.toLocaleString()}</div>
                    </div>
                  )}
                  {lastMsg.totalChapters && (
                    <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                      <div className="text-[#8a8070]">章节</div>
                      <div className="text-[#e8e0d0] font-mono">{lastMsg.totalChapters}</div>
                    </div>
                  )}
                  <div className="bg-[#0a0a0f]/50 rounded-lg p-2 text-center">
                    <div className="text-[#8a8070]">用时</div>
                    <div className="text-[#e8e0d0] font-mono">{formatTime(elapsedTime)}</div>
                  </div>
                </div>
                {lastMsg.source && (
                  <p className="text-xs text-[#8a8070] mt-2 truncate">来源: {lastMsg.source}</p>
                )}
              </div>
            )}

            {/* 已存在 */}
            {result === 'exists' && (
              <div className="px-4 py-5 bg-[#d4a853]/10 border-t border-[#d4a853]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#d4a853]/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-[#d4a853]" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[#d4a853]">《{bookName.trim()}》已添加</div>
                    <p className="text-xs text-[#8a8070]">该书已在知识库中，无需重复添加</p>
                  </div>
                </div>
              </div>
            )}

            {/* 版权限制 */}
            {result === 'copyright' && (
              <div className="px-4 py-5 bg-amber-900/20 border-t border-amber-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-400">因版权问题无法摘录</div>
                    <p className="text-xs text-amber-400/60">《{bookName.trim()}》</p>
                  </div>
                </div>
                <p className="text-xs text-[#8a8070]">
                  已搜索所有可访问的公开资源网站，均未找到该书的公开全文内容。
                  该书可能受版权保护，暂无公开电子版本。
                </p>
                {lastMsg?.triedSources && (
                  <p className="text-xs text-[#8a8070] mt-1">已尝试来源: {lastMsg.triedSources} 个</p>
                )}
              </div>
            )}

            {/* 错误 */}
            {result === 'error' && lastMsg && (
              <div className="px-4 py-5 bg-red-900/20 border-t border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <div className="text-sm text-red-400">{lastMsg.message}</div>
                  </div>
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
                setElapsedTime(0);
                setChapterHistory([]);
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
              摘录过程全程可视化：书名、章节、进度条、剩余章节、预计时间
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
              版权判断：所有网站都搜遍找不到才显示「因版权问题无法摘录」
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
