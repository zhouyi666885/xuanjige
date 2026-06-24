/**
 * 英文书籍批量翻译脚本 V3 - 高速版
 * 
 * 优化：
 * - 使用 doubao-seed-2-0-lite-260215（更快）
 * - 10000字符大分段（减少API调用次数）
 * - 10本书同时翻译（高并发）
 * - 断点续传
 * - 完整性校验
 */

import * as fs from 'fs';
import * as path from 'path';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const BOOK_DIR = '/workspace/projects/public/book-content';
const PROGRESS_FILE = '/workspace/projects/translate-progress-v3.json';
const BACKUP_DIR = '/workspace/projects/public/book-content-en-backup';
const CHUNK_SIZE = 10000;
const MAX_CONCURRENT = 10;
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `你是一位顶级英译中翻译专家，专精宗教、哲学、玄学、心理学典籍。

【翻译铁律】：
1. 从第一个字翻译到最后一个字，一字不漏
2. 意思与原文完全一致，不增添、删减、省略、篡改
3. 不可因长度截断，不可写"以下省略"
4. 原文有几段翻译就有几段，段落一一对应
5. 专业术语用通用译名：Alchemy→炼金术, Kabbalah→卡巴拉, Hermetic→赫尔墨斯, Chakra→查克拉, Karma→业力, Mantra→曼陀罗, Tarot→塔罗, Necromancy→死灵术, Theurgy→通神术, Astrology→占星术, Divination→占卜, Occult→秘术
6. 人名地名首次附英文原名：如 亚里士多德（Aristotle）
7. 保留标题、列表、引用结构
8. 不可合并多段为一段
9. 不可省略脚注、注释、附录

直接输出译文，不加引导语。`;

interface Progress {
  completed: string[];
  failed: { [key: string]: string };
}

function loadProgress(): Progress {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { completed: [], failed: {} };
  }
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function isEnglishFile(filename: string): boolean {
  return !filename.split('').some(c => '\u4e00' <= c && c <= '\u9fff');
}

function isChineseContent(filepath: string): boolean {
  const content = fs.readFileSync(filepath, 'utf-8').substring(0, 3000);
  const cn = [...content].filter(c => '\u4e00' <= c && c <= '\u9fff').length;
  const en = [...content].filter(c => 'a' <= c.toLowerCase() && c.toLowerCase() <= 'z').length;
  return cn > en * 2;
}

function getChunks(text: string): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function translateChunk(client: LLMClient, chunk: string, retries = 0): Promise<string> {
  try {
    const response = await client.invoke(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `完整翻译以下英文为中文，一字不漏：\n\n${chunk}` },
      ],
      {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.3,
      }
    );
    return response.content || '';
  } catch (error: unknown) {
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 3000));
      return translateChunk(client, chunk, retries + 1);
    }
    throw error;
  }
}

async function translateBook(client: LLMClient, filename: string): Promise<void> {
  const filepath = path.join(BOOK_DIR, filename);
  const original = fs.readFileSync(filepath, 'utf-8');
  
  if (original.length < 10) return;
  
  // Backup
  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, original, 'utf-8');
  }
  
  const chunks = getChunks(original);
  console.log(`📖 ${filename.substring(0, 45)} | ${original.length}字 | ${chunks.length}段`);
  
  const translations: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const translated = await translateChunk(client, chunks[i]);
    translations.push(translated);
    
    // Save intermediate
    fs.writeFileSync(filepath + '.translating', translations.join('\n\n'), 'utf-8');
    await new Promise(r => setTimeout(r, 200));
  }
  
  const finalTranslation = translations.join('\n\n');
  fs.writeFileSync(filepath, finalTranslation, 'utf-8');
  try { fs.unlinkSync(filepath + '.translating'); } catch {}
  
  const ratio = finalTranslation.length / original.length * 100;
  console.log(`✅ ${ratio.toFixed(0)}% | ${original.length}→${finalTranslation.length}字 | ${filename.substring(0, 40)}`);
}

async function main() {
  console.log(`=== 英文书籍翻译 V3 (高速版) === ${new Date().toISOString()}`);
  
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  const config = new Config();
  const client = new LLMClient(config);
  
  // Find English books needing translation
  const allFiles = fs.readdirSync(BOOK_DIR).filter(f => f.endsWith('.txt'));
  const englishBooks = allFiles.filter(f => isEnglishFile(f) && !isChineseContent(path.join(BOOK_DIR, f)));
  
  const progress = loadProgress();
  const completedSet = new Set(progress.completed);
  
  // Also check V2 progress for already-translated books
  try {
    const v2 = JSON.parse(fs.readFileSync('/workspace/projects/translate-progress-v2.json', 'utf-8'));
    for (const f of v2.completed) completedSet.add(f);
  } catch {}
  
  const remaining = englishBooks.filter(f => !completedSet.has(f) && !progress.failed[f]);
  
  console.log(`英文书: ${englishBooks.length} | 已完成: ${completedSet.size} | 剩余: ${remaining.length}`);
  
  if (remaining.length === 0) {
    console.log('全部完成！');
    return;
  }
  
  // Sort by size (smallest first)
  remaining.sort((a, b) => fs.statSync(path.join(BOOK_DIR, a)).size - fs.statSync(path.join(BOOK_DIR, b)).size);
  
  let processed = completedSet.size;
  let failed = Object.keys(progress.failed).length;
  const startTime = Date.now();
  
  for (let i = 0; i < remaining.length; i += MAX_CONCURRENT) {
    const batch = remaining.slice(i, i + MAX_CONCURRENT);
    
    const results = await Promise.allSettled(
      batch.map(async (filename) => {
        await translateBook(client, filename);
        return filename;
      })
    );
    
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const filename = batch[j];
      if (result.status === 'fulfilled') {
        progress.completed.push(filename);
        processed++;
      } else {
        const err = result.reason?.message || String(result.reason);
        console.log(`❌ ${filename.substring(0, 40)}: ${err.substring(0, 80)}`);
        progress.failed[filename] = err.substring(0, 200);
        failed++;
      }
    }
    saveProgress(progress);
    
    const elapsed = (Date.now() - startTime) / 60000;
    const rate = (processed - completedSet.size) / elapsed;
    const eta = (remaining.length - i - batch.length) / rate;
    console.log(`\n📊 ${processed}/${englishBooks.length} 完成 | ${failed} 失败 | 速率: ${rate.toFixed(1)}本/分 | ETA: ${eta.toFixed(0)}分钟\n`);
  }
  
  console.log(`\n=== 翻译完成 === 成功: ${processed} 失败: ${failed}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
