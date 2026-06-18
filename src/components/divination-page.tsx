'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BirthInfoForm, BirthInfo } from '@/components/birth-info-form';
import Link from 'next/link';

interface DivinationPageProps {
  type: string;
  icon: string;
  title: string;
  subtitle: string;
  placeholder: string;
  systemInfo: string;
  classics: string[];
  showBirthForm?: boolean;
}

export function DivinationPage({ type, icon, title, subtitle, placeholder, systemInfo, classics, showBirthForm = false }: DivinationPageProps) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'casual' | 'professional'>('casual');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [birthInfo, setBirthInfo] = useState<BirthInfo>({
    year: '', month: '', day: '', hour: '', minute: '', gender: '',
    province: '', city: '', district: '',
  });
  const [showForm, setShowForm] = useState(false);

  const buildInputText = useCallback(() => {
    let text = '';
    if (showBirthForm) {
      const parts: string[] = [];
      if (birthInfo.gender) parts.push(`性别：${birthInfo.gender === 'male' ? '男' : '女'}`);
      if (birthInfo.year && birthInfo.month && birthInfo.day) {
        let dateStr = `出生日期：${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日`;
        if (birthInfo.hour) dateStr += ` ${birthInfo.hour}:00`;
        parts.push(dateStr);
      }
      if (birthInfo.province) {
        let locStr = `出生地：${birthInfo.province}`;
        if (birthInfo.city) locStr += ` ${birthInfo.city}`;
        if (birthInfo.district) locStr += ` ${birthInfo.district}`;
        parts.push(locStr);
      }
      text = parts.join('，');
      if (input.trim()) {
        text += (text ? '。' : '') + input.trim();
      }
    } else {
      text = input.trim();
    }
    return text;
  }, [showBirthForm, birthInfo, input]);

  const handleSubmit = useCallback(async () => {
    const text = buildInputText();
    if (!text || loading) return;
    setLoading(true);
    setResult('');
    setError('');

    try {
      const response = await fetch('/api/divination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          input: input.trim(),
          mode,
          birthInfo: showBirthForm ? {
            gender: birthInfo.gender === 'male' ? '男' : birthInfo.gender === 'female' ? '女' : undefined,
            birthYear: birthInfo.year ? parseInt(birthInfo.year) : undefined,
            birthMonth: birthInfo.month ? parseInt(birthInfo.month) : undefined,
            birthDay: birthInfo.day ? parseInt(birthInfo.day) : undefined,
            birthHour: birthInfo.hour ? parseInt(birthInfo.hour) : undefined,
            birthMinute: birthInfo.minute ? parseInt(birthInfo.minute) : undefined,
            province: birthInfo.province || undefined,
            city: birthInfo.city || undefined,
            district: birthInfo.district || undefined,
          } : undefined,
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
  }, [buildInputText, loading, type, mode]);

  const canSubmit = showBirthForm
    ? (birthInfo.year && birthInfo.month && birthInfo.day && birthInfo.gender) || input.trim()
    : input.trim();

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

        {/* Birth Info Form (collapsible) */}
        {showBirthForm && (
          <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-gold">📋</span>
                <span className="text-gold font-serif text-sm font-bold">出生信息</span>
                {birthInfo.year && birthInfo.month && birthInfo.day && (
                  <span className="text-xs text-gold/50">（已填写）</span>
                )}
              </div>
              <span className={`text-gold/50 transition-transform ${showForm ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {showForm && (
              <div className="px-4 pb-4">
                <BirthInfoForm value={birthInfo} onChange={setBirthInfo} />
              </div>
            )}
          </div>
        )}

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
            disabled={loading || !canSubmit}
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
