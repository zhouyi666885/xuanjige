'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface ReadingResultProps {
  type: 'face' | 'palm';
  image: string;
  mode: 'casual' | 'professional';
  birthDate?: string;
  birthHour?: string;
  gender?: string;
  onClose: () => void;
}

export function ReadingResult({ type, image, mode, birthDate, birthHour, gender, onClose }: ReadingResultProps) {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiUrl = type === 'face' ? '/api/face-reading' : '/api/palm-reading';

  useEffect(() => {
    const fetchReading = async () => {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mode, birthDate, birthHour, gender }),
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
  }, [apiUrl, image, mode]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gold/10">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto">
          {/* Image Preview */}
          <div className="w-40 h-40 mx-auto rounded-2xl overflow-hidden border-2 border-gold/20 mb-6">
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

          {/* Result */}
          {result && (
            <div className="bg-card border border-gold/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gold">✦</span>
                <h3 className="text-gold font-serif font-bold">
                  {type === 'face' ? '面相分析' : '手相分析'}
                </h3>
              </div>
              <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {result}
                {loading && <span className="typewriter-cursor" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
