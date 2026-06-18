'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface DivinationPageProps {
  type: string;
  icon: string;
  title: string;
  subtitle: string;
  placeholder: string;
  systemInfo: string;
  classics: string[];
}

export function DivinationPage({ type, icon, title, subtitle, placeholder, systemInfo, classics }: DivinationPageProps) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'casual' | 'professional'>('casual');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult('');
    setError('');

    try {
      const response = await fetch('/api/divination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input: input.trim(), mode }),
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
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      console.error('Divination error:', err);
      setError('测算出错，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [input, loading, type, mode]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-ink/95 backdrop-blur-md border-b border-gold/10">
        <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
          <Link href="/" className="text-gold/50 hover:text-gold text-lg">←</Link>
          <div className="text-2xl">{icon}</div>
          <div>
            <h1 className="text-gold font-serif font-bold text-lg">{title}</h1>
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className={mode === 'casual' ? 'text-gold font-semibold' : 'text-muted-foreground'}>
            白话解读
          </span>
          <button
            onClick={() => setMode(prev => prev === 'casual' ? 'professional' : 'casual')}
            className="relative w-12 h-6 bg-ink rounded-full border border-gold/30 transition-colors"
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-gold transition-all duration-300 ${
              mode === 'professional' ? 'left-6' : 'left-0.5'
            }`} />
          </button>
          <span className={mode === 'professional' ? 'text-gold font-semibold' : 'text-muted-foreground'}>
            专业解读
          </span>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <Textarea
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] bg-ink border-gold/20 text-foreground placeholder:text-muted-foreground"
            rows={4}
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="w-full bg-gold text-ink hover:bg-gold/90 font-semibold"
            size="lg"
          >
            {loading ? '解读中...' : '✨ 开始解读'}
          </Button>
        </div>

        {/* System Info */}
        <div className="bg-card border border-gold/10 rounded-xl p-4">
          <h3 className="text-gold font-serif text-sm font-bold mb-2">体系介绍</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">{systemInfo}</p>
        </div>

        {/* Result */}
        {(result || error) && (
          <div className="bg-card border border-gold/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gold">✦</span>
              <h3 className="text-gold font-serif font-bold">解读结果</h3>
            </div>
            {error && <p className="text-vermilion text-sm">{error}</p>}
            {result && (
              <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {result}
                {loading && <span className="typewriter-cursor" />}
              </div>
            )}
          </div>
        )}

        {/* Related Classics */}
        <div className="bg-card border border-gold/10 rounded-xl p-4">
          <h3 className="text-gold font-serif text-sm font-bold mb-3">相关经典</h3>
          <div className="space-y-2">
            {classics.map((c, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-gold/50 mt-0.5">◆</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
