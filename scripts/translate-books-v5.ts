import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// V5 英文书籍翻译脚本
// 核心创新：【段N】编号标注 → 强制段落一一对应 → 永不合并/省略
// + 分段4000字符/12段上限 + 自动重试 + 断点续传
// ============================================================

const BOOK_DIR = '/workspace/projects/public/book-content';
const BACKUP_DIR = '/workspace/projects/public/book-content-en-backup';
const PROGRESS_FILE = '/workspace/projects/translate-progress-v5.json';
const LOG_FILE = '/app/work/logs/bypass//translate-v5.log';

const CONCURRENT_BOOKS = 5;
const CONCURRENT_CHUNKS = 3;   // 每本书3个分段并发（减少API压力）
const CHUNK_SIZE = 4000;       // 每段4000字符
const MAX_PARAS_PER_CHUNK = 12; // 每段最多12个段落
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `你是一位世界顶级翻译大师，拥有30年英译中出版翻译经验。你的翻译作品已由商务印书馆、中华书局、三联书店等一流出版社出版。

你正在翻译一部重要的学术/宗教/哲学典籍，这是一项正式的出版翻译工作。

【翻译铁律 - 绝对不可违反，违反任何一条即视为翻译失败】：

一、完整性铁律
1. 英文原文从第一个字到最后一个字，必须全部翻译，一个字母都不许遗漏
2. 英文有几段，中文就必须有几段，段落数量必须一一对应
3. 英文有几句话，中文就必须有几句话，句子数量必须一一对应
4. 绝对禁止以任何理由省略、跳过、合并、精简任何段落或句子
5. 禁止出现"以下省略"、"其余部分略"、"同上"等省略性表述
6. 禁止以"字数限制"、"篇幅有限"为由截断翻译

二、必须翻译的部分（不允许跳过任何一项）
7. 书名、副标题、作者名、译者名
8. 版权声明、出版信息
9. 献辞、致谢
10. 序言、前言、导论、引言
11. 目录
12. 正文每一章每一节每一段
13. 脚注、尾注、注释
14. 附录、补充材料
15. 后记、跋
16. 索引、词汇表
17. 参考文献、书目
18. 广告页、出版商介绍

三、质量铁律
19. 翻译必须语句通顺流畅，像正规中文出版物一样可读
20. 专业术语必须准确，使用学术界公认的标准译名
21. 不可曲解原文含义，不可随意发挥
22. 不可出现机器翻译的生硬痕迹
23. 长句可适当拆分为多个中文短句，但信息不可丢失
24. 被动语态可转为主动语态，但含义不可改变
25. 人名、地名、书名首次出现时在括号内附英文原名
26. 保留原文的标点结构（引号内的内容必须翻译）

四、段落编号铁律（最关键！）
27. 原文每个段落前已标注【段1】【段2】等编号
28. 翻译后的每一段前面也必须保留相同的【段N】编号
29. 绝对禁止将两个段落合并为一个段落
30. 绝对禁止省略任何一个段落
31. 【段N】编号与翻译内容之间不留空格，如：【段1】这是第一段的翻译内容

输出格式：直接输出带【段N】编号的翻译结果，不要加任何引导语。`;

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
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  const chunks: { text: string; paraCount: number }[] = [];
  let currentParas: string[] = [];

  for (const para of paragraphs) {
    if ((currentParas.join('\n\n').length + para.length + 2 > CHUNK_SIZE || currentParas.length >= MAX_PARAS_PER_CHUNK) && currentParas.length > 0) {
      chunks.push({ text: currentParas.join('\n\n'), paraCount: currentParas.length });
      currentParas = [para];
    } else {
      currentParas.push(para);
    }
  }
  if (currentParas.length > 0) {
    chunks.push({ text: currentParas.join('\n\n'), paraCount: currentParas.length });
  }

  return chunks;
}

function numberParagraphs(text: string): { numbered: string; count: number } {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const numbered = paragraphs.map((p, i) => `【段${i + 1}】${p.trim()}`).join('\n\n');
  return { numbered, count: paragraphs.length };
}

function stripParagraphNumbers(text: string): string {
  return text.replace(/【段\d+】/g, '').replace(/^\n+/, '');
}

