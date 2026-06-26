// AUTO-GENERATED 种子书籍数据索引（不含全文，避免 OOM）
// 全文从 public/book-content/<name>.txt 在运行时按需读取
// 由 scripts/gen-seed-index.ts 生成

import fs from 'fs';
import path from 'path';

export interface SeedBookMeta {
  name: string;
  chapters: number;
  charCount: number;
  filename: string;
}

export const SEED_BOOK_INDEX: SeedBookMeta[] = [
  { name: '滴天髓', chapters: 64, charCount: 144517, filename: '滴天髓.txt' },
];

/**
 * 懒加载单本种子书的全文内容
 * - 生产环境：优先读 process.cwd()/public/book-content/{filename}
 * - 失败返回 null，调用方降级到 Supabase
 */
export function loadSeedBookContent(filename: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'book-content', filename),
    path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'public', 'book-content', filename),
    path.join('/workspace/projects', 'public', 'book-content', filename),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf-8');
      }
    } catch {
      // ignore and try next
    }
  }
  return null;
}

// 向后兼容：旧代码引用了 SEED_BOOKS，提供一个 getter 但内容懒加载
export interface SeedBook {
  name: string;
  content: string;
  chapters: number;
  charCount: number;
}

export function getSeedBooks(): SeedBook[] {
  const result: SeedBook[] = [];
  for (const meta of SEED_BOOK_INDEX) {
    const content = loadSeedBookContent(meta.filename);
    if (content) {
      result.push({
        name: meta.name,
        content,
        chapters: meta.chapters,
        charCount: meta.charCount,
      });
    }
  }
  return result;
}

// 为了不破坏现有 import SEED_BOOKS 的用法，导出一个空数组作为默认值
// 实际使用时应改用 getSeedBooks() 函数
export const SEED_BOOKS: SeedBook[] = [];
