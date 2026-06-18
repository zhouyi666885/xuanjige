'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { CameraCapture } from '@/components/camera-capture';
import { ChatInterface } from '@/components/chat-interface';
import { ReadingResult } from '@/components/reading-result';

interface ReadingState {
  type: 'face' | 'palm';
  image: string;
  mode: 'casual' | 'professional';
}

export default function Home() {
  const [faceCameraOpen, setFaceCameraOpen] = useState(false);
  const [palmCameraOpen, setPalmCameraOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reading, setReading] = useState<ReadingState | null>(null);
  const [readingMode, setReadingMode] = useState<'casual' | 'professional'>('casual');

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

  const classicCategories = [
    { icon: '📚', name: '全部经典', count: '19055部', href: '/classics' },
    { icon: '📜', name: '易学系统', count: '2270+部', href: '/classics' },
    { icon: '📖', name: '八字命理', count: '1180+部', href: '/classics' },
    { icon: '🌟', name: '紫微斗数', count: '1150+部', href: '/classics' },
    { icon: '🏔️', name: '风水地理', count: '1130+部', href: '/classics' },
    { icon: '🧘', name: '丹道气功', count: '830+部', href: '/classics' },
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
              <p className="text-muted-foreground text-xs mt-1">拍照看面相</p>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-vermilion rounded-full animate-pulse" />
            </button>

            <button
              onClick={() => setPalmCameraOpen(true)}
              className="group relative bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold/30 rounded-2xl p-6 transition-all duration-300 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/10 active:scale-95"
            >
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🤚</div>
              <h3 className="text-gold font-serif font-bold text-lg">拍手相</h3>
              <p className="text-muted-foreground text-xs mt-1">拍照看手相</p>
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
                  ? '专业引经据典，通晓19000部典籍'
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

      {/* Classics Library - NOW WITH LINK */}
      <section className="px-4 py-6 pb-20">
        <div className="max-w-lg mx-auto">
          <h2 className="font-serif text-gold text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            经典书房
          </h2>
          <div className="space-y-2">
            {classicCategories.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="w-full flex items-center gap-4 p-3 bg-card border border-gold/10 rounded-xl hover:border-gold/30 hover:bg-gold/5 transition-all duration-300 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                <div className="flex-1 text-left">
                  <span className="text-foreground text-sm font-medium">{cat.name}</span>
                  <span className="text-muted-foreground text-xs ml-2">{cat.count}</span>
                </div>
                <span className="text-gold/30 text-sm">›</span>
              </Link>
            ))}
            <div className="text-center pt-2">
              <p className="text-muted-foreground text-xs">
                全书共收录 <span className="text-gold font-bold">19,055</span> 部典籍
              </p>
            </div>
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
          <Link href="/classics" className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-gold py-1 px-4 transition-colors">
            <span className="text-xl">📚</span>
            <span className="text-[10px]">书房</span>
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