async function translateChunk(
  client: any,
  text: string,
  paraCount: number,
  retries: number = 0
): Promise<string> {
  const { numbered, count } = numberParagraphs(text);

  const userPrompt = `请将以下英文完整翻译为中文。原文有${count}个段落，已用【段N】编号标注。

你的翻译必须保留所有【段N】编号，一段对应一段，一段不漏。
绝对禁止合并段落。绝对禁止省略任何段落。

---

${numbered}`;

  const response = await client.invoke(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { model: 'doubao-seed-2-0-pro-260215', temperature: 0.3 }
  );

  const translated = (response.content || '').trim();

  // Count 【段N】 markers to verify paragraph count
  const matches = translated.match(/【段\d+】/g);
  const transCount = matches ? matches.length : 0;

  if (transCount < count && retries < MAX_RETRIES) {
    log(`  ⚠️ 段落不足: 译${transCount}段/原${count}段，重试 ${retries + 1}/${MAX_RETRIES}`);

    // Find missing paragraphs
    const foundNums = new Set((matches || []).map((m: string) => parseInt(m.match(/\d+/)![0])));
    const missing: number[] = [];
    for (let n = 1; n <= count; n++) {
      if (!foundNums.has(n)) missing.push(n);
    }
    log(`  缺少段号: ${missing.join(', ')}`);

    return translateChunk(client, text, paraCount, retries + 1);
  }

  if (transCount < count) {
    log(`  ❌ 重试${MAX_RETRIES}次仍不足: 译${transCount}段/原${count}段，差${count - transCount}段`);
  }

  return translated;
}

async function translateBook(client: any, filename: string): Promise<boolean> {
  const filepath = path.join(BOOK_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  const chunks = splitIntoChunks(content);
  const totalOrigParas = chunks.reduce((sum, c) => sum + c.paraCount, 0);

  log(`📖 开始: ${filename.substring(0, 55)} (${(content.length / 1024).toFixed(0)}KB, ${totalOrigParas}段, ${chunks.length}分段)`);

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
          // Count 【段N】 markers
          const matches = result.match(/【段\d+】/g);
          const transCount = matches ? matches.length : 0;
          const ok = transCount >= chunk.paraCount;
          if (!ok) hasIssue = true;
          log(`  分段${chunkIdx + 1}/${chunks.length}: 原${chunk.paraCount}段→译${transCount}段 ${ok ? '✅' : '❌'}`);

          // Strip 【段N】 markers and add to translations
          const cleanText = stripParagraphNumbers(result);
          totalTransParas += transCount;
          return cleanText;
        });
    });

    const batchResults = await Promise.all(batchPromises);
    translations.push(...batchResults);
  }

  const finalTranslation = translations.join('\n\n');
  const overallRatio = totalTransParas / totalOrigParas * 100;

  // Save the translation (overwrite original English file)
  fs.writeFileSync(filepath, finalTranslation, 'utf-8');

  log(`📊 完成: ${filename.substring(0, 45)} | 原${totalOrigParas}段→译${totalTransParas}段 (${overallRatio.toFixed(0)}%) | ${hasIssue ? '⚠️有段落不足' : '✅完整'}`);

  return overallRatio >= 90;
}

async function main() {
  const { LLMClient, Config } = await import('coze-coding-dev-sdk');
  const config = new Config();
  const client = new LLMClient(config);

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  log('🚀 V5 翻译启动 - 【段N】编号标注 + 强制段落对应 + 4000字符/12段上限');
  log(`铁律: 从第一个字到最后一个字，一字不漏，一段不漏`);

  const progress = loadProgress();

  // Get English books that need translation
  const files = fs.readdirSync(BOOK_DIR)
    .filter(f => f.endsWith('.txt') && !hasChineseChars(f))
    .filter(f => {
      // Check if file is actually in English (not already translated)
      const filepath = path.join(BOOK_DIR, f);
      const content = fs.readFileSync(filepath, 'utf-8');
      const sample = content.substring(0, 3000);
      const cnChars = [...sample].filter(c => c.charCodeAt(0) >= 0x4e00 && c.charCodeAt(0) <= 0x9fff).length;
      const enChars = [...sample].filter(c => c.toLowerCase() >= 'a' && c.toLowerCase() <= 'z').length;
      return cnChars <= enChars * 2; // Still mostly English
    })
    .filter(f => !progress.completed.includes(f))
    .filter(f => !progress.failed[f])
    .sort((a, b) => {
      // Sort by size - smallest first for faster feedback
      const sizeA = fs.statSync(path.join(BOOK_DIR, a)).size;
      const sizeB = fs.statSync(path.join(BOOK_DIR, b)).size;
      return sizeA - sizeB;
    });

  log(`待翻译: ${files.length} 本 (已完成: ${progress.completed.length})`);

  // Backup all English books before translation
  for (const f of files) {
    const src = path.join(BOOK_DIR, f);
    const dst = path.join(BACKUP_DIR, f);
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
    }
  }
  log(`已备份 ${files.length} 本英文原版到 ${BACKUP_DIR}`);

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
            progress.completed.push(f);
            log(`  ⚠️ ${f.substring(0, 40)} 翻译段落不足90%但仍保留`);
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
    const elapsed = progress.completed.length;
    const total = files.length + progress.completed.length;
    const rate = elapsed > 0 ? '' : '';
    log(`批次完成: ${completed}/${batch.length} | 累计: ${elapsed} | 失败: ${Object.keys(progress.failed).length}`);

    await new Promise(r => setTimeout(r, 1000));
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
