'use client';

import { useState, useEffect } from 'react';

interface CopyrightBook {
  bookName: string;
  message: string;
}

const COPYRIGHT_SHOWN_KEY = 'xuanjige_copyright_shown';

export function CopyrightNotice() {
  const [books, setBooks] = useState<CopyrightBook[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 检查本次会话是否已经显示过
    if (sessionStorage.getItem(COPYRIGHT_SHOWN_KEY)) {
      return;
    }

    // 获取版权问题的书籍列表
    fetch('/api/add-book')
      .then(res => res.json())
      .then(data => {
        if (data.tasks) {
          const copyrightBooks = data.tasks
            .filter((task: { status: string }) => task.status === 'copyright')
            .map((task: { bookName: string; message: string }) => ({
              bookName: task.bookName,
              message: task.message,
            }));
          if (copyrightBooks.length > 0) {
            setBooks(copyrightBooks);
            setVisible(true);
          }
        }
      })
      .catch(() => {
        // 静默失败
      });
  }, []);

  const handleClose = () => {
    setVisible(false);
    // 标记本次会话已显示，退出APP后sessionStorage自动清除
    sessionStorage.setItem(COPYRIGHT_SHOWN_KEY, '1');
  };

  if (!visible || books.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-gold/20 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-gold/5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📜</span>
          <h3 className="text-gold font-serif font-bold text-lg">版权提示</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          以下书籍已搜遍全网所有渠道（免费网站、文档平台、电子书站、论坛、古籍库），暂未找到完整内容：
        </p>

        <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
          {books.map((book, i) => (
            <div key={i} className="bg-ink/50 rounded-lg px-3 py-2 text-sm">
              <span className="text-vermilion font-medium">{book.bookName}</span>
              <p className="text-muted-foreground text-xs mt-0.5">{book.message}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          此提示本次打开仅显示一次，退出后不再重复。
        </p>

        <button
          onClick={handleClose}
          className="w-full bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold font-medium rounded-xl py-2.5 transition-colors"
        >
          我知道了
        </button>
      </div>
    </div>
  );
}
