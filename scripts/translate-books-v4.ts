import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// V4.1 英文书籍翻译脚本
// 核心：分段5000字符 + 段落计数验证 + 自动重试 + 断点续传
// ============================================================

const BOOK_DIR = '/workspace/projects/public/book-content';
const PROGRESS_FILE = '/workspace/projects/translate-progress-v4.json';
const LOG_FILE = '/app/work/logs/bypass//translate-v4.log';

const CONCURRENT_BOOKS = 5;   // 同时翻译5本书
const CONCURRENT_CHUNKS = 5;  // 每本书同时翻译5个分段
const CHUNK_SIZE = 5000;      // 每段5000字符
const MAX_PARAS_PER_CHUNK = 25; // 每段最多25个段落，防止模型输出截断
const MAX_RETRIES = 3;        // 段落不足时重试

const SYSTEM_PROMPT = `你是一位世界顶级翻译大师，拥有30年英译中出版翻译经验。你的翻译作品已由商务印书馆、中华书局、三联书店等一流出版社出版。

【翻译铁律 - 绝对不可违反】

一、完整性
1. 必须完整翻译给出的每一段英文，一段不漏
2. 英文有几段，中文就必须有几段，段落一一对应
3. 英文有几句话，中文就必须有几句话
4. 绝对禁止省略、跳过、合并、精简任何段落或句子
5. 禁止出现"以下省略"、"其余部分略"等省略表述
6. 禁止以"字数限制"、"篇幅有限"为由截断

二、必须翻译的部分
7. 书名、副标题、作者名
8. 版权声明、出版信息
9. 献辞、致谢
10. 序言、前言、导论
11. 目录
12. 正文每一章每一节每一段
13. 脚注、尾注、注释
14. 附录、补充材料
15. 后记、跋
16. 索引、词汇表
17. 参考文献
18. 广告页、出版商介绍

三、质量
19. 语句通顺流畅，像正规中文出版物
20. 专业术语准确，使用学术界公认标准译名
21. 不可曲解原文，不可随意发挥
22. 不可出现机器翻译生硬痕迹
23. 长句可拆分，但信息不可丢失
24. 人名地名首次出现附英文原名

四、格式
25. 段与段之间用空行分隔
26. 保留标题层级、列表、引用等格式
27. 直接输出翻译结果，不加引导语`;

