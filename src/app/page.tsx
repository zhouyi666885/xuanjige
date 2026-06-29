'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { CameraCapture } from '@/components/camera-capture';

// [MOD] ChatInterface 改为纯客户端动态导入，避免 SSR 重挂载时露出首页那一帧
const ChatInterface = dynamic(
  () => import('@/components/chat-interface').then((m) => ({ default: m.ChatInterface })),
  { ssr: false },
);
import { ReadingResult } from '@/components/reading-result';

interface ReadingState {
  type: 'face' | 'palm';
  image: string;
  mode: 'casual' | 'professional';
}

export default function Home() {
  const [faceCameraOpen, setFaceCameraOpen] = useState(false);
  const [palmCameraOpen, setPalmCameraOpen] = useState(false);
  // [MOD] chatOpen 用 lazy init 直接从 localStorage / URL hash 三重读取
  //       彻底消除 React 重挂载时 "chatOpen=false → 露出首页那一帧" 的 bug
  //       【微信兼容】优先读 URL hash（即使 localStorage 被微信清空，hash 也保留）
  const [chatOpen, setChatOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      // 微信兼容：URL hash 是最稳的持久化通道
      if (window.location.hash === '#chat') return true;
      const raw = localStorage.getItem('xuanjige_chatOpen');
      if (raw) {
        const parsed = JSON.parse(raw) as { v: '1'; t: number } | null;
        if (parsed && parsed.v === '1' && Date.now() - parsed.t < 24 * 60 * 60 * 1000) {
          return true;
        }
      }
      // 兼容历史 sessionStorage 数据
      if (sessionStorage.getItem('xuanjige_chatOpen') === '1') return true;
    } catch {
      // ignore
    }
    return false;
  });
  const [reading, setReading] = useState<ReadingState | null>(null);
  const [readingMode, setReadingMode] = useState<'casual' | 'professional'>('casual');
  // 🛡 标记是否已完成首次从 localStorage 的"恢复"（避免初始 false 把已存的 '1' 覆盖掉）
  const hydratedRef = useRef(false);

  // 兼容历史 sessionStorage 数据 + 标记 hydration 完成
  useEffect(() => {
    try {
      const legacy = sessionStorage.getItem('xuanjige_chatOpen');
      if (legacy === '1') {
        localStorage.setItem('xuanjige_chatOpen', JSON.stringify({ v: '1', t: Date.now() }));
        sessionStorage.removeItem('xuanjige_chatOpen');
      }
    } catch {
      // ignore
    }
    hydratedRef.current = true;
  }, []);
  // chatOpen 变化时同步到 localStorage + URL hash（恢复完成前禁止写入，避免初始 false 覆盖已存的 '1'）
  useEffect(() => {
    if (!hydratedRef.current) return; // 🚨 关键：首次恢复未完成前禁止写入
    try {
      if (chatOpen) {
        localStorage.setItem('xuanjige_chatOpen', JSON.stringify({ v: '1', t: Date.now() }));
        // 【微信兼容】同步写入 URL hash，微信即使清空 localStorage 也能从 URL 恢复
        if (window.location.hash !== '#chat') {
          history.replaceState(null, '', '#chat');
        }
      } else {
        localStorage.removeItem('xuanjige_chatOpen');
        if (window.location.hash === '#chat') {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    } catch {
      // ignore
    }
  }, [chatOpen]);

  // 【微信兼容】页面从后台切回前台 / bfcache 恢复 / 路由 hash 变化时，重新校验 chatOpen 状态
  useEffect(() => {
    const restore = () => {
      try {
        if (window.location.hash === '#chat') {
          setChatOpen(true);
          return;
        }
        const raw = localStorage.getItem('xuanjige_chatOpen');
        if (raw) {
          const parsed = JSON.parse(raw) as { v: '1'; t: number } | null;
          if (parsed && parsed.v === '1' && Date.now() - parsed.t < 24 * 60 * 60 * 1000) {
            setChatOpen(true);
          }
        }
      } catch {
        // ignore
      }
    };
    const onVisibility = () => {
      if (!document.hidden) restore();
    };
    const onHashChange = () => {
      // 微信内置浏览器右上角"关闭"或返回手势会改变 hash
      setChatOpen(window.location.hash === '#chat');
    };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', restore);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('focus', restore);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('focus', restore);
    };
  }, []);

  const handleFaceCapture = useCallback((imageData: string) => {
    setReading({ type: 'face', image: imageData, mode: readingMode });
  }, [readingMode]);

  const handlePalmCapture = useCallback((imageData: string) => {
    setReading({ type: 'palm', image: imageData, mode: readingMode });
  }, [readingMode]);

  const handleReadingClose = useCallback(() => {
    setReading(null);
  }, []);

  const divinationTools = [
    { icon: '🔮', name: '八字命理', desc: '四柱八字·子平法', href: '/bazi' },
    { icon: '🎯', name: '六爻占卜', desc: '铜钱摇卦·断事', href: '/liuyao' },
    { icon: '🌸', name: '梅花易数', desc: '万物起卦·心易', href: '/meihua' },
    { icon: '⭐', name: '紫微斗数', desc: '十二宫·星曜', href: '/ziwei' },
    { icon: '🌀', name: '奇门遁甲', desc: '九宫八门·三奇', href: '/qimen' },
    { icon: '🐉', name: '大六壬', desc: '四课三传·金口诀', href: '/liuren' },
    { icon: '🏔️', name: '风水地理', desc: '峦头理气·阳宅', href: '/fengshui' },
    { icon: '✍️', name: '姓名测算', desc: '五格剖象·三才', href: '/xingming' },
  ];



  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section with Camera Buttons */}
      <section className="relative px-4 pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-lg mx-auto text-center">
          <h1 className="font-serif text-3xl font-bold text-gold mb-2 tracking-wide">
            玄机阁
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            万卷玄典 · 知命改运 · 引经据典
          </p>

          {/* Camera Buttons - Most Prominent */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setFaceCameraOpen(true)}
              className="group relative bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold/30 rounded-2xl p-6 transition-all duration-300 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/10 active:scale-95"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">👤</div>
              <h3 className="text-gold font-serif font-bold text-lg">拍面相</h3>
              <p className="text-muted-foreground text-xs mt-1">贵人方位·姻缘应期</p>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-vermilion rounded-full animate-pulse" />
            </button>

            <button
              onClick={() => setPalmCameraOpen(true)}
              className="group relative bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold/30 rounded-2xl p-6 transition-all duration-300 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/10 active:scale-95"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🤚</div>
              <h3 className="text-gold font-serif font-bold text-lg">拍手相</h3>
              <p className="text-muted-foreground text-xs mt-1">结婚年龄·事业高峰</p>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-vermilion rounded-full animate-pulse" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-3 mb-6 text-sm">
            <span className={readingMode === 'casual' ? 'text-gold font-semibold' : 'text-muted-foreground'}>
              白话解读
            </span>
            <button
              onClick={() => setReadingMode(prev => prev === 'casual' ? 'professional' : 'casual')}
              className="relative w-12 h-6 bg-ink rounded-full border border-gold/30 transition-colors"
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-gold transition-all duration-300 ${
                readingMode === 'professional' ? 'left-6' : 'left-0.5'
              }`} />
            </button>
            <span className={readingMode === 'professional' ? 'text-gold font-semibold' : 'text-muted-foreground'}>
              专业解读
            </span>
          </div>

          {/* AI Chat Button */}
          <button
            onClick={() => setChatOpen(true)}
            className="w-full bg-gradient-to-r from-gold/15 via-gold/10 to-gold/15 border border-gold/20 rounded-xl p-4 flex items-center gap-4 hover:border-gold/40 transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              ☯
            </div>
            <div className="text-left flex-1">
              <h3 className="text-gold font-serif font-bold">AI 玄学问答</h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                {readingMode === 'professional'
                  ? '专业引经据典，通晓近20000部典籍'
                  : '白话轻松聊，用大白话讲明白玄学'
                }
              </p>
            </div>
            <span className="text-gold/50 text-xl">›</span>
          </button>
        </div>
      </section>

      {/* Divination Tools - NOW WITH LINK */}
      <section className="px-4 py-6">
        <div className="max-w-lg mx-auto">
          <h2 className="font-serif text-gold text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            术数测算
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {divinationTools.map((tool) => (
              <Link
                key={tool.name}
                href={tool.href}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-gold/10 hover:border-gold/30 hover:bg-gold/5 transition-all duration-300 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">{tool.icon}</span>
                <span className="text-foreground text-xs font-medium">{tool.name}</span>
                <span className="text-muted-foreground text-[10px]">{tool.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Fortune */}
      <section className="px-4 py-6">
        <div className="max-w-lg mx-auto">
          <h2 className="font-serif text-gold text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-vermilion rounded-full" />
            今日宜忌
          </h2>
          <div className="bg-card border border-gold/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gold font-serif font-bold">吉日良辰</span>
              <span className="text-muted-foreground text-xs" suppressHydrationWarning>
                {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <div className="text-emerald-400 text-xs font-semibold mb-1">✦ 宜</div>
                <div className="text-foreground text-xs leading-relaxed">
                  祈福·祭祀·求嗣·开光·纳财
                </div>
              </div>
              <div className="bg-vermilion/10 border border-vermilion/20 rounded-lg p-3">
                <div className="text-vermilion text-xs font-semibold mb-1">✦ 忌</div>
                <div className="text-foreground text-xs leading-relaxed">
                  动土·破土·嫁娶·远行·开仓
                </div>
              </div>
            </div>
            <p className="text-muted-foreground text-[10px] mt-3 text-center">
              「祸福无门，惟人自召」——《太上感应篇》
            </p>
          </div>
        </div>
      </section>

      {/* 书籍管理 */}
      <section className="px-4 py-6 pb-20">
        <div className="max-w-lg mx-auto">
          <h2 className="font-serif text-gold text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            书籍管理
          </h2>
          <div className="space-y-2">
            <Link
              href="/upload-book"
              className="w-full flex items-center gap-4 p-3 bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/20 rounded-xl hover:border-gold/40 hover:bg-gold/10 transition-all duration-300 group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📤</span>
              <div className="flex-1 text-left">
                <span className="text-gold text-sm font-bold">上传书籍</span>
                <span className="text-muted-foreground text-xs ml-2">拖拽 txt/pdf/docx，秒级入库</span>
              </div>
              <span className="text-gold/30 text-sm">›</span>
            </Link>
            <Link
              href="/knowledge-base"
              className="w-full flex items-center gap-4 p-3 bg-gradient-to-r from-[#1a2a4e]/60 to-[#16213e]/40 border border-[#d4a853]/15 rounded-xl hover:border-[#d4a853]/35 hover:bg-[#1a2a4e]/80 transition-all duration-300 group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📚</span>
              <div className="flex-1 text-left">
                <span className="text-[#d4a853] text-sm font-bold">知识库</span>
                <span className="text-muted-foreground text-xs ml-2">查看已收录的全部书籍</span>
              </div>
              <span className="text-[#d4a853]/30 text-sm">›</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom Navigation - NOW WITH LINK */}
      <nav className="fixed bottom-0 left-0 right-0 bg-ink/95 backdrop-blur-md border-t border-gold/10 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          <Link href="/" className="flex flex-col items-center gap-0.5 text-gold py-1 px-4">
            <span className="text-xl">🏠</span>
            <span className="text-[10px] font-medium">首页</span>
          </Link>
          <button
            onClick={() => setChatOpen(true)}
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-gold py-1 px-4 transition-colors"
          >
            <span className="text-xl">💬</span>
            <span className="text-[10px]">问答</span>
          </button>
          <button
            onClick={() => setFaceCameraOpen(true)}
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-gold py-1 px-4 transition-colors"
          >
            <span className="text-xl">📷</span>
            <span className="text-[10px]">拍照</span>
          </button>
          <Link href="/upload-book" className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-gold py-1 px-4 transition-colors">
            <span className="text-xl">📤</span>
            <span className="text-[10px]">上传</span>
          </Link>
        </div>
      </nav>

      {/* Camera Capture Dialogs */}
      <CameraCapture
        open={faceCameraOpen}
        onClose={() => setFaceCameraOpen(false)}
        onCapture={handleFaceCapture}
        title="面相拍照"
        subtitle="正面清晰照，光线充足，勿戴墨镜口罩"
      />
      <CameraCapture
        open={palmCameraOpen}
        onClose={() => setPalmCameraOpen(false)}
        onCapture={handlePalmCapture}
        title="手相拍照"
        subtitle="摊开手掌，掌纹清晰可见，光线均匀"
      />

      {/* Chat Interface */}
      <ChatInterface open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Reading Result */}
      {reading && (
        <ReadingResult
          type={reading.type}
          image={reading.image}
          mode={reading.mode}
          onClose={handleReadingClose}
        />
      )}
    </div>
  );
}
