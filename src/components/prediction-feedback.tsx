'use client';

import { useState } from 'react';

interface PredictionFeedbackProps {
  divinationType: string;
  predictionSummary?: string;
  onFeedbackSubmitted?: () => void;
}

type FeedbackRating = 'accurate' | 'partially_accurate' | 'inaccurate' | 'pending_verification';

const ratingLabels: Record<FeedbackRating, { label: string; emoji: string; color: string }> = {
  accurate: { label: '准确', emoji: '✓', color: 'text-green-400 border-green-500/50 bg-green-500/10' },
  partially_accurate: { label: '部分准确', emoji: '~', color: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10' },
  inaccurate: { label: '不准', emoji: '✗', color: 'text-red-400 border-red-500/50 bg-red-500/10' },
  pending_verification: { label: '待验证', emoji: '⏳', color: 'text-blue-400 border-blue-500/50 bg-blue-500/10' },
};

export function PredictionFeedback({
  divinationType,
  predictionSummary,
  onFeedbackSubmitted,
}: PredictionFeedbackProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [detail, setDetail] = useState('');
  const [birthInfo, setBirthInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selectedRating) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divination_type: divinationType,
          prediction_content: predictionSummary || '',
          feedback_result: selectedRating,
          feedback_detail: detail || null,
          birth_info: birthInfo || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '提交失败');
      }

      setSubmitted(true);
      onFeedbackSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-4 p-4 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/5">
        <p className="text-[#d4a853] text-sm">
          感谢您的验证反馈！每一条验证都会让AI更精准——这就是AI宗师的叠加式进化。
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border border-[#d4a853]/20 bg-[#1a1a2e]/50">
      <p className="text-[#d4a853] text-sm font-bold mb-3">
        预测验证反馈
      </p>
      <p className="text-[#8a8070] text-xs mb-3">
        您的验证是AI精进的关键——每一次反馈都成为永久的经验增量
      </p>

      {/* Rating buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(Object.entries(ratingLabels) as [FeedbackRating, typeof ratingLabels[FeedbackRating]][]).map(
          ([key, { label, emoji, color }]) => (
            <button
              key={key}
              onClick={() => setSelectedRating(key)}
              className={`px-3 py-1.5 rounded border text-xs transition-all ${
                selectedRating === key
                  ? color
                  : 'border-[#2a2a3e] text-[#8a8070] bg-transparent hover:border-[#d4a853]/30'
              }`}
            >
              {emoji} {label}
            </button>
          )
        )}
      </div>

      {/* Detail input */}
      {selectedRating && (
        <>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="具体哪些准了？哪些不准？（可选）"
            className="w-full p-2 rounded border border-[#2a2a3e] bg-[#0a0a0f] text-[#e8e0d0] text-xs placeholder:text-[#555] resize-none h-16 mb-2 focus:border-[#d4a853]/50 focus:outline-none"
          />

          {(selectedRating === 'accurate' || selectedRating === 'partially_accurate') && (
            <textarea
              value={birthInfo}
              onChange={(e) => setBirthInfo(e.target.value)}
              placeholder="实际发生了什么？请描述验证结果（如：确实在2026年农历五月遇到正缘）"
              className="w-full p-2 rounded border border-[#2a2a3e] bg-[#0a0a0f] text-[#e8e0d0] text-xs placeholder:text-[#555] resize-none h-16 mb-2 focus:border-[#d4a853]/50 focus:outline-none"
            />
          )}

          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 rounded bg-[#d4a853]/20 border border-[#d4a853]/40 text-[#d4a853] text-xs hover:bg-[#d4a853]/30 transition-all disabled:opacity-50"
          >
            {submitting ? '提交中...' : '提交验证反馈'}
          </button>
        </>
      )}
    </div>
  );
}
