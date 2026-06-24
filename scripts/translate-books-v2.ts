/**
 * 英文书籍批量翻译脚本 V2
 * 
 * 核心规则：从第一个字到最后一个字，一字不漏，完整翻译
 * 
 * 优化：
 * - 更大分段 (6000字符)
 * - 更强力提示词，禁止缩减/省略
 * - 翻译后验证完整性（段落数对比）
 * - 5本书并发
 * - 失败自动重试5次
 * - 断点续传
 */

import * as fs from 'fs';
import * as path from 'path';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const BOOK_DIR = '/workspace/projects/public/book-content';
const PROGRESS_FILE = '/workspace/projects/translate-progress-v2.json';
const BACKUP_DIR = '/workspace/projects/public/book-content-en-backup';
const CHUNK_SIZE = 6000; // characters per chunk
const MAX_CONCURRENT_BOOKS = 5;
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // ms

// Translation system prompt - extremely strict about completeness
const SYSTEM_PROMPT = `你是一位顶级英译中翻译专家。你的任务是将英文原文【完整】翻译为中文。

【铁律 - 必须遵守】：
1. 必须从原文的第一个字翻译到最后一个字，一字不漏
2. 翻译的意思必须与原文完全一致，不可增添、删减、篡改、省略
3. 即使原文很长，也必须完整翻译，绝不许以"字数到了"或"行数到了"为由截断
4. 英文原文有几段，中文翻译就必须有几段，段落一一对应
5. 专业术语使用学术界通用译名（如 Kabbalah→卡巴拉, Alchemy→炼金术, Hermetic→赫尔墨斯, Chakra→查克拉）
6. 人名地名首次出现时附英文原名，如"亚里士多德（Aristotle）"
7. 保留原文的标题层级、列表、引用等结构
8. 不可将多段合并为一段
9. 不可省略任何脚注、注释、附录
10. 每一段都必须翻译，没有"以下省略"这种做法

输出格式：直接输出翻译结果，不要加任何"以下是翻译"之类的引导语。`;

interface Progress {
  completed: string[];     // filename
  failed: { [key: string]: string }; // filename -> error
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

function isChineseContent(filepath: string): boolean {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const sample = content.substring(0, 3000);
    const cnChars = [...sample].filter(c => '\u4e00' <= c && c <= '\u9fff').length;
    const enChars = [...sample].filter(c => 'a' <= c.toLowerCase() && c.toLowerCase() <= 'z').length;
    return cnChars > enChars * 2;
  } catch {
    return false;
  }
}

function isEnglishFilename(filename: string): boolean {
  return !filename.split('').some(c => '\u4e00' <= c && c <= '\u9fff');
}

function getChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  // Split by paragraphs first, then group into chunks
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  
  return chunks;
}

async function translateChunk(client: LLMClient, chunk: string, retryCount = 0): Promise<string> {
  try {
    const response = await client.invoke(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请完整翻译以下英文内容为中文。原文有几段，翻译就必须有几段，一字不漏：\n\n${chunk}` },
      ],
      {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      }
    );
    
    const translated = response.content || '';
    
    // Verify: count paragraphs in original vs translation
    const origParas = chunk.split(/\n\n+/).filter(p => p.trim()).length;
    const transParas = translated.split(/\n\n+/).filter(p => p.trim()).length;
    
    // If translation has significantly fewer paragraphs, it might be truncated
    // Allow some tolerance since Chinese may merge short lines
    if (transParas < origParas * 0.5 && origParas > 3) {
      console.log(`  ⚠ Paragraph count mismatch: orig=${origParas}, trans=${transParas}`);
    }
    
    // If translation is suspiciously short compared to original
    if (translated.length < chunk.length * 0.2 && chunk.length > 500) {
      console.log(`  ⚠ Translation too short: orig=${chunk.length}, trans=${translated.length}`);
      if (retryCount < MAX_RETRIES) {
        console.log(`  Retrying chunk (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        return translateChunk(client, chunk, retryCount + 1);
      }
    }
    
    return translated;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ Translation error: ${errMsg.substring(0, 100)}`);
    if (retryCount < MAX_RETRIES) {
      console.log(`  Retrying chunk (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return translateChunk(client, chunk, retryCount + 1);
    }
    throw error;
  }
}

