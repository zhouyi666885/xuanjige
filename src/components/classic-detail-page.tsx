'use client';

import Link from 'next/link';
import { useMemo } from 'react';

interface Book {
  title: string;
  author?: string;
  rating: number;
  desc: string;
}

interface ClassicDetailProps {
  title: string;
  icon: string;
  totalCount: string;
  existingCount: string;
  lostCount: string;
  sections: {
    title: string;
    rating: string;
    books: Book[];
  }[];
}

function StarRating({ rating }: { rating: number }) {
  return <span className="text-gold">{Array.from({ length: rating }, () => '★').join('')}</span>;
}

export function ClassicDetailPage({ title, icon, totalCount, existingCount, lostCount, sections }: ClassicDetailProps) {
  const totalStats = useMemo(() => ({ totalCount, existingCount, lostCount }), [totalCount, existingCount, lostCount]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/classics" className="text-gold/60 text-sm hover:text-gold transition-colors mb-4 inline-block">
          ← 返回经典书房
        </Link>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{icon}</div>
          <h1 className="text-2xl font-bold text-gold mb-2">{title}</h1>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span>存世 {totalStats.existingCount}</span>
            <span>亡佚 {totalStats.lostCount}</span>
            <span>合计 {totalStats.totalCount}</span>
          </div>
        </div>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-[#1a1a2e] rounded-xl p-5 border border-gold/10">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-bold text-gold/90">{section.title}</h2>
                <span className="text-xs text-gold/50">{section.rating}</span>
              </div>
              <div className="space-y-3">
                {section.books.map((book, bidx) => (
                  <div key={bidx} className="flex items-start gap-3 py-2 border-b border-gold/5 last:border-0">
                    <div className="flex-shrink-0 pt-0.5">
                      <StarRating rating={book.rating} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground/90">
                        {book.title}
                        {book.author && <span className="text-muted-foreground ml-2 text-xs">— {book.author}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{book.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
