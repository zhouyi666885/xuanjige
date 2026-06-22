'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BirthInfoForm } from '@/components/birth-info-form';

interface BirthInfo {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender: 'male' | 'female' | '';
  province: string;
  city: string;
  district: string;
}

interface ReadingResultProps {
  type: 'face' | 'palm';
  image: string;
  mode: 'casual' | 'professional';
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ReadingResult({ type, image, mode, onClose }: ReadingResultProps) {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [birthInfo, setBirthInfo] = useState<BirthInfo | null>(null);
  const [showBirthForm, setShowBirthForm] = useState(true);
  const [started, setStarted] = useState(false);

  // AI问答状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const startReading = useCallback(() => {
    if (!birthInfo || !birthInfo.gender || !birthInfo.year || !birthInfo.month || !birthInfo.day) return;
    setStarted(true);
    setShowBirthForm(false);
    setLoading(true);
    setResult('');
    setError('');
  }, [birthInfo]);

  // 流式获取解读结果
  useEffect(() => {
    if (!started) return;

    const apiUrl = type === 'face' ? '/api/face-reading' : '/api/palm-reading';

    const fetchReading = async () => {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image,
            mode,
            birthInfo: {
              gender: birthInfo!.gender === 'male' ? '男' : '女',
              birthYear: parseInt(birthInfo!.year),
              birthMonth: parseInt(birthInfo!.month),
              birthDay: parseInt(birthInfo!.day),
              birthHour: parseInt(birthInfo!.hour || '12'),
              birthMinute: parseInt(birthInfo!.minute || '0'),
              province: birthInfo!.province,
              city: birthInfo!.city,
              district: birthInfo!.district,
            },
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
                if (parsed.content) {
                  accumulated += parsed.content;
                  setResult(accumulated);
                }
                if (parsed.error) {
                  setError(parsed.error);
                  setLoading(false);
                  return;
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('Reading error:', err);
        setError('解读出错，请稍后再试');
        setLoading(false);
      }
    };

    fetchReading();
  }, [started, type, image, mode, birthInfo]);

  // 结果出来后自动滚动到底部
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  // 聊天自动滚动
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // AI追问
  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          mode,
          birthInfo: birthInfo ? {
            gender: birthInfo.gender === 'male' ? '女' : '男',
            birthYear: parseInt(birthInfo.year),
            birthMonth: parseInt(birthInfo.month),
            birthDay: parseInt(birthInfo.day),
            birthHour: parseInt(birthInfo.hour || '12'),
            birthMinute: parseInt(birthInfo.minute || '0'),
            province: birthInfo.province,
            city: birthInfo.city,
            district: birthInfo.district,
          } : undefined,
          context: result ? `之前的${type === 'face' ? '面相' : '手相'}解读结果：\n${result.slice(0, 2000)}` : undefined,
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
              if (parsed.content) {
                accumulated += parsed.content;
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    newMessages[newMessages.length - 1] = { ...lastMsg, content: accumulated };
                  } else {
                    newMessages.push({ role: 'assistant', content: accumulated });
                  }
                  return newMessages;
                });
              }
            } catch {
              // Skip
            }
          }
        }
      }
      setChatLoading(false);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '抱歉，追问出错，请重试。' }]);
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, mode, birthInfo, type, result]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gold/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-xl">
            {type === 'face' ? '👤' : '🤚'}
          </div>
          <div>
            <h2 className="text-gold font-serif font-bold">
              {type === 'face' ? '面相解读' : '手相解读'}
            </h2>
            <p className="text-muted-foreground text-xs">
              {mode === 'professional' ? '专业引经据典' : '白话轻松解读'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-gold"
        >
          ✕
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Step 1: Birth Info Form */}
        {showBirthForm && !started && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-lg mx-auto">
              {/* Image Preview */}
              <div className="w-32 h-32 mx-auto rounded-2xl overflow-hidden border-2 border-gold/20 mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="拍照" className="w-full h-full object-cover" />
              </div>

              <div className="bg-card border border-gold/10 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-gold">✦</span>
                  <h3 className="text-gold font-serif font-bold text-sm">
                    请输入生辰八字（用于三合参断）
                  </h3>
                </div>
                <p className="text-muted-foreground text-xs mb-4">
                  结合八字+紫微斗数+{type === 'face' ? '面相' : '手相'}三盘合参，预测更精准。
                  时间精确到几点几分，用于真太阳时校准。
                </p>
                <BirthInfoForm
                  value={birthInfo}
                  onChange={setBirthInfo}
                  onConfirm={startReading}
                />
              </div>

              {/* 跳过选项 */}
              <button
                onClick={() => {
                  setStarted(true);
                  setShowBirthForm(false);
                  setLoading(true);
                }}
                className="w-full py-2 text-center text-muted-foreground text-xs hover:text-gold transition-colors"
              >
                不填生辰，仅看{type === 'face' ? '面相' : '手相'} →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Reading Result */}
        {started && !showChat && (
          <div className="flex-1 overflow-y-auto p-4" ref={resultRef}>
            <div className="max-w-lg mx-auto">
              {/* Image Preview - small */}
              <div className="w-20 h-20 mx-auto rounded-xl overflow-hidden border border-gold/20 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="拍照" className="w-full h-full object-cover" />
              </div>

              {/* Loading State */}
              {loading && !result && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4 animate-pulse">☯</div>
                  <p className="text-gold font-serif">正在解读中...</p>
                  <p className="text-muted-foreground text-xs mt-2">
                    {type === 'face'
                      ? '观其五官，察其气色，参以经典...'
                      : '观其掌纹，辨其三线，参以经典...'
                    }
                  </p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">⚠️</div>
                  <p className="text-vermilion">{error}</p>
                  <Button
                    onClick={onClose}
                    className="mt-4 bg-gold text-ink hover:bg-gold/90"
                  >
                    返回
                  </Button>
                </div>
              )}

              {/* Result - 使用稳定的容器避免闪跳 */}
              {result && (
                <div className="bg-card border border-gold/10 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-gold">✦</span>
                    <h3 className="text-gold font-serif font-bold">
                      {type === 'face' ? '面相分析' : '手相分析'}
                      {birthInfo?.gender ? '（三合参断）' : ''}
                    </h3>
                  </div>
                  <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {result}
                    {loading && <span className="inline-block w-1.5 h-4 bg-gold/70 animate-pulse ml-0.5 align-text-bottom" />}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Chat / 追问 */}
        {showChat && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-lg mx-auto">
              {/* 原始结果摘要 */}
              {result && (
                <div className="bg-card/50 border border-gold/10 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gold text-xs">✦</span>
                    <span className="text-gold text-xs font-serif font-bold">
                      {type === 'face' ? '面相分析结果' : '手相分析结果'}
                    </span>
                    <button
                      onClick={() => setShowChat(false)}
                      className="ml-auto text-muted-foreground text-xs hover:text-gold"
                    >
                      返回详情
                    </button>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed line-clamp-4">
                    {result.slice(0, 200)}...
                  </p>
                </div>
              )}

              {/* 聊天消息 */}
              <div className="space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl p-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gold/20 border border-gold/30 text-foreground'
                        : 'bg-card border border-gold/10 text-foreground'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-gold/10 rounded-xl p-3">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gold/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gold/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gold/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      {started && (
        <div className="shrink-0 border-t border-gold/10 bg-background/95 backdrop-blur-md p-3">
          <div className="max-w-lg mx-auto">
            {showChat ? (
              /* 聊天输入框 */
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  placeholder={`追问${type === 'face' ? '面相' : '手相'}相关问题...`}
                  className="flex-1 bg-ink border border-gold/20 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
                  disabled={chatLoading}
                />
                <Button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-gold text-ink hover:bg-gold/90 px-4"
                >
                  发送
                </Button>
              </div>
            ) : (
              /* 结果页操作按钮 */
              <div className="flex gap-2">
                {!loading && result && (
                  <>
                    <Button
                      onClick={() => setShowChat(true)}
                      className="flex-1 bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
                    >
                      💬 AI追问
                    </Button>
                    <Button
                      onClick={onClose}
                      variant="outline"
                      className="flex-1 border-gold/30 text-gold hover:bg-gold/10"
                    >
                      返回首页
                    </Button>
                  </>
                )}
                {loading && (
                  <div className="text-center w-full text-muted-foreground text-xs">
                    正在解读中，请稍候...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
