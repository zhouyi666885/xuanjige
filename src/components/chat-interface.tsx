'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

    // Add empty assistant message for streaming
    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          mode,
          history: messages.slice(-10),
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
    }
  }, [input, loading, messages, mode]);

  if (!sheetOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gold/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xl">
            ☯
          </div>
          <div>
            <h2 className="text-gold font-serif font-bold">
              {mode === 'professional' ? '玄学大师' : '小玄'}
            </h2>
            <p className="text-muted-foreground text-xs">
              {mode === 'professional' ? '专业引经据典' : '白话轻松解读'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
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
            className="text-muted-foreground hover:text-gold"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">☯</div>
            <h3 className="text-gold font-serif text-lg mb-2">欢迎咨询</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              我是{mode === 'professional' ? '玄学大师，精通19000部典籍，为你引经据典' : '小玄，读过好多玄学的书，用大白话给你讲明白'}。
              <br />你可以问我任何关于命理、风水、相学、易学的问题。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm">
              {[
                '八字怎么看用神？',
                '今天适合搬家吗？',
                '面相怎么看财运？',
                '紫微斗数是什么？',
              ].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="border-gold/20 text-gold/70 hover:text-gold hover:border-gold/40 text-xs"
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
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gold/10">
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
            placeholder="输入你的问题..."
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
