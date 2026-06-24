#!/usr/bin/env npx tsx
/**
 * 英文书籍批量翻译脚本
 * 
 * 将 public/book-content/ 下所有英文 .txt 书籍翻译为中文
 * 翻译规则：从第一个字到最后一个字完整翻译，意思一模一样
 * 
 * 使用方式：npx tsx scripts/translate-books.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const BOOK_DIR = '/workspace/projects/public/book-content';
const PROGRESS_FILE = '/workspace/projects/translate-progress.json';
const CHUNK_SIZE = 3000; // characters per chunk
const MAX_CONCURRENT = 2; // concurrent book translations
const RETRY_COUNT = 3;
const RETRY_DELAY = 5000; // ms

interface Progress {
  completed: string[];    // filenames that have been fully translated
  inProgress: { [key: string]: number }; // filename -> chunkIndex being processed
  failed: { [key: string]: string };  // filename -> error message
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { completed: [], inProgress: {}, failed: {} };
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function isEnglishBook(filename: string): boolean {
  return !/[\u4e00-\u9fff]/.test(filename.replace('.txt', ''));
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }
    
    // Try to split at a paragraph break or sentence end
    let splitPoint = remaining.lastIndexOf('\n\n', CHUNK_SIZE);
    if (splitPoint < CHUNK_SIZE * 0.5) {
      splitPoint = remaining.lastIndexOf('\n', CHUNK_SIZE);
    }
    if (splitPoint < CHUNK_SIZE * 0.5) {
      splitPoint = remaining.lastIndexOf('. ', CHUNK_SIZE);
    }
    if (splitPoint < CHUNK_SIZE * 0.5) {
      splitPoint = CHUNK_SIZE;
    }
    
    chunks.push(remaining.substring(0, splitPoint + 1));
    remaining = remaining.substring(splitPoint + 1);
  }
  
  return chunks;
}

async function translateChunk(
  client: LLMClient,
  chunk: string,
  bookTitle: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> {
  const systemPrompt = `你是一位顶级英译中翻译专家，专精玄学、宗教、哲学、心理学领域典籍翻译。

翻译铁律：
1. 将英文原文完整翻译为中文，从第一个字到最后一个字，不可遗漏任何内容
2. 意思必须与原文完全一致，不可增添、删减、篡改原文含义
3. 专业术语使用学术界通用译名（如 Kabbalah→卡巴拉, Hermetic→赫密斯, Alchemy→炼金术, Chakra→脉轮）
4. 保留原文的段落结构
5. 如果是书籍标题、章节标题，翻译后加粗标记
6. 人名、地名首次出现时附英文原名，如：帕拉塞尔苏斯（Paracelsus）
7. 专有名词、咒语、符咒名称等若无通行中译，保留英文并在括号内附中文释义
8. 不可省略任何段落、脚注、附录，全部翻译
9. 不可添加原文没有的评论、解释或总结`;

  const userPrompt = `这是书籍《${bookTitle}》的第 ${chunkIndex + 1}/${totalChunks} 段。请完整翻译：

${chunk}`;

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const response = await client.invoke(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'doubao-seed-2-0-pro-260215',
          temperature: 0.3,
        }
      );
      
      if (response.content && response.content.trim().length > 0) {
        return response.content;
      }
      
      throw new Error('Empty response from LLM');
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`  Chunk ${chunkIndex} attempt ${attempt} failed: ${errMsg}`);
      if (attempt < RETRY_COUNT) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('All retries exhausted');
}

async function translateBook(
  client: LLMClient,
  filename: string,
  progress: Progress
): Promise<boolean> {
  const filepath = path.join(BOOK_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  const bookTitle = filename.replace('.txt', '');
  
  // If the book is empty or very small, skip
  if (content.trim().length === 0) {
    console.log(`  Skipping empty book: ${bookTitle}`);
    progress.completed.push(filename);
    delete progress.inProgress[filename];
    saveProgress(progress);
    return true;
  }
  
  const chunks = splitIntoChunks(content);
  console.log(`  "${bookTitle}" - ${content.length} chars, ${chunks.length} chunks`);
  
  // Check if we have partial progress
  const startChunk = progress.inProgress[filename] || 0;
  
  // Collect translated chunks
  const translatedChunks: string[] = [];
  
  // If we have a partial translation file, load it
  const partialFile = filepath + '.translating';
  if (startChunk > 0 && fs.existsSync(partialFile)) {
    const partialContent = fs.readFileSync(partialFile, 'utf-8');
    const partialChunks = partialContent.split('\n<<<CHUNK_BOUNDARY>>>\n');
    translatedChunks.push(...partialChunks);
    console.log(`  Resuming from chunk ${startChunk}, ${translatedChunks.length} chunks already done`);
  }
  
  for (let i = startChunk; i < chunks.length; i++) {
    try {
      // Update progress
      progress.inProgress[filename] = i;
      saveProgress(progress);
      
      console.log(`  Translating chunk ${i + 1}/${chunks.length}...`);
      const translated = await translateChunk(client, chunks[i], bookTitle, i, chunks.length);
      translatedChunks.push(translated);
      
      // Save partial translation after each chunk
      fs.writeFileSync(partialFile, translatedChunks.join('\n<<<CHUNK_BOUNDARY>>>\n'), 'utf-8');
      
      // Small delay between chunks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED at chunk ${i + 1}/${chunks.length}: ${errMsg}`);
      progress.failed[filename] = `Chunk ${i} failed: ${errMsg}`;
      delete progress.inProgress[filename];
      saveProgress(progress);
      return false;
    }
  }
  
  // Combine all translated chunks into the final file
  // Replace the <<<CHUNK_BOUNDARY>>> with double newlines
  const finalContent = translatedChunks.join('\n\n');
  
  // Write the translated Chinese version, replacing the English original
  fs.writeFileSync(filepath, finalContent, 'utf-8');
  
  // Remove partial file
  if (fs.existsSync(partialFile)) {
    fs.unlinkSync(partialFile);
  }
  
  // Update progress
  progress.completed.push(filename);
  delete progress.inProgress[filename];
  delete progress.failed[filename];
  saveProgress(progress);
  
  console.log(`  ✅ Completed: ${bookTitle} (${finalContent.length} chars)`);
  return true;
}

async function main() {
  console.log('=== 英文书籍翻译任务启动 ===\n');
  
  // Get all English books
  const allFiles = fs.readdirSync(BOOK_DIR).filter(f => f.endsWith('.txt'));
  const englishBooks = allFiles.filter(isEnglishBook);
  
  console.log(`Total books: ${allFiles.length}`);
  console.log(`English books to translate: ${englishBooks.length}`);
  
  // Load progress
  const progress = loadProgress();
  console.log(`Already completed: ${progress.completed.length}`);
  console.log(`Previously failed: ${Object.keys(progress.failed).length}`);
  
  // Filter out already completed books
  const remaining = englishBooks.filter(f => !progress.completed.includes(f));
  console.log(`Remaining to translate: ${remaining.length}\n`);
  
  if (remaining.length === 0) {
    console.log('All books already translated!');
    return;
  }
  
  // Sort by file size (smallest first for quick wins)
  remaining.sort((a, b) => {
    const sizeA = fs.statSync(path.join(BOOK_DIR, a)).size;
    const sizeB = fs.statSync(path.join(BOOK_DIR, b)).size;
    return sizeA - sizeB;
  });
  
  const config = new Config();
  const client = new LLMClient(config);
  
  // Process books with limited concurrency
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  for (let i = 0; i < remaining.length; i += MAX_CONCURRENT) {
    const batch = remaining.slice(i, i + MAX_CONCURRENT);
    
    const results = await Promise.allSettled(
      batch.map(async (filename) => {
        const size = fs.statSync(path.join(BOOK_DIR, filename)).size;
        console.log(`\n[${processed + 1}/${remaining.length}] ${filename} (${(size / 1024).toFixed(0)} KB)`);
        const result = await translateBook(client, filename, progress);
        processed++;
        return result;
      })
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        succeeded++;
      } else {
        failed++;
        if (result.status === 'rejected') {
          console.error(`  Batch error: ${result.reason}`);
        }
      }
    }
    
    // Delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== 翻译任务完成 ===');
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total translated: ${progress.completed.length}/${englishBooks.length}`);
}

main().catch(console.error);