function log(msg: string) {
  const ts = new Date().toISOString().substring(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function hasChineseChars(s: string): boolean {
  for (const c of s) {
    if (c.charCodeAt(0) >= 0x4e00 && c.charCodeAt(0) <= 0x9fff) return true;
  }
  return false;
}

interface Progress {
  completed: string[];
  failed: Record<string, string>;
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

function splitIntoChunks(content: string): { text: string; paraCount: number }[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: { text: string; paraCount: number }[] = [];
  let current = '';
  let currentParas = 0;

  for (const para of paragraphs) {
    // Split by both size AND paragraph count
    if ((current.length + para.length + 2 > CHUNK_SIZE || currentParas >= MAX_PARAS_PER_CHUNK) && current.length > 0) {
      chunks.push({ text: current.trim(), paraCount: currentParas });
      current = para;
      currentParas = 1;
    } else {
      current += (current ? '\n\n' : '') + para;
      currentParas++;
    }
  }
  if (current.trim()) {
    chunks.push({ text: current.trim(), paraCount: currentParas });
  }

  return chunks;
}

async function translateChunk(
  client: any,
  text: string,
  paraCount: number,
  retries: number = 0
): Promise<string> {
  const userPrompt = `请完整翻译以下英文内容为中文。

【关键要求】原文共有${paraCount}个段落（以空行分隔的文本块）。你的翻译也必须有且仅有${paraCount}个段落，一段对应一段，一段不漏。

请逐段翻译：

---

${text}`;

  const response = await client.invoke(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { model: 'doubao-seed-2-0-pro-260215', temperature: 0.3 }
  );

  const translated = (response.content || '').trim();
  const transParas = translated.split(/\n\n+/).filter((p: string) => p.trim()).length;

  if (transParas < paraCount && retries < MAX_RETRIES) {
    log(`  ⚠️ 段落不足: 译${transParas}段/原${paraCount}段，重试 ${retries + 1}/${MAX_RETRIES}`);
    return translateChunk(client, text, paraCount, retries + 1);
  }

  if (transParas < paraCount) {
    log(`  ❌ 重试${MAX_RETRIES}次仍不足: 译${transParas}段/原${paraCount}段`);
  }

  return translated;
}

async function translateBook(client: any, filename: string): Promise<boolean> {
  const filepath = path.join(BOOK_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  const chunks = splitIntoChunks(content);
  const totalOrigParas = chunks.reduce((sum, c) => sum + c.paraCount, 0);

  log(`📖 开始翻译: ${filename.substring(0, 55)} (${(content.length / 1024).toFixed(0)}KB, ${totalOrigParas}段, ${chunks.length}分段)`);

  const translations: string[] = [];
  let totalTransParas = 0;
  let hasIssue = false;

  // Process chunks in batches of CONCURRENT_CHUNKS
  for (let i = 0; i < chunks.length; i += CONCURRENT_CHUNKS) {
    const batch = chunks.slice(i, Math.min(i + CONCURRENT_CHUNKS, chunks.length));
    const batchPromises = batch.map((chunk, idx) => {
      const chunkIdx = i + idx;
      return translateChunk(client, chunk.text, chunk.paraCount)
        .then(result => {
          const transParas = result.split(/\n\n+/).filter(p => p.trim()).length;
          const ok = transParas >= chunk.paraCount;
          if (!ok) hasIssue = true;
          log(`  分段${chunkIdx + 1}/${chunks.length}: 原${chunk.paraCount}段→译${transParas}段 ${ok ? '✅' : '❌'}`);
          totalTransParas += transParas;
          return result;
        });
    });

    const batchResults = await Promise.all(batchPromises);
    translations.push(...batchResults);
  }

  const finalTranslation = translations.join('\n\n');
  const overallRatio = totalTransParas / totalOrigParas * 100;

  // Save the translation
  fs.writeFileSync(filepath, finalTranslation, 'utf-8');

  log(`📊 完成: ${filename.substring(0, 45)} | 原${totalOrigParas}段→译${totalTransParas}段 (${overallRatio.toFixed(0)}%) | ${hasIssue ? '⚠️有段落不足' : '✅完整'}`);

  return overallRatio >= 80; // Consider 80%+ paragraph ratio as success
}

async function main() {
  const { LLMClient, Config } = await import('../src/lib/coze-replacement');
  const config = new Config();
  const client = new LLMClient(config);

  log('🚀 V4.1 翻译启动 - 分段5000字符 + 段落验证 + 自动重试');
  log(`铁律: 从第一个字到最后一个字，一字不漏，一段不漏`);

  const progress = loadProgress();

  // Get English books that need translation
  const files = fs.readdirSync(BOOK_DIR)
    .filter(f => f.endsWith('.txt') && !hasChineseChars(f))
    .filter(f => !progress.completed.includes(f))
    .filter(f => !progress.failed[f])
    .sort((a, b) => {
      // Sort by size - smallest first for faster feedback
      const sizeA = fs.statSync(path.join(BOOK_DIR, a)).size;
      const sizeB = fs.statSync(path.join(BOOK_DIR, b)).size;
      return sizeA - sizeB;
    });

  log(`待翻译: ${files.length} 本 (已完成: ${progress.completed.length})`);

  // Process in batches of CONCURRENT_BOOKS
  for (let i = 0; i < files.length; i += CONCURRENT_BOOKS) {
    const batch = files.slice(i, Math.min(i + CONCURRENT_BOOKS, files.length));
    log(`\n📦 批次 ${Math.floor(i / CONCURRENT_BOOKS) + 1}: ${batch.length} 本书`);

    const results = await Promise.all(
      batch.map(async (f) => {
        try {
          const success = await translateBook(client, f);
          if (success) {
            progress.completed.push(f);
          } else {
            // Translation had significant issues but still saved
            progress.completed.push(f);
            log(`  ⚠️ ${f.substring(0, 40)} 翻译段落不足80%但仍保留`);
          }
          return true;
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          log(`❌ 失败: ${f.substring(0, 40)} - ${errMsg.substring(0, 100)}`);
          progress.failed[f] = errMsg.substring(0, 200);
          return false;
        }
      })
    );

    saveProgress(progress);

    const completed = results.filter(r => r).length;
    log(`批次完成: ${completed}/${batch.length} | 累计: ${progress.completed.length}/${files.length + progress.completed.length} | 失败: ${Object.keys(progress.failed).length}`);

    // Brief pause between batches
    await new Promise(r => setTimeout(r, 2000));
  }

  log(`\n🏁 全部完成! 成功: ${progress.completed.length}, 失败: ${Object.keys(progress.failed).length}`);
  if (Object.keys(progress.failed).length > 0) {
    log(`失败列表:`);
    for (const [f, err] of Object.entries(progress.failed)) {
      log(`  ${f.substring(0, 50)}: ${err.substring(0, 80)}`);
    }
  }
}

main().catch(err => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