async function translateBook(client: LLMClient, filename: string): Promise<void> {
  const filepath = path.join(BOOK_DIR, filename);
  
  // Read original
  const original = fs.readFileSync(filepath, 'utf-8');
  
  if (original.length < 10) {
    console.log(`  Skipping (too short): ${filename.substring(0, 50)}`);
    return;
  }
  
  // Backup original
  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, original, 'utf-8');
  }
  
  // Split into chunks
  const chunks = getChunks(original, CHUNK_SIZE);
  console.log(`  📖 ${filename.substring(0, 50)} | ${original.length} chars | ${chunks.length} chunks`);
  
  // Translate each chunk
  const translations: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`    Translating chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`);
    
    const translated = await translateChunk(client, chunk);
    translations.push(translated);
    
    // Save intermediate progress
    const tempContent = translations.join('\n\n');
    fs.writeFileSync(filepath + '.translating', tempContent, 'utf-8');
    
    // Small delay between chunks
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Combine and write final translation
  const finalTranslation = translations.join('\n\n');
  fs.writeFileSync(filepath, finalTranslation, 'utf-8');
  
  // Remove temp file
  try { fs.unlinkSync(filepath + '.translating'); } catch {}
  
  // Verification
  const origParaCount = original.split(/\n\n+/).filter(p => p.trim()).length;
  const transParaCount = finalTranslation.split(/\n\n+/).filter(p => p.trim()).length;
  const sizeRatio = finalTranslation.length / original.length;
  
  console.log(`  ✅ Done! Orig: ${original.length} chars / ${origParaCount} paras → Trans: ${finalTranslation.length} chars / ${transParaCount} paras (ratio: ${(sizeRatio * 100).toFixed(0)}%)`);
  
  // Alert if ratio is suspiciously low
  if (sizeRatio < 0.25 && original.length > 1000) {
    console.log(`  ⚠⚠⚠ WARNING: Translation ratio ${(sizeRatio * 100).toFixed(0)}% is suspiciously low! May be incomplete!`);
  }
}

async function main() {
  console.log('=== 英文书籍批量翻译 V2 ===');
  console.log(`启动时间: ${new Date().toISOString()}`);
  
  // Ensure backup dir
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  // Initialize LLM client
  const config = new Config();
  const client = new LLMClient(config);
  
  // Find all English books that need translation
  const allFiles = fs.readdirSync(BOOK_DIR).filter(f => f.endsWith('.txt'));
  const englishBooks = allFiles.filter(f => isEnglishFilename(f) && !isChineseContent(path.join(BOOK_DIR, f)));
  
  console.log(`Total files: ${allFiles.length}`);
  console.log(`English books needing translation: ${englishBooks.length}`);
  
  // Load progress
  const progress = loadProgress();
  const completedSet = new Set(progress.completed);
  
  const remaining = englishBooks.filter(f => !completedSet.has(f) && !progress.failed[f]);
  console.log(`Already completed: ${completedSet.size}`);
  console.log(`Remaining: ${remaining.length}`);
  
  if (remaining.length === 0) {
    console.log('All books translated!');
    return;
  }
  
  // Sort by file size (smallest first for faster initial progress)
  remaining.sort((a, b) => {
    const sizeA = fs.statSync(path.join(BOOK_DIR, a)).size;
    const sizeB = fs.statSync(path.join(BOOK_DIR, b)).size;
    return sizeA - sizeB;
  });
  
  // Process books with concurrency limit
  let processed = 0;
  let failed = 0;
  
  for (let i = 0; i < remaining.length; i += MAX_CONCURRENT_BOOKS) {
    const batch = remaining.slice(i, i + MAX_CONCURRENT_BOOKS);
    
    const promises = batch.map(async (filename) => {
      try {
        await translateBook(client, filename);
        progress.completed.push(filename);
        saveProgress(progress);
        processed++;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.log(`  ❌ FAILED: ${filename.substring(0, 50)} - ${errMsg.substring(0, 100)}`);
        progress.failed[filename] = errMsg.substring(0, 200);
        saveProgress(progress);
        failed++;
      }
    });
    
    await Promise.all(promises);
    
    console.log(`\n--- Progress: ${completedSet.size + processed}/${englishBooks.length} completed, ${failed} failed ---\n`);
  }
  
  console.log('\n=== 翻译任务完成 ===');
  console.log(`总计: ${englishBooks.length} 本`);
  console.log(`成功: ${completedSet.size + processed} 本`);
  console.log(`失败: ${failed} 本`);
  
  if (failed > 0) {
    console.log('\n失败列表:');
    for (const [f, err] of Object.entries(progress.failed)) {
      console.log(`  ${f.substring(0, 60)} - ${err}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
