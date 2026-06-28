'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type FileProgress = {
  fileName: string;
  bookName?: string;
  status: 'queued' | 'processing' | 'success' | 'duplicate' | 'failed';
  message: string;
  percent: number;
  currentChapter?: number;
  totalChapters?: number;
  charCount?: number;
};

type Summary = {
  total: number;
  successCount: number;
  duplicateCount: number;
  failedCount: number;
  totalChars: number;
  totalChapters: number;
};

type SSEEvent = {
  type:
    | 'file-start'
    | 'parse'
    | 'extract'
    | 'chapter-detect'
    | 'learning'
    | 'file-done'
    | 'all-done'
    | 'error';
  fileIndex: number;
  totalFiles: number;
  fileName: string;
  bookName?: string;
  message: string;
  currentChapter?: number;
  totalChapters?: number;
  percent?: number;
  charCount?: number;
  status?: 'success' | 'failed' | 'duplicate';
  summary?: Summary;
};

export default function UploadBookPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progresses, setProgresses] = useState<FileProgress[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [globalStatus, setGlobalStatus] = useState<string>('');

  const onPickFiles = (selected: FileList | null) => {
    if (!selected) return;
    const arr = Array.from(selected);
    setFiles((prev) => [...prev, ...arr]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onPickFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setFiles([]);
    setProgresses([]);
    setSummary(null);
    setGlobalStatus('');
  };

  const upload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setSummary(null);
    setGlobalStatus('📡 已连接服务器，等待开始处理...');

    // 初始化进度列表
    const initial: FileProgress[] = files.map((f) => ({
      fileName: f.name,
      status: 'queued',
      message: '⏳ 排队中...',
      percent: 0,
    }));
    setProgresses(initial);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const res = await fetch('/api/upload-book', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok || !res.body) {
        throw new Error('服务器响应失败');
      }

      const reader = res.body.getReader();
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
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let evt: SSEEvent;
          try {
            evt = JSON.parse(raw) as SSEEvent;
          } catch {
            continue;
          }

          if (evt.type === 'all-done' && evt.summary) {
            setSummary(evt.summary);
            setGlobalStatus(evt.message);
            continue;
          }

          setGlobalStatus(evt.message);

          // 单文件进度更新
          if (evt.fileIndex >= 0 && evt.fileIndex < files.length) {
            setProgresses((prev) => {
              const next = [...prev];
              const cur = next[evt.fileIndex];
              if (!cur) return prev;
              const merged: FileProgress = { ...cur };
              if (evt.bookName) merged.bookName = evt.bookName;
              if (typeof evt.percent === 'number') merged.percent = evt.percent;
              if (typeof evt.currentChapter === 'number') merged.currentChapter = evt.currentChapter;
              if (typeof evt.totalChapters === 'number') merged.totalChapters = evt.totalChapters;
              if (typeof evt.charCount === 'number') merged.charCount = evt.charCount;
              merged.message = evt.message;
              if (evt.type === 'file-start') {
                merged.status = 'processing';
              } else if (evt.type === 'file-done') {
                merged.status = evt.status ?? 'failed';
                merged.percent = 100;
              } else {
                merged.status = 'processing';
              }
              next[evt.fileIndex] = merged;
              return next;
            });
          }
        }
      }
    } catch (e) {
      setGlobalStatus(`❌ ${e instanceof Error ? e.message : '上传失败'}`);
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const statusBadge = (s: FileProgress['status']) => {
    switch (s) {
      case 'success':
        return { emoji: '✅', label: '已学完', color: '#52c41a' };
      case 'duplicate':
        return { emoji: '⚠️', label: '已存在', color: '#faad14' };
      case 'failed':
        return { emoji: '❌', label: '失败', color: '#c0392b' };
      case 'processing':
        return { emoji: '📖', label: '学习中', color: '#d4a853' };
      default:
        return { emoji: '⏳', label: '排队', color: '#8a8070' };
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e0d0]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-20 border-b border-[#d4a85333] bg-[#0a0a0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <button
            onClick={() => router.push('/')}
            className="text-[#d4a853] hover:text-[#f0c060] transition-colors"
          >
            ← 返回首页
          </button>
          <h1 className="text-lg font-bold text-[#d4a853]">📤 上传典籍</h1>
          <Link href="/knowledge-base" className="text-sm text-[#8a8070] hover:text-[#d4a853]">
            知识库
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-4 pb-24">
        {/* 拖拽区 */}
        <div
          className={`relative mt-4 rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            dragOver
              ? 'border-[#d4a853] bg-[#1a1a2e]'
              : 'border-[#d4a85355] bg-[#12111a] hover:border-[#d4a85388]'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <div className="text-6xl mb-3">📚</div>
          <p className="text-xl text-[#d4a853] mb-2 font-bold">把书籍文件拖到这里</p>
          <p className="text-sm text-[#8a8070] mb-5">或点击下方按钮选择文件</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-[#d4a853] bg-[#d4a85322] px-6 py-2.5 font-medium text-[#d4a853] hover:bg-[#d4a85344] transition-colors disabled:opacity-40"
          >
            选择文件
          </button>
          <p className="mt-5 text-xs text-[#8a8070]">
            支持格式：txt / pdf / docx / md（每个文件可达 50MB）
            <br />
            收到文件 → 自动解析全文 → 切分章节 → 逐章学习 → 实时汇报进度
          </p>
        </div>

        {/* 已选文件列表 */}
        {files.length > 0 && !uploading && progresses.length === 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[#d4a853] font-bold">已选 {files.length} 个文件</h2>
              <button
                onClick={clearAll}
                className="text-sm text-[#8a8070] hover:text-[#c0392b]"
              >
                全部清除
              </button>
            </div>
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between rounded-lg border border-[#d4a85333] bg-[#16213e] p-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl">
                      {file.name.endsWith('.pdf')
                        ? '📕'
                        : file.name.endsWith('.docx') || file.name.endsWith('.doc')
                          ? '📘'
                          : '📄'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-[#e8e0d0]">{file.name}</p>
                      <p className="text-xs text-[#8a8070]">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="ml-2 text-[#8a8070] hover:text-[#c0392b] text-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={upload}
              disabled={files.length === 0}
              className="mt-4 w-full rounded-lg bg-[#d4a853] py-3 font-bold text-[#0a0a0f] hover:bg-[#f0c060] transition-colors disabled:opacity-50"
            >
              🚀 开始自动学习（{files.length} 本）
            </button>
          </div>
        )}

        {/* 全局状态 */}
        {(uploading || globalStatus) && (
          <div className="mt-6 rounded-xl border border-[#d4a85355] bg-[#12111a] p-4">
            <div className="flex items-center gap-3">
              {uploading && (
                <span className="text-2xl animate-pulse">☯</span>
              )}
              <p className="text-sm text-[#d4a853] flex-1">{globalStatus}</p>
            </div>
          </div>
        )}

        {/* 学习进度列表 */}
        {progresses.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-[#d4a853] font-bold flex items-center gap-2">
              <span>📚</span>
              <span>学习进度（{progresses.length} 本）</span>
            </h2>
            {progresses.map((p, idx) => {
              const badge = statusBadge(p.status);
              return (
                <div
                  key={`${p.fileName}-${idx}`}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: `${badge.color}55`,
                    background: `${badge.color}0a`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-lg shrink-0">{badge.emoji}</span>
                      <span className="font-medium truncate text-[#e8e0d0]">
                        {p.bookName ? `《${p.bookName}》` : p.fileName}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold shrink-0 px-2 py-0.5 rounded"
                      style={{ background: `${badge.color}22`, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#0a0a0f]">
                    <div
                      className="h-full transition-all duration-200"
                      style={{
                        width: `${p.percent}%`,
                        background:
                          p.status === 'success'
                            ? 'linear-gradient(90deg,#52c41a,#7bd34a)'
                            : p.status === 'failed'
                              ? 'linear-gradient(90deg,#c0392b,#e74c3c)'
                              : p.status === 'duplicate'
                                ? 'linear-gradient(90deg,#faad14,#fdd55a)'
                                : 'linear-gradient(90deg,#d4a853,#f0c060)',
                      }}
                    />
                  </div>

                  {/* 章节计数 */}
                  <div className="mt-2 flex items-center justify-between text-xs text-[#8a8070]">
                    <span>{p.message}</span>
                    <span className="shrink-0 ml-2">
                      {p.currentChapter !== undefined && p.totalChapters !== undefined
                        ? `${p.currentChapter}/${p.totalChapters} · ${p.percent}%`
                        : `${p.percent}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 总结 */}
        {summary && (
          <div className="mt-6 rounded-xl border border-[#d4a85355] bg-[#12111a] p-5">
            <h2 className="text-[#d4a853] font-bold text-lg mb-3">🎉 自动学习完成</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-[#16213e] p-3 text-center">
                <div className="text-2xl font-bold text-[#52c41a]">{summary.successCount}</div>
                <div className="text-xs text-[#8a8070]">已学完</div>
              </div>
              <div className="rounded-lg bg-[#16213e] p-3 text-center">
                <div className="text-2xl font-bold text-[#faad14]">{summary.duplicateCount}</div>
                <div className="text-xs text-[#8a8070]">已存在</div>
              </div>
              <div className="rounded-lg bg-[#16213e] p-3 text-center">
                <div className="text-2xl font-bold text-[#c0392b]">{summary.failedCount}</div>
                <div className="text-xs text-[#8a8070]">失败</div>
              </div>
            </div>
            <div className="rounded-lg bg-[#1a1a2e] p-3 text-sm text-[#e8e0d0] space-y-1">
              <div>📊 累计已学：<span className="text-[#d4a853] font-bold">{summary.totalChars.toLocaleString()}</span> 字</div>
              <div>📖 累计章节：<span className="text-[#d4a853] font-bold">{summary.totalChapters}</span> 章/卦/卷</div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => router.push('/knowledge-base')}
                className="flex-1 rounded-lg bg-[#d4a85322] border border-[#d4a853] py-2.5 text-[#d4a853] hover:bg-[#d4a85344] transition-colors"
              >
                📚 查看知识库
              </button>
              <button
                onClick={clearAll}
                className="flex-1 rounded-lg bg-[#16213e] border border-[#d4a85333] py-2.5 text-[#e8e0d0] hover:border-[#d4a853] transition-colors"
              >
                📤 继续上传
              </button>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-8 rounded-xl border border-[#d4a85333] bg-[#12111a] p-5">
          <h3 className="text-[#d4a853] font-bold mb-3">💡 自动学习流程</h3>
          <ul className="space-y-2 text-sm text-[#8a8070]">
            <li>① 收到文件 → 立即开始，无需手动触发下一步</li>
            <li>② 完整读取：从第一页第一个字到最后一页最后一个字，不漏一段</li>
            <li>③ 原文入库：作为后续 AI 回答的唯一事实依据</li>
            <li>④ 章节切分：自动识别"章/卷/篇/卦/节/回/部"等结构</li>
            <li>⑤ 逐章学习：实时上报「已学 X/Y · NN%」</li>
            <li>⑥ 中途不中断、不等待，全程自动</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
