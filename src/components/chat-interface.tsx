'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BirthInfoForm, type BirthInfo } from '@/components/birth-info-form';
import { PredictionFeedback } from '@/components/prediction-feedback';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  open: boolean;
  onClose: () => void;
}

export function ChatInterface({ open, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'casual' | 'professional'>('casual');
  // 三态：'fast'=🟢 快速 LLM | 'deep'=🔥 深读 Map-Reduce LLM | 'raw'=📚 原文（零成本，不调 LLM）
  const [searchMode, setSearchMode] = useState<'fast' | 'deep' | 'raw'>('raw');
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [birthInfo, setBirthInfoState] = useState<BirthInfo | null>(null);
  const [showBirthForm, setShowBirthForm] = useState(false);

  // 使用 sessionStorage 存储出生信息（退出APP自动清除，不保留使用记录）
  const setBirthInfo = useCallback((info: BirthInfo | null) => {
    setBirthInfoState(info);
    if (info) {
      sessionStorage.setItem('xuanjige_birthInfo', JSON.stringify(info));
    } else {
      sessionStorage.removeItem('xuanjige_birthInfo');
    }
  }, []);

  // 初始化时从 sessionStorage 恢复 birthInfo（仅当次会话有效）
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('xuanjige_birthInfo');
      if (saved) {
        const parsed = JSON.parse(saved) as BirthInfo;
        setBirthInfoState(parsed);
      }
    } catch {
      // 忽略解析错误
    }
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setSheetOpen(open);
  }, [open]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);
    setProgressLabel(
      searchMode === 'raw'
        ? '📚 原文检索中（零成本，不调 LLM）...'
        : searchMode === 'deep'
          ? '🔍 准备翻阅知识库每一本书...'
          : '',
    );

    try {
      const endpoint = searchMode === 'fast' ? '/api/chat' : '/api/chat-deep';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          mode,
          history: messages.slice(-10),
          // noLLM=true 时后端走纯检索；'deep' 时仍调 LLM；'fast' 时走老的 /api/chat 接口
          noLLM: searchMode === 'raw' ? true : undefined,
          birthInfo: birthInfo ? {
            gender: birthInfo.gender === 'male' ? '男' : birthInfo.gender === 'female' ? '女' : '',
            birthYear: parseInt(birthInfo.year) || 0,
            birthMonth: parseInt(birthInfo.month) || 0,
            birthDay: parseInt(birthInfo.day) || 0,
            birthHour: parseInt(birthInfo.hour) || 0,
            birthMinute: parseInt(birthInfo.minute) || 0,
            province: birthInfo.province,
            city: birthInfo.city,
            district: birthInfo.district,
          } : null,
        }),
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              // Map-Reduce 进度事件
              if (parsed.type === 'progress' && typeof parsed.message === 'string') {
                setProgressLabel(parsed.message);
                continue;
              }
              if (parsed.type === 'meta') {
                // 可选展示元信息
                continue;
              }
              if (parsed.type === 'done') {
                setProgressLabel('');
                continue;
              }
              const chunk = parsed.type === 'chunk' ? parsed.content : parsed.content;
              if (typeof chunk === 'string' && chunk.length > 0) {
                accumulated += chunk;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                  return updated;
                });
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: '抱歉，出了点问题，请稍后再试。' };
        return updated;
      });
    } finally {
      setLoading(false);
      setProgressLabel('');
    }
  }, [input, loading, messages, mode, searchMode, birthInfo]);

  if (!sheetOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gold/10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold text-lg">
            ☯
          </div>
          <div>
            <h2 className="text-gold font-serif font-bold text-sm">
              {mode === 'professional' ? '八字紫微大师' : '小玄'}
            </h2>
            <p className="text-muted-foreground text-xs">
              {mode === 'professional' ? '八字命理·紫微斗数·引经据典' : '白话聊八字和紫微'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-md border border-gold/30 bg-background/30 overflow-hidden">
            {([
              { v: 'raw', label: '📚 原文', tip: '零成本，纯检索' },
              { v: 'deep', label: '🔥 深读', tip: '全库精读+LLM' },
              { v: 'fast', label: '🟢 快速', tip: '关键词+LLM' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                title={opt.tip}
                onClick={() => setSearchMode(opt.v)}
                className={`px-2 py-1 text-[11px] transition-colors ${
                  searchMode === opt.v
                    ? 'bg-gold/20 text-gold font-semibold'
                    : 'text-muted-foreground hover:text-gold/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Switch
              id="mode-switch"
              checked={mode === 'professional'}
              onCheckedChange={(checked: boolean) => setMode(checked ? 'professional' : 'casual')}
            />
            <Label htmlFor="mode-switch" className="text-xs text-muted-foreground">
              {mode === 'professional' ? '专业' : '白话'}
            </Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSheetOpen(false); onClose(); }}
            className="text-muted-foreground hover:text-gold h-8 w-8 p-0"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Birth Info Bar */}
      <div className="px-3 py-2 border-b border-gold/5 bg-card/30">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-gold/20 text-gold/70 hover:text-gold hover:border-gold/40 text-xs h-7"
            onClick={() => setShowBirthForm(!showBirthForm)}
          >
            {birthInfo ? '📝 已填生辰' : '✍️ 填写生辰'}
          </Button>
          {birthInfo && (
            <span className="text-xs text-muted-foreground truncate">
              {birthInfo.gender === 'male' ? '男' : birthInfo.gender === 'female' ? '女' : ''} · {birthInfo.year}年{birthInfo.month}月{birthInfo.day}日{birthInfo.hour}时{birthInfo.minute}分 · {birthInfo.province}{birthInfo.city}{birthInfo.district}
            </span>
          )}
          {!birthInfo && (
            <span className="text-xs text-muted-foreground">
              填写生辰后可结合八字紫微命盘分析
            </span>
          )}
        </div>
        {showBirthForm && (
          <div className="mt-2">
            <BirthInfoForm
              value={birthInfo}
              onChange={(info: BirthInfo | null) => {
                setBirthInfo(info);
              }}
              onConfirm={() => setShowBirthForm(false)}
              compact
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-3">☯</div>
            <h3 className="text-gold font-serif text-lg mb-2">八字紫微问答</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-1">
              {mode === 'professional'
                ? '精通八字命理与紫微斗数，依据《渊海子平》《滴天髓》《紫微斗数全书》等经典，引经据典为你详解命盘。'
                : '我用大白话给你讲八字和紫微斗数，先填生辰信息，我就能结合你的命盘来分析啦！'}
            </p>
            <p className="text-gold/50 text-xs">
              填写生辰后，我将结合你的八字四柱与紫微命盘进行个性化分析
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 max-w-sm w-full">
              {[
                '帮我分析一下我的八字格局',
                '我的紫微命盘夫妻宫怎么看？',
                '八字用神是什么？怎么找？',
                '紫微斗数和八字有什么区别？',
              ].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="border-gold/20 text-gold/70 hover:text-gold hover:border-gold/40 text-xs justify-start"
                  onClick={() => setInput(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gold/20 text-foreground'
                  : 'bg-card border border-gold/10 text-foreground'
              }`}
            >
              <div className="whitespace-pre-wrap">
                {msg.content}
                {msg.role === 'assistant' && i === messages.length - 1 && loading && (
                  <span className="typewriter-cursor" />
                )}
              </div>
              {/* Feedback on last assistant message after streaming */}
              {msg.role === 'assistant' && i === messages.length - 1 && !loading && msg.content.length > 50 && (
                <PredictionFeedback
                  divinationType="chat"
                  predictionSummary={msg.content.slice(0, 500)}
                />
              )}
            </div>
          </div>
        ))}
        {loading && progressLabel && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2 text-xs leading-relaxed bg-gold/5 border border-gold/20 text-gold/80 italic">
              {progressLabel}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gold/10">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={birthInfo ? '结合你的命盘来问吧...' : '输入你的八字紫微问题...'}
            className="min-h-[44px] max-h-[120px] bg-ink border-gold/20 text-foreground placeholder:text-muted-foreground resize-none"
            rows={1}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-gold text-ink hover:bg-gold/90 font-semibold shrink-0"
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
