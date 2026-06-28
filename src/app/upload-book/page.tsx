'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type ResultItem = {
  fileName: string;
  bookName?: string;
  status: 'success' | 'failed' | 'duplicate';
  message: string;
  charCount?: number;
};

export default function UploadBookPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    successCount: number;
    duplicateCount: number;
    failedCount: number;
  } | null>(null);

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
    setResults([]);
    setSummary(null);
  };

  const upload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setResults([]);
    setSummary(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const res = await fetch('/api/upload-book', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '上传失败');
      }

      setResults(data.results || []);
      setSummary({
        total: data.total,
        successCount: data.successCount,
        duplicateCount: data.duplicateCount,
        failedCount: data.failedCount,
      });

      // 全部成功 → 清空已选文件
      if (data.failedCount === 0) {
        setFiles([]);
      } else {
        // 只清掉成功 / 重复的文件
        setFiles((prev) =>
          prev.filter((f) => {
            const r = data.results.find((x: ResultItem) => x.fileName === f.name);
            return r?.status === 'failed';
          }),
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
          <p className="text-xl text-[#d4a853] mb-2 font-bold">
            把书籍文件拖到这里
          </p>
          <p className="text-sm text-[#8a8070] mb-5">
            或点击下方按钮选择文件
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-[#d4a853] bg-[#d4a85322] px-6 py-2.5 font-medium text-[#d4a853] hover:bg-[#d4a85344] transition-colors"
          >
            选择文件
          </button>
          <p className="mt-5 text-xs text-[#8a8070]">
            支持格式：txt / pdf / docx / md（每个文件可达 50MB）
            <br />
            支持批量上传，自动识别书名
          </p>
        </div>

        {/* 已选文件列表 */}
        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[#d4a853] font-bold">
                已选 {files.length} 个文件
              </h2>
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
                    disabled={uploading}
                    className="ml-2 text-[#8a8070] hover:text-[#c0392b] text-lg disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={upload}
              disabled={uploading || files.length === 0}
              className="mt-4 w-full rounded-lg bg-[#d4a853] py-3 font-bold text-[#0a0a0f] hover:bg-[#f0c060] transition-colors disabled:opacity-50"
            >
              {uploading
                ? '⏳ 正在解析入库...（每本书约 1-10 秒）'
                : `📥 开始入库（${files.length} 本）`}
            </button>
          </div>
        )}

        {/* 结果显示 */}
        {summary && (
          <div className="mt-8 rounded-xl border border-[#d4a85355] bg-[#12111a] p-5">
            <h2 className="text-[#d4a853] font-bold text-lg mb-3">📊 入库结果</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-[#16213e] p-3 text-center">
                <div className="text-2xl font-bold text-[#52c41a]">{summary.successCount}</div>
                <div className="text-xs text-[#8a8070]">成功入库</div>
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

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((r, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 text-sm ${
                    r.status === 'success'
                      ? 'border-[#52c41a55] bg-[#52c41a11]'
                      : r.status === 'duplicate'
                        ? 'border-[#faad1455] bg-[#faad1411]'
                        : 'border-[#c0392b55] bg-[#c0392b11]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>
                      {r.status === 'success' ? '✅' : r.status === 'duplicate' ? '⚠️' : '❌'}
                    </span>
                    <span className="font-medium truncate">{r.fileName}</span>
                  </div>
                  <p className="text-xs text-[#8a8070] ml-6">{r.message}</p>
                </div>
              ))}
            </div>

            {summary.successCount > 0 && (
              <button
                onClick={() => router.push('/knowledge-base')}
                className="mt-4 w-full rounded-lg bg-[#d4a85322] border border-[#d4a853] py-2.5 text-[#d4a853] hover:bg-[#d4a85344] transition-colors"
              >
                查看知识库 →
              </button>
            )}
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-8 rounded-xl border border-[#d4a85333] bg-[#12111a] p-5">
          <h3 className="text-[#d4a853] font-bold mb-3">💡 使用说明</h3>
          <ul className="space-y-2 text-sm text-[#8a8070]">
            <li>• 一次可上传多本书，自动批量入库</li>
            <li>• 书名自动从文件名识别（如「滴天髓.txt」→《滴天髓》）</li>
            <li>• 支持 txt、pdf、docx、md 格式</li>
            <li>• txt 自动识别 UTF-8/GBK 编码</li>
            <li>• 重复的书会自动跳过（不会覆盖）</li>
            <li>• 入库后立即可在「知识库」查看，可参与全文检索</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
