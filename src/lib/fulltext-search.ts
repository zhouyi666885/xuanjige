/**
 * 全文检索模块
 * 从本地 book-content/ 目录中的txt文件搜索相关段落
 * 用于将古籍原文注入AI提示词，提供更精准的引用依据
 * 
 * 核心原则：书籍从第一个字到最后一个字完整收录，绝不截断！
 */

import * as fs from 'fs';
import * as path from 'path';
import { saveBook as saveBookToS3, getBookContent as getBookContentFromS3, deleteBookFromS3, getAllBookNames } from './book-storage';
import {
  upsertBook as upsertBookToDb,
  getBookContent as getBookContentFromDb,
  deleteBook as deleteBookFromDb,
  listBooks as listBooksFromDb,
} from './book-repo';

// 数据库优先策略：所有书籍以 Supabase 为唯一真相源；本地 fs / S3 只是缓存层
let dbCachePrimed = false;

// 书籍内容缓存
let bookCache: Map<string, string> | null = null;
let bookNameList: string[] | null = null;
// 字数缓存（懒加载场景下，bookCache 的 value 可能是占位符 ''，
// 真正的字数需要从此处获取，由 loadBookCacheAsync 从 Supabase listBooks 填充）
let bookCharCountCache: Map<string, number> | null = null;

// ============ 学习状态系统 ============

/** 书籍学习状态 */
interface BookLearnStatus {
  learned: boolean;       // 是否已学习完成
  learnedAt: number | null; // 学习完成时间戳
  charCount: number;      // 字符数
  totalChapters: number;  // 总章节数
  learnedChapters: number; // 已学习章节数
  chapterStructure: string; // 章节结构类型（卦/章/卷/篇/部/节/回/品/门/诀/式/局）
  learnStartedAt: number | null; // 开始学习时间戳
}

// 学习状态缓存
let learnStatusCache: Map<string, BookLearnStatus> | null = null;

/** 获取学习状态文件路径 */
function getLearnStatusFilePath(): string {
  const dir = getBookContentDir();
  return path.join(dir, '..', 'book-learn-status.json');
}

/** 加载学习状态 */
function loadLearnStatus(): Map<string, BookLearnStatus> {
  if (learnStatusCache) return learnStatusCache;
  
  learnStatusCache = new Map();
  const filePath = getLearnStatusFilePath();
  
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const [name, status] of Object.entries(data)) {
        learnStatusCache.set(name, status as BookLearnStatus);
      }
    }
  } catch {
    // 文件损坏或不存在，从当前书籍列表重建
  }
  
  // 同步：已存在于知识库的书如果没有学习记录，标记为未学习（不能自动标记为已学习！）
  loadBookCache();
  if (bookNameList) {
    for (const name of bookNameList) {
      if (!learnStatusCache.has(name)) {
        const charCount = bookCache?.get(name)?.length || 0;
        const chapterInfo = parseChapterInfoFromContent(name);
        learnStatusCache.set(name, {
          learned: false, // 未经过4层AI深度学习，标记为未学习
          learnedAt: null,
          charCount,
          totalChapters: chapterInfo.totalChapters,
          learnedChapters: 0, // 还没学，已学章节数为0
          chapterStructure: chapterInfo.chapterStructure,
          learnStartedAt: null,
        });
      }
    }
  }
  
  // 保存同步后的状态
  saveLearnStatus();
  
  return learnStatusCache;
}

/** 保存学习状态到文件 */
function saveLearnStatus(): void {
  if (!learnStatusCache) return;
  
  const filePath = getLearnStatusFilePath();
  const dir = path.dirname(filePath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // 只读文件系统，忽略
    return;
  }
  
  const data: Record<string, BookLearnStatus> = {};
  for (const [name, status] of learnStatusCache) {
    data[name] = status;
  }
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // 写入失败不影响主流程
  }
}

/** 从书籍内容中解析章节信息 */
function parseChapterInfoFromContent(bookName: string): { totalChapters: number; chapterStructure: string } {
  loadBookCache();
  const content = bookCache?.get(bookName);
  if (!content) return { totalChapters: 0, chapterStructure: '章' };

  // 从元数据头部提取章节结构
  const structureMatch = content.match(/目录结构[：:]\s*(卦|章|卷|篇|部|节|回|品|门|诀|式|局)/);
  const chapterStructure = structureMatch ? structureMatch[1] : '章';

  // 从完整目录列表提取章节数
  const fullListMatch = content.match(/完整目录[：:]\s*\n([\s\S]*?)(?:\n\n|\n---)/);
  if (fullListMatch) {
    const lines = fullListMatch[1].split('\n').filter((l: string) => l.trim());
    return { totalChapters: lines.length, chapterStructure };
  }

  // 从目录结构行提取（如"共64卦"/"共81章"）
  const countMatch = content.match(/共(\d+)(卦|章|卷|篇|部|节|回|品|门|诀|式|局)/);
  if (countMatch) {
    return { totalChapters: parseInt(countMatch[1]), chapterStructure: countMatch[2] };
  }

  // 退而求其次：统计章节标题数量
  const chapterRegex = new RegExp(`第[一二三四五六七八九十百千零\\d]+${chapterStructure}`, 'g');
  const matches = content.match(chapterRegex);
  const totalChapters = matches ? [...new Set(matches)].length : 0;

  return { totalChapters, chapterStructure };
}

/** 标记书籍为开始学习（录入完成后调用） */
export function markBookAsLearned(bookName: string, charCount: number = 0, totalChapters: number = 0, chapterStructure: string = '章'): void {
  const statusMap = loadLearnStatus();
  const now = Date.now();
  statusMap.set(bookName, {
    learned: false, // 开始学习，尚未完成
    learnedAt: null,
    charCount,
    totalChapters,
    learnedChapters: 0, // 从0开始
    chapterStructure,
    learnStartedAt: now,
  });
  saveLearnStatus();
  console.log(`[学习] 《${bookName}》开始学习，共${totalChapters}${chapterStructure}，${charCount} 字`);
}

/** 更新书籍学习进度 */
export function updateBookLearnProgress(bookName: string, learnedChapters: number): void {
  const statusMap = loadLearnStatus();
  const status = statusMap.get(bookName);
  if (!status) return;

  status.learnedChapters = learnedChapters;
  
  // 学习完成
  if (status.totalChapters > 0 && learnedChapters >= status.totalChapters) {
    status.learned = true;
    status.learnedAt = Date.now();
    status.learnedChapters = status.totalChapters;
    console.log(`[学习] 《${bookName}》学习完成，共${status.totalChapters}${status.chapterStructure}`);
  }
  
  saveLearnStatus();
}

/** 学习进度条目 */
interface LearningProgressItem {
  name: string;
  learnedChapters: number;
  totalChapters: number;
  chapterStructure: string;
  learned: boolean;
  charCount: number;
}

/** 获取所有书籍的学习进度列表（只返回磁盘上实际存在的书籍） */
export function getLearningProgress(): LearningProgressItem[] {
  const statusMap = loadLearnStatus();
  const result: LearningProgressItem[] = [];

  // 只保留实际存在书籍文件的状态，清除已删除书籍的记录
  // 🔴 兜底：book-content 目录不存在时直接当作空目录处理（沙箱新部署/容器初次启动）
  let existingBooks: Set<string>;
  try {
    existingBooks = new Set(
      fs.readdirSync(getBookContentDir())
        .filter(f => f.endsWith('.txt'))
        .map(f => f.replace(/\.txt$/, ''))
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('[getLearningProgress] readdir 失败:', (e as Error).message);
    }
    existingBooks = new Set();
  }
  const deletedNames: string[] = [];
  for (const [name, status] of statusMap) {
    if (existingBooks.has(name)) {
      result.push({
        name,
        learnedChapters: status.learnedChapters,
        totalChapters: status.totalChapters,
        chapterStructure: status.chapterStructure,
        learned: status.learned,
        charCount: status.charCount,
      });
    } else {
      deletedNames.push(name);
    }
  }
  // 从缓存中清除已删除书籍的状态
  if (deletedNames.length > 0) {
    for (const name of deletedNames) {
      statusMap.delete(name);
    }
    saveLearnStatus();
  }

  return result;
}

/** 获取单本书的学习状态 */
export function getBookLearnStatus(bookName: string): BookLearnStatus | null {
  const statusMap = loadLearnStatus();
  return statusMap.get(bookName) || null;
}

/** 获取所有已学习书籍数量 */
export async function getLearnedBookCount(): Promise<{
  total: number;
  learned: number;
  learning: number;
  pending: number;
  learnedBookNames: string[];
  pendingBookNames: string[];
  totalChars: number;
}> {
  // 优先从缓存拿最新书目（已包含 Supabase + 本地合并结果）
  const stats = getBookStats();
  const allNames = stats.bookNames;
  const total = allNames.length;
  const totalChars = stats.totalChars;

  const learnedBookNames: string[] = [];
  const pendingBookNames: string[] = [];

  // ✅ 真相源单一化：从 Supabase `books` 表读 `learned=true`。
  //    这样 chat API truthBlock 与知识库 UI（也看 books.learned）完全一致——
  //    避免"知识库说已学习但 AI 说没学"的矛盾。
  //    定义："已学习"= 这本书的内容已录入知识库可检索（books.learned=true）。
  //    深度学习（book_tasks.learning_status='done'）是后台技术细节，不作为对用户的"已学习"判定。
  const dbLearnedSet = new Set<string>();
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supa = getSupabaseClient();
    const { data } = await supa.from('books').select('name, learned');
    if (data) {
      for (const row of data as Array<{ name: string; learned: boolean | null }>) {
        if (row.learned === true) dbLearnedSet.add(row.name);
      }
    }
  } catch {
    // db 不可用时退化为 0 已学完（宁可让 AI 说"还没学完"也不让它误说"已学完"）
  }

  for (const name of allNames) {
    if (dbLearnedSet.has(name)) {
      learnedBookNames.push(name);
    } else {
      pendingBookNames.push(name);
    }
  }

  return {
    total,
    learned: learnedBookNames.length,
    learning: 0, // learning 状态从 task-manager 取，这里只算 learned/pending
    pending: pendingBookNames.length,
    learnedBookNames,
    pendingBookNames,
    totalChars,
  };
}

// 书籍文件目录（生产/Serverless 环境使用/tmp，开发环境使用public）
function getBookContentDir(): string {
  const devDir = path.join(process.cwd(), 'public', 'book-content');
  const prodDir = '/tmp/book-content';

  // Netlify Functions / AWS Lambda 文件系统只读（/var/task），必须用 /tmp
  const isServerless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

  if (process.env.COZE_PROJECT_ENV === 'PROD' || isServerless) {
    if (fs.existsSync(prodDir)) return prodDir;
    try { fs.mkdirSync(prodDir, { recursive: true }); } catch { /* ignore */ }
    return prodDir;
  }

  if (fs.existsSync(devDir)) return devDir;
  return devDir;
}

/** 是否为生产环境 */
function isProduction(): boolean {
  return process.env.COZE_PROJECT_ENV === 'PROD';
}

// 书名关键词映射（用于根据用户问题匹配相关书籍）
const TOPIC_BOOK_MAP: Record<string, string[]> = {
  // 八字命理
  '八字': ['三命通会', '渊海子平', '滴天髓', '子平真诠', '穷通宝鉴', '神峰通考', '命理约言', '星学大成', '李虚中命书'],
  '四柱': ['三命通会', '渊海子平', '滴天髓', '子平真诠', '穷通宝鉴'],
  '命理': ['三命通会', '渊海子平', '滴天髓', '子平真诠', '穷通宝鉴', '神峰通考', '命理约言'],
  '用神': ['滴天髓', '穷通宝鉴', '子平真诠', '三命通会'],
  '格局': ['三命通会', '子平真诠', '渊海子平', '滴天髓'],
  '十神': ['三命通会', '渊海子平', '子平真诠'],
  '大运': ['三命通会', '滴天髓', '渊海子平'],
  '流年': ['三命通会', '滴天髓', '渊海子平'],
  '调候': ['穷通宝鉴', '滴天髓', '三命通会'],
  
  // 紫微斗数
  '紫微': ['紫微斗数全书', '星学大成'],
  '斗数': ['紫微斗数全书', '星学大成'],
  '命宫': ['紫微斗数全书'],
  '星曜': ['紫微斗数全书', '星学大成'],
  
  // 六爻
  '六爻': ['增删卜易', '卜筮正宗', '火珠林', '黄金策', '断易天机'],
  '起卦': ['增删卜易', '卜筮正宗'],
  '铜钱': ['增删卜易', '卜筮正宗'],
  '世应': ['增删卜易', '卜筮正宗'],
  
  // 梅花易数
  '梅花': ['梅花易数'],
  '易数': ['梅花易数'],
  '体用': ['梅花易数'],
  
  // 奇门遁甲
  '奇门': ['奇门遁甲全书', '太白阴经'],
  '遁甲': ['奇门遁甲全书'],
  '九宫': ['奇门遁甲全书'],
  '八门': ['奇门遁甲全书'],
  
  // 大六壬
  '六壬': ['大六壬'],
  '天将': ['大六壬'],
  '四课': ['大六壬'],
  
  // 风水
  '风水': ['撼龙经', '疑龙经', '天玉经', '葬书', '青囊经', '雪心赋', '发微论'],
  '阳宅': ['阳宅三要', '八宅明镜'],
  '阴宅': ['撼龙经', '疑龙经', '葬书'],
  '飞星': ['沈氏玄空学'],
  '玄空': ['沈氏玄空学', '天玉经'],
  '龙脉': ['撼龙经', '疑龙经', '葬书'],
  
  // 面相
  '面相': ['神相全编', '麻衣神相', '冰鉴', '月波洞中记'],
  '五官': ['神相全编', '麻衣神相'],
  '气色': ['神相全编', '月波洞中记'],
  
  // 手相
  '手相': ['手相大全', '神相全编'],
  '掌纹': ['手相大全'],
  
  // 姓名学
  '姓名': ['姓名学', '五格剖象'],
  '取名': ['姓名学', '五格剖象'],
  '笔画': ['姓名学', '五格剖象'],
  
  // 易经
  '易经': ['易传', '周易参同契', '焦氏易林'],
  '卦象': ['易传', '梅花易数'],
  '爻辞': ['易传'],
  
  // 道家
  '道家': ['老子', '庄子', '列子', '道德经', '黄庭经', '悟真篇', '阴符经', '抱朴子', '云笈七签'],
  '修炼': ['黄庭经', '悟真篇', '周易参同契'],
  '内丹': ['悟真篇', '周易参同契', '黄庭经'],
  '金丹': ['悟真篇', '周易参同契'],
  
  // 佛家
  '佛': ['心经', '金刚经', '六祖坛经', '楞严经', '五灯会元', '无量寿经'],
  '禅': ['六祖坛经', '五灯会元'],
  '般若': ['心经', '金刚经'],
  
  // 中医
  '中医': ['黄帝内经', '伤寒论', '金匮要略', '难经', '本草纲目', '温病条辨'],
  '针灸': ['针灸甲乙经', '针灸大成'],
  '脉': ['濒湖脉学', '黄帝内经'],
  '药': ['本草纲目', '神农本草经', '食疗本草'],
  
  // 儒家
  '儒': ['论语', '孟子', '大学', '中庸', '荀子', '礼记'],
  '仁': ['论语', '孟子'],
  '礼': ['礼记', '周礼', '仪礼'],
  '孝': ['孝经', '论语'],
  
  // 兵家
  '兵': ['孙子兵法', '三十六计', '六韬', '三略', '吴子', '尉缭子'],
  '战争': ['孙子兵法', '六韬', '三略'],
  '谋略': ['孙子兵法', '三十六计', '鬼谷子'],
  
  // 诸子百家
  '墨': ['墨子'],
  '法': ['韩非子', '商君书'],
  '名': ['公孙龙子'],
  '纵横': ['鬼谷子'],
  
  // 占卜/灵棋
  '灵棋': ['灵棋经'],
  '占卜': ['灵棋经', '增删卜易', '卜筮正宗'],
  '卜筮': ['灵棋经', '增删卜易', '卜筮正宗'],
  
  // 相术
  '相术': ['神相全编', '麻衣神相', '冰鉴', '月波洞中记', '柳庄相法'],
  '相法': ['神相全编', '麻衣神相', '柳庄相法'],
  
  // 神煞
  '神煞': ['三命通会', '星学大成', '协纪辨方'],
  '择日': ['协纪辨方', '钦定协纪辨方'],
  '择吉': ['协纪辨方', '钦定协纪辨方'],
  
  // 太乙
  '太乙': ['太乙金镜式'],
  
  // 堪舆
  '堪舆': ['撼龙经', '疑龙经', '天玉经', '葬书', '青囊经'],
  '地理': ['撼龙经', '疑龙经', '天玉经', '葬书', '青囊经', '雪心赋'],
  
  // 灵学/玄学
  '玄学': ['老子', '庄子', '周易', '列子'],
  '阴阳': ['阴阳'],
  '五行': ['五行'],
};

// 搜索结果中的段落
export interface BookPassage {
  bookName: string;
  chapter: string;
  content: string;
  relevance: number; // 0-1
}

/**
 * 加载所有书籍内容到缓存（完整全文，不截断）
 * 生产环境：从S3拉取书名列表，按需获取内容
 * 开发环境：从本地public/book-content/读取
 */
function loadBookCache(): void {
  if (bookCache) return;
  
  bookCache = new Map();
  bookNameList = [];
  
  const dir = getBookContentDir();
  if (!fs.existsSync(dir)) {
    // 生产环境目录不存在时，尝试创建
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    return;
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
  
  for (const file of files) {
    const bookName = file.replace('.txt', '');
    const filePath = path.join(dir, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // 完整全文存储，不做任何截断！
      bookCache.set(bookName, content);
      bookNameList.push(bookName);
    } catch {
      // Skip unreadable files
    }
  }
}

/** 获取本地+云端书籍总数和书名列表（不加载全文内容，仅读取文件名 / Supabase 缓存）
 * - 优先返回云端 bookNameList（loadBookCacheAsync 已拉过的缓存）
 * - 兜底用本地 fs 文件名，确保开发期也能用
 */
export function getLocalBookInfo(): { total: number; bookNames: string[] } {
  const names = new Set<string>();
  // 1. 云端缓存（saturated by loadBookCacheAsync）
  if (bookNameList && bookNameList.length > 0) {
    for (const n of bookNameList) names.add(n);
  }
  // 2. 本地 fs 文件名兜底
  const dir = getBookContentDir();
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
    for (const f of files) names.add(f.replace('.txt', ''));
  }
  const bookNames = Array.from(names);
  return { total: bookNames.length, bookNames };
}

/** 清除所有缓存，强制下次调用时重新从磁盘加载 */
export function invalidateCache(): void {
  bookCache = null;
  bookNameList = null;
  bookCharCountCache = null;
  dbCachePrimed = false;
  learnStatusCache = null;
}

/** 标记书籍学习状态（供book-task-manager调用） */
export function markBookLearned(bookName: string, learned: boolean): void {
  const cache = loadLearnStatus();
  if (cache.has(bookName)) {
    const status = cache.get(bookName)!;
    status.learned = learned;
    status.learnedAt = learned ? Date.now() : null;
    if (learned && status.totalChapters) {
      status.learnedChapters = status.totalChapters;
    }
  } else {
    cache.set(bookName, {
      learned,
      learnedAt: learned ? Date.now() : null,
      charCount: 0,
      totalChapters: 0,
      learnedChapters: 0,
      chapterStructure: '',
      learnStartedAt: null,
    });
  }
  // 持久化
  learnStatusCache = cache;
  const statusPath = path.join(getBookContentDir(), '..', 'book-learn-status.json');
  try {
    const obj: Record<string, BookLearnStatus> = {};
    for (const [k, v] of cache) obj[k] = v;
    fs.writeFileSync(statusPath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

/**
 * 异步加载书籍缓存（生产环境从S3拉取）
 * 在生产环境中，启动时从S3拉取书名列表，按需获取内容
 */
/**
 * 强制把打包的种子数据同步到 Supabase（不论字数差异，强制覆盖）
 * 用于"部署后数据丢失"的一键恢复
 */
export async function forceSyncSeedDataToDb(): Promise<{ synced: number; total: number }> {
  try {
    type SeedItem = { name: string; content: string; chapters: number; charCount: number };
    const seeds: SeedItem[] = [];
    try {
      const seedMod = await import('./seed-data/books');
      // 懒加载：只在需要同步时才读 fs，避免常驻 heap
      const loaded = seedMod.getSeedBooks();
      for (const s of loaded) {
        seeds.push({ name: s.name, content: s.content, chapters: s.chapters, charCount: s.charCount });
      }
    } catch (e) {
      console.warn('[全文检索] forceSync 加载 SEED_BOOKS 失败:', e);
    }
    if (seeds.length === 0) return { synced: 0, total: 0 };

    const { books: dbBooksArr } = await listBooksFromDb({ page: 1, pageSize: 200 });
    const dbMap = new Map<string, { name: string; char_count: number; category: string; source: string }>(dbBooksArr.map((b: any) => [b.name, b as { name: string; char_count: number; category: string; source: string }]));

    // 读取墓碑列表——被用户手动删除的书不允许被种子自愈恢复
    const tombstoneNames = new Set<string>();
    try {
      const { listTombstones } = await import('./book-repo');
      const { deletedNames } = await listTombstones();
      for (const n of deletedNames) tombstoneNames.add(n);
      // 也检查 kind='book_name' 的墓碑（旧格式）
      const { addTombstone: _unused } = await import('./book-repo'); // verify import works
      void _unused;
    } catch { /* ignore */ }

    let synced = 0;
    for (const seed of seeds) {
      // 跳过墓碑书——用户已删除，不允许种子自愈恢复
      if (tombstoneNames.has(seed.name)) continue;
      const dbBook = dbMap.get(seed.name);
      // 强制覆盖（即使云端已存在）
      if (!dbBook || seed.charCount > dbBook.char_count) {
        await upsertBookToDb({
          name: seed.name,
          category: dbBook?.category || '未分类',
          content: seed.content,
          char_count: seed.charCount,
          total_chapters: seed.chapters,
          chapter_structure: '章',
          source: dbBook?.source || '本地录入',
        });
        synced++;
        console.log(`[全文检索] forceSync: ${seed.name} (${seed.charCount} 字)，覆盖云端 ${dbBook?.char_count ?? 0} 字`);
      }
    }
    // 清空缓存
    bookNameList = [];
    if (bookCache) bookCache.clear();
    if (bookCharCountCache) bookCharCountCache.clear();
    dbCachePrimed = false;
    return { synced, total: seeds.length };
  } catch (err) {
    console.error('[全文检索] forceSyncSeedDataToDb 失败:', err);
    return { synced: 0, total: 0 };
  }
}

/**
 * 检测本地 public/book-content/*.txt 是否比 Supabase 更完整，自动同步到云端
 * 解决：开发环境录入的完整版在部署后变成残次版的问题
 *
 * 数据源优先级：
 * 1. 打包种子数据（SEED_BOOKS，无 fs 依赖，部署后100%可用）
 * 2. 候选 fs 路径（开发环境调试用）
 */
async function syncSeedDataToDb(): Promise<void> {
  try {
    // 0) 加载墓碑名单：已删除的书不再自动恢复
    let tombstoneNames: Set<string> = new Set();
    try {
      const { listTombstones } = await import('./book-repo');
      const { deletedNames } = await listTombstones();
      tombstoneNames = deletedNames;
      if (tombstoneNames.size > 0) {
        console.log(`[全文检索] syncSeedDataToDb: 墓碑名单 ${tombstoneNames.size} 本`, [...tombstoneNames]);
      }
    } catch { /* 墓碑加载失败不阻塞 */ }

    // 1) 收集种子数据：先从代码常量取（部署后唯一稳定源）
    type SeedItem = { name: string; content: string; chapters: number; charCount: number };
    const seeds: SeedItem[] = [];
    try {
      const seedMod = await import('./seed-data/books');
      const loaded = seedMod.getSeedBooks();
      for (const s of loaded) {
        seeds.push({ name: s.name, content: s.content, chapters: s.chapters, charCount: s.charCount });
      }
    } catch (e) {
      console.warn('[全文检索] 加载内置 SEED_BOOKS 失败:', e);
    }
    
    // 2) 再从候选 fs 目录补充（开发期使用）
    const candidates = [
      path.join(process.cwd(), 'public', 'book-content'),
      path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'public', 'book-content'),
      path.join(process.cwd(), '..', 'public', 'book-content'),
      path.join(process.cwd(), '.next', 'standalone', 'public', 'book-content'),
    ];
    const seenNames = new Set(seeds.map(s => s.name));
    for (const c of candidates) {
      try {
        if (!fs.existsSync(c)) continue;
        const list = fs.readdirSync(c).filter(f => f.endsWith('.txt'));
        for (const f of list) {
          const name = f.replace(/\.txt$/, '');
          if (seenNames.has(name)) continue;
          const content = fs.readFileSync(path.join(c, f), 'utf-8');
          const chapterMatches = content.match(/^第[一二三四五六七八九十百千零0-9]+(章|回|篇|卷)/gm);
          const chapters = chapterMatches?.length ?? 0;
          seeds.push({ name, content, chapters, charCount: content.length });
          seenNames.add(name);
        }
      } catch { /* ignore */ }
    }
    
    if (seeds.length === 0) {
      console.log('[全文检索] syncSeedDataToDb: 无种子数据（SEED_BOOKS 空 + fs 候选路径均无文件）');
      return;
    }
    console.log(`[全文检索] syncSeedDataToDb: 共收集 ${seeds.length} 本种子书`);

    const { books: dbBooksArr } = await listBooksFromDb({ page: 1, pageSize: 200 });
    const dbMap = new Map<string, { name: string; char_count: number; category: string; source: string }>(dbBooksArr.map((b: any) => [b.name, b as { name: string; char_count: number; category: string; source: string }]));

    let synced = 0;
    for (const seed of seeds) {
      // 🔴 跳过已立墓碑的书（用户明确删除过的，不再自动恢复）
      if (tombstoneNames.has(seed.name)) {
        console.log(`[全文检索] syncSeedDataToDb: 跳过已删除的书 ${seed.name}（墓碑）`);
        continue;
      }
      const dbBook = dbMap.get(seed.name);
      // 本地种子比云端更完整（字数差 > 10%），或云端不存在
      if (!dbBook || (seed.charCount > dbBook.char_count * 1.1)) {
        await upsertBookToDb({
          name: seed.name,
          category: dbBook?.category || '未分类',
          content: seed.content,
          char_count: seed.charCount,
          total_chapters: seed.chapters,
          chapter_structure: '章',
          source: dbBook?.source || '本地录入',
        });
        synced++;
        console.log(`[全文检索] 同步 seed → Supabase: ${seed.name} (${seed.charCount} 字, ${seed.chapters} 章)，覆盖云端 ${dbBook?.char_count ?? 0} 字`);
      }
    }
    if (synced > 0) {
      // 清空缓存，下次查询会从云端重新加载
      bookNameList = [];
      if (bookCache) bookCache.clear();
      if (bookCharCountCache) bookCharCountCache.clear();
      dbCachePrimed = false;
      console.log(`[全文检索] syncSeedDataToDb: 共同步 ${synced} 本书到 Supabase`);
    }
  } catch (err) {
    console.error('[全文检索] syncSeedDataToDb 失败:', err);
  }
}

export async function loadBookCacheAsync(): Promise<void> {
  if (bookCache && bookCache.size > 0 && dbCachePrimed) return; // 已有缓存

  bookCache = new Map();
  bookNameList = [];

  // 优先策略：从 Supabase（云端持久化）拉取所有书籍
  // 这是开发/生产共享的唯一真相源，确保扣子录入后部署到微信也能看到
  try {
    // 用 listBooks 拿到 name + char_count（一次查询拿全元数据）
    const dbBooks = await listBooksFromDb({ pageSize: 10000 });
    bookCharCountCache = new Map();
    for (const b of dbBooks.books) {
      bookNameList.push(b.name);
      bookCache.set(b.name, ''); // 占位，全文按需懒加载
      bookCharCountCache.set(b.name, b.char_count ?? 0);
    }
    dbCachePrimed = true;
    console.log(`[全文检索] 已从 Supabase 加载 ${dbBooks.books.length} 本书的目录（含字数）`);
    // 自动检测本地 seed 文件比 Supabase 更完整的情况，自动同步到云端
    await syncSeedDataToDb();
    // 同步合并本地 fs 中的书目（防止本地有但 db 没的情况）
    try {
      const dir = getBookContentDir();
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
        for (const file of files) {
          const localName = file.replace('.txt', '');
          if (!bookCache.has(localName)) {
            bookCache.set(localName, '');
            bookNameList.push(localName);
            // 本地兜底字数：读文件长度
            try {
              const content = fs.readFileSync(path.join(dir, file), 'utf-8');
              bookCharCountCache.set(localName, content.length);
            } catch { /* 失败用 0 */ }
          }
        }
      }
    } catch { /* 本地补充失败可以忽略 */ }
    // 防御性去重：避免 HMR 闭包污染或重复加载
    bookNameList = Array.from(new Set(bookNameList));
    return;
  } catch (err) {
    console.error('[全文检索] 从 Supabase 加载书目失败，回退到本地/S3:', err);
  }

  if (isProduction()) {
    // 生产环境：从S3获取书名列表
    try {
      const allBooks = await getAllBookNames();
      for (const bookName of allBooks) {
        bookNameList.push(bookName);
        bookCache.set(bookName, ''); // 占位
      }
      console.log(`[全文检索] 生产环境：从S3获取到 ${allBooks.length} 本书名`);
    } catch (err) {
      console.error('[全文检索] 生产环境从S3获取书名列表失败:', err);
    }
  } else {
    // 开发环境：同步加载本地文件
    loadBookCache();
  }
}

/**
 * 获取单本书的内容（生产环境从S3按需拉取）
 */
async function getBookContentLazy(bookName: string): Promise<string | null> {
  // 先检查缓存中是否有实际内容
  const cached = bookCache?.get(bookName);
  if (cached && cached.length > 0) return cached;

  // 优先策略：从 Supabase 取（统一真相源，跨环境共享）
  try {
    const content = await getBookContentFromDb(bookName);
    if (content) {
      bookCache?.set(bookName, content);
      // 同步落本地 fs 作为加速缓存（开发环境 public/、生产环境 /tmp）
      try {
        const dir = getBookContentDir();
        const safeName = bookName.replace(/[<>:"/\\|?*]/g, '_').trim();
        const filePath = path.join(dir, `${safeName}.txt`);
        if (!fs.existsSync(filePath)) {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, content, 'utf-8');
        }
      } catch { /* ignore cache write errors */ }
      return content;
    }
  } catch (err) {
    console.error(`[全文检索] 从 Supabase 取《${bookName}》失败，回退本地/S3:`, err);
  }

  if (isProduction()) {
    // 生产环境：从S3获取
    try {
      const content = await getBookContentFromS3(bookName);
      if (content) {
        bookCache?.set(bookName, content);
        // 同时缓存到本地/tmp加速后续访问
        const dir = getBookContentDir();
        const safeName = bookName.replace(/[<>:"/\\|?*]/g, '_').trim();
        const filePath = path.join(dir, `${safeName}.txt`);
        try { fs.writeFileSync(filePath, content, 'utf-8'); } catch { /* ignore */ }
        return content;
      }
    } catch (err) {
      console.error(`[全文检索] 从S3获取《${bookName}》失败:`, err);
    }
  }

  return cached || null;
}

/**
 * 根据用户消息确定要搜索的书籍（多层级匹配）
 */
function getRelevantBooks(message: string): string[] {
  const relevantBooks = new Set<string>();
  
  // 第一层：关键词精确匹配 TOPIC_BOOK_MAP
  for (const [keyword, books] of Object.entries(TOPIC_BOOK_MAP)) {
    if (message.includes(keyword)) {
      const bookList = Array.isArray(books) ? books : [books];
      for (const book of bookList) {
        // 模糊匹配：书名包含关键词或关键词包含书名
        for (const cachedName of bookNameList || []) {
          if (cachedName.includes(book) || book.includes(cachedName)) {
            relevantBooks.add(cachedName);
          }
        }
      }
    }
  }
  
  return Array.from(relevantBooks);
}

/**
 * 在文本中搜索关键词，返回包含关键词的段落
 * @param text 完整文本
 * @param keywords 搜索关键词
 * @param maxPassages 最大返回段落数（0=不限制，返回全部）
 */
function searchInText(text: string, keywords: string[], maxPassages: number = 0): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const results: { text: string; score: number }[] = [];
  
  for (const para of paragraphs) {
    if (para.trim().length < 10) continue; // 跳过太短的段落
    
    let score = 0;
    for (const kw of keywords) {
      try {
        const count = (para.match(new RegExp(kw, 'g')) || []).length;
        score += count;
      } catch {
        // Skip invalid regex
      }
    }
    
    if (score > 0) {
      results.push({ text: para.trim(), score });
    }
  }
  
  // 按相关度排序
  results.sort((a, b) => b.score - a.score);
  
  // maxPassages=0 表示不限制，返回全部
  if (maxPassages > 0) {
    return results.slice(0, maxPassages).map(r => r.text);
  }
  return results.map(r => r.text);
}

/**
 * 从用户消息中提取搜索关键词（更全面）
 */
// 同义词映射表（用户常用词 → 古籍中的同义表达）
const SYNONYM_MAP: Record<string, string[]> = {
  '事业': ['官禄', '功名', '仕途', '官运', '事业', '求职', '升迁', '功名'],
  '财运': ['财帛', '财星', '求财', '偏财', '正财', '财运', '破财', '纳财'],
  '婚姻': ['配偶', '姻缘', '夫妻', '红鸾', '天喜', '桃花', '合婚', '嫁娶'],
  '健康': ['疾厄', '疾病', '寿元', '身体', '健康', '灾厄', '血光'],
  '学业': ['功名', '科举', '文昌', '文运', '学业', '考试', '学堂'],
  '性格': ['性情', '心性', '品性', '性格', '禀性'],
  '子女': ['子女', '子息', '儿女', '后代', '嗣续'],
  '父母': ['父母', '六亲', '椿萱', '双亲'],
  '兄弟': ['兄弟', '兄友', '比劫', '手足'],
  '出行': ['出行', '远行', '迁徙', '出行', '行旅'],
  '官司': ['官非', '诉讼', '刑狱', '口舌', '官司'],
  '寿命': ['寿元', '寿命', '天年', '长生'],
  '风水': ['堪舆', '地理', '宅运', '阴宅', '阳宅', '风水'],
  '面相': ['相法', '面相', '五官', '气色', '三停'],
  '手相': ['掌相', '手相', '掌纹', '手纹'],
  '工作': ['官禄', '事业', '职业', '工作'],
  '恋爱': ['桃花', '姻缘', '红鸾', '恋爱'],
  '投资': ['求财', '偏财', '投资', '财运'],
  '考试': ['功名', '文昌', '科举', '考试'],
  '搬家': ['迁徙', '移居', '搬家', '入宅'],
  '运势': ['运程', '运气', '流年', '大运', '运势'],
  '命运': ['命理', '天命', '命数', '命运'],
  '赚钱': ['求财', '财帛', '谋财', '赚钱'],
  '离婚': ['破婚', '丧偶', '刑克', '离异'],
  '小人': ['劫煞', '刑害', '是非', '小人'],
};

function extractSearchKeywords(message: string): string[] {
  const keywords: string[] = [];
  const expandedKeywords = new Set<string>();
  
  // 命理核心术语
  const terms = [
    '日主', '旺衰', '用神', '格局', '正官', '偏官', '正印', '偏印', '正财', '偏财',
    '食神', '伤官', '比肩', '劫财', '羊刃', '禄', '墓', '绝', '长生', '帝旺',
    '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
    '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
    '天干', '地支', '藏干', '五行', '金木水火土',
    '冲', '合', '刑', '害', '破', '会', '化',
    '太极', '紫微', '天府', '太阳', '太阴', '贪狼', '巨门', '相', '梁', '曲', '昌', '杀', '破',
    '乾', '坤', '震', '巽', '坎', '离', '艮', '兑',
    '八卦', '乾坤', '阴阳',
    // 补充更多关键词
    '命理', '八字', '四柱', '斗数', '六爻', '梅花', '奇门', '遁甲', '六壬',
    '风水', '面相', '手相', '占卜', '起卦', '卦象', '爻辞',
    '佛', '道', '禅', '儒', '易', '丹', '仙',
    '修真', '内丹', '外丹', '金丹', '炼丹',
    '符箓', '咒语', '法术',
    '黄帝内经', '本草', '伤寒', '针灸',
    '兵法', '谋略',
  ];
  
  for (const term of terms) {
    if (message.includes(term)) {
      keywords.push(term);
    }
  }
  
  // 如果没有匹配到术语，用消息中的中文词组（2-4字）作为关键词
  if (keywords.length === 0) {
    const chineseWords = message.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    keywords.push(...chineseWords.slice(0, 8));
  }
  
  // 同义词扩展：遍历同义词映射，如果用户消息中包含某个词，就追加其同义词
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (message.includes(key)) {
      for (const syn of synonyms) {
        if (!keywords.includes(syn)) {
          expandedKeywords.add(syn);
        }
      }
    }
  }
  
  // 将扩展的同义词追加到关键词列表
  const expanded = Array.from(expandedKeywords);
  if (expanded.length > 0) {
    keywords.push(...expanded.slice(0, 12));
  }
  
  return keywords;
}

/**
 * 全文检索：从本地txt文件中搜索相关段落
 * 
 * 重要：此函数不再对返回内容做任何字符数截断！
 * 所有书籍从第一个字到最后一个字完整收录。
 * 
 * @param message 用户消息
 * @param maxBooks 最多搜索多少本书（0=不限制）
 * @param maxPassagesPerBook 每本书最多返回多少段落（0=不限制，返回全部相关段落）
 * @param maxTotalChars 返回内容的最大总字符数（0=不限制）
 */
export function searchFullText(
  message: string,
  maxBooks: number = 0,
  maxPassagesPerBook: number = 0,
  maxTotalChars: number = 0
): BookPassage[] {
  loadBookCache();
  
  if (!bookCache || !bookNameList) return [];
  
  // 铁律：maxBooks=0 时遍历所有书籍，不限定范围！
  // 先确定相关书籍（优先搜索），再补充剩余全部书籍
  const relevantBookNames = new Set(getRelevantBooks(message));
  
  // 从缓存中查找实际存在的相关书籍
  const relevantAvailable: string[] = [];
  for (const name of relevantBookNames) {
    if (bookCache.has(name)) {
      relevantAvailable.push(name);
    }
  }
  
  // 模糊匹配：从所有书籍名中补充匹配
  const msgKeywords = message.replace(/[，。！？、：；""''《》\s]/g, '').split('').filter(c => c.charCodeAt(0) > 0x4e00);
  for (const bookName of bookNameList) {
    if (relevantAvailable.includes(bookName)) continue; // 已有的跳过
    for (const kw of msgKeywords) {
      if (bookName.includes(kw)) {
        relevantAvailable.push(bookName);
        break;
      }
    }
  }
  
  // 最终搜索列表：相关书籍优先 + 所有其他书籍（maxBooks=0时遍历全部）
  let booksToSearch: string[];
  if (maxBooks === 0) {
    // 不限制：相关书籍在前，其余所有书籍在后，确保全部遍历
    const otherBooks = (bookNameList || []).filter((n: string) => !relevantAvailable.includes(n));
    booksToSearch = [...relevantAvailable, ...otherBooks];
  } else {
    booksToSearch = relevantAvailable.slice(0, maxBooks);
  }
  
  // 从用户消息中提取搜索关键词
  const searchKeywords = extractSearchKeywords(message);
  
  const allPassages: BookPassage[] = [];
  let totalChars = 0;
  
  for (const bookName of booksToSearch) {
    const fullText = bookCache.get(bookName);
    if (!fullText) continue;
    
    // 搜索相关段落
    const passages = searchInText(fullText, searchKeywords, maxPassagesPerBook);
    
    for (const passage of passages) {
      // maxTotalChars=0 表示不限制字符数
      if (maxTotalChars > 0 && totalChars + passage.length > maxTotalChars) break;
      
      allPassages.push({
        bookName,
        chapter: '',
        content: passage,
        relevance: 1.0,
      });
      
      totalChars += passage.length;
    }
    
    if (maxTotalChars > 0 && totalChars >= maxTotalChars) break;
  }
  
  return allPassages;
}

/**
 * 异步版全文检索（生产环境使用S3按需获取书籍内容）
 * 开发环境直接走同步缓存，生产环境从S3按需拉取
 */
export async function searchFullTextAsync(
  message: string,
  maxBooks: number = 0,
  maxPassagesPerBook: number = 0,
  maxTotalChars: number = 0
): Promise<BookPassage[]> {
  // 确保缓存已加载
  await loadBookCacheAsync();
  
  if (!bookCache || !bookNameList) return [];
  
  // 铁律：maxBooks=0 时遍历所有书籍，不限定范围！
  const relevantBookNames = new Set(getRelevantBooks(message));
  
  const relevantAvailable: string[] = [];
  for (const name of relevantBookNames) {
    if (bookCache.has(name)) {
      relevantAvailable.push(name);
    }
  }
  
  // 模糊匹配
  const msgKeywords = message.replace(/[，。！？、：；""''《》\s]/g, '').split('').filter(c => c.charCodeAt(0) > 0x4e00);
  for (const bookName of bookNameList) {
    if (relevantAvailable.includes(bookName)) continue;
    for (const kw of msgKeywords) {
      if (bookName.includes(kw)) {
        relevantAvailable.push(bookName);
        break;
      }
    }
  }
  
  let booksToSearch: string[];
  if (maxBooks === 0) {
    const otherBooks = (bookNameList || []).filter((n: string) => !relevantAvailable.includes(n));
    booksToSearch = [...relevantAvailable, ...otherBooks];
  } else {
    booksToSearch = relevantAvailable.slice(0, maxBooks);
  }
  
  const searchKeywords = extractSearchKeywords(message);
  const allPassages: BookPassage[] = [];
  let totalChars = 0;
  
  for (const bookName of booksToSearch) {
    // 按需获取书籍内容（生产环境从S3拉取，开发环境从本地缓存）
    const fullText = await getBookContentLazy(bookName);
    if (!fullText) continue;
    
    const passages = searchInText(fullText, searchKeywords, maxPassagesPerBook);
    
    for (const passage of passages) {
      if (maxTotalChars > 0 && totalChars + passage.length > maxTotalChars) break;
      
      allPassages.push({
        bookName,
        chapter: '',
        content: passage,
        relevance: 1.0,
      });
      
      totalChars += passage.length;
    }
    
    if (maxTotalChars > 0 && totalChars >= maxTotalChars) break;
  }
  
  return allPassages;
}

/**
 * 异步版获取指定书籍完整全文（生产环境从S3获取）
 */
export async function getBookFullTextAsync(bookName: string): Promise<string | null> {
  await loadBookCacheAsync();
  return getBookContentLazy(bookName);
}

/**
 * 获取指定书籍的完整全文
 * 从第一个字到最后一个字，绝不截断！
 * 
 * @param bookName 书名（不含.txt后缀）
 * @returns 完整书籍文本，如果书不存在返回null
 */
export function getBookFullText(bookName: string): string | null {
  loadBookCache();
  
  if (!bookCache) return null;
  
  // 精确匹配
  if (bookCache.has(bookName)) {
    return bookCache.get(bookName)!;
  }
  
  // 模糊匹配：书名包含或被包含
  for (const [name, content] of bookCache.entries()) {
    if (name.includes(bookName) || bookName.includes(name)) {
      return content;
    }
  }
  
  // 本地未命中 → 异步从S3获取（同步返回null，下次请求时缓存已就绪）
  getBookContentFromS3(bookName).then((content: string | null) => {
    if (content) {
      // 加入缓存，下次可直接命中
      bookCache?.set(bookName, content);
      if (bookNameList && !bookNameList.includes(bookName)) {
        bookNameList.push(bookName);
      }
      console.log(`[S3] 从云存储获取《${bookName}》成功，已加入本地缓存`);
    }
  }).catch((err: unknown) => {
    console.error(`[S3] 从云存储获取《${bookName}》失败:`, err);
  });
  
  return null;
}

/**
 * 搜索书籍：根据用户消息中的书名关键词，返回匹配的书籍列表
 * 用于当用户问"帮我查XX书"时定位具体书籍
 */
export function findBooksByName(query: string): { name: string; size: number }[] {
  loadBookCache();
  
  if (!bookCache || !bookNameList) return [];
  
  const results: { name: string; size: number }[] = [];
  const queryLower = query.toLowerCase();
  
  for (const name of bookNameList) {
    if (name.includes(query) || query.includes(name) || name.toLowerCase().includes(queryLower)) {
      const content = bookCache.get(name) || '';
      results.push({ name, size: content.length });
    }
  }
  
  return results;
}

/**
 * 格式化全文检索结果为文本（不截断）
 */
export function formatFullTextResults(passages: BookPassage[]): string {
  if (passages.length === 0) return '';
  
  const grouped = new Map<string, string[]>();
  for (const p of passages) {
    if (!grouped.has(p.bookName)) {
      grouped.set(p.bookName, []);
    }
    grouped.get(p.bookName)!.push(p.content);
  }
  
  const parts: string[] = [];
  for (const [bookName, contents] of grouped) {
    parts.push(`【${bookName}原文摘录】`);
    for (const c of contents) {
      parts.push(c);
    }
  }
  
  return parts.join('\n\n');
}

/**
 * 获取已加载的书籍数量和总字符数
 */
export function getBookStats(): { bookCount: number; totalChars: number; bookNames: string[] } {
  loadBookCache();
  
  if (!bookCache || !bookNameList) {
    return { bookCount: 0, totalChars: 0, bookNames: [] };
  }
  
  // 防御性去重：避免 HMR 闭包污染或并发加载导致 bookNameList 出现重复
  const uniqueNames = Array.from(new Set(bookNameList));
  if (uniqueNames.length !== bookNameList.length) {
    bookNameList = uniqueNames;
  }

  // 字数计算：
  // 1) 优先用 bookCharCountCache（Supabase listBooks 返回的真实 char_count）
  // 2) 兜底用 bookCache 中的内容长度（仅在已懒加载过全文时不为 0）
  let totalChars = 0;
  for (const name of uniqueNames) {
    const cached = bookCharCountCache?.get(name) ?? 0;
    if (cached > 0) {
      totalChars += cached;
      continue;
    }
    const content = bookCache.get(name) ?? '';
    totalChars += content.length;
  }

  return {
    bookCount: uniqueNames.length,
    totalChars,
    bookNames: uniqueNames,
  };
}

/**
 * 获取知识库详细统计信息（供AI回答用户关于知识库的问题）
 * 包括：总书数、总字符数、英文书翻译状态、完整性检查
 */
export async function getDetailedBookStats(): Promise<{
  bookCount: number;
  totalChars: number;
  chineseBookCount: number;
  englishBookCount: number;
  englishTranslatedCount: number;
  englishUntranslatedCount: number;
  avgCharsPerBook: number;
  minChars: number;
  maxChars: number;
  booksUnder1000Chars: number;
  sampleBooks: { name: string; chars: number; language: string }[];
  learned: number;
  pending: number;
  learnedBookNames: string[];
  pendingBookNames: string[];
}> {
  loadBookCache();
  
  if (!bookCache || !bookNameList) {
    return {
      bookCount: 0, totalChars: 0, chineseBookCount: 0,
      englishBookCount: 0, englishTranslatedCount: 0, englishUntranslatedCount: 0,
      avgCharsPerBook: 0, minChars: 0, maxChars: 0, booksUnder1000Chars: 0,
      sampleBooks: [], learned: 0, pending: 0, learnedBookNames: [], pendingBookNames: [],
    };
  }
  
  let totalChars = 0;
  let chineseBookCount = 0;
  let englishBookCount = 0;
  let englishTranslatedCount = 0;
  let englishUntranslatedCount = 0;
  let minChars = Infinity;
  let maxChars = 0;
  let booksUnder1000Chars = 0;
  const sampleBooks: { name: string; chars: number; language: string }[] = [];
  
  // 用于抽样的索引
  const step = Math.max(1, Math.floor(bookNameList.length / 10));
  
  for (let i = 0; i < bookNameList.length; i++) {
    const name = bookNameList[i];
    const chars = bookCharCountCache?.get(name) ?? bookCache?.get(name)?.length ?? 0;
    totalChars += chars;
    
    if (chars < minChars) minChars = chars;
    if (chars > maxChars) maxChars = chars;
    if (chars < 1000) booksUnder1000Chars++;
    
    // 判断书名是否为英文
    const isEnglishName = /^[A-Za-z]/.test(name);
    
    if (isEnglishName) {
      englishBookCount++;
      // 用缓存字数判断（懒加载模式不再拉全文）
      const cachedContent = bookCache?.get(name);
      if (cachedContent && cachedContent.length > 10) {
        const hasChinese = /[\u4e00-\u9fff]/.test(cachedContent.substring(0, 2000));
        if (hasChinese) {
          englishTranslatedCount++;
        } else {
          englishUntranslatedCount++;
        }
      } else {
        englishUntranslatedCount++;
      }
    } else {
      chineseBookCount++;
    }
    
    // 抽样
    if (i % step === 0 && sampleBooks.length < 15) {
      const cachedContent = bookCache?.get(name);
      const languageLabel = isEnglishName
        ? (cachedContent && cachedContent.length > 10 && /[\u4e00-\u9fff]/.test(cachedContent.substring(0, 2000)) ? '英文→已翻译为中文' : '英文原文')
        : '中文原文';
      sampleBooks.push({
        name,
        chars,
        language: languageLabel,
      });
    }
  }
  
  if (minChars === Infinity) minChars = 0;
  
  // 学习状态（已学完 / 待学习的书名清单）—— 从 Supabase 拉真相，与 GET /api/knowledge-base 一致
  const learnedBookNames: string[] = [];
  const pendingBookNames: string[] = [];
  try {
    // eslint-disable-next-line import/no-cycle
    const repo = await import('./book-repo');
    const dbTasks = await repo.listTasks();
    const dbLearnedSet = new Set(
      dbTasks
        .filter(t => t.learning_status === 'done' && t.learning_progress === 100)
        .map(t => t.book_name)
    );
    for (const name of bookNameList) {
      if (dbLearnedSet.has(name)) {
        learnedBookNames.push(name);
      } else {
        pendingBookNames.push(name);
      }
    }
  } catch {
    // db 不可用，全部视为 pending（宁可保守也不假装学完）
    pendingBookNames.push(...bookNameList);
  }
  
  return {
    bookCount: bookNameList.length,
    totalChars,
    chineseBookCount,
    englishBookCount,
    englishTranslatedCount,
    englishUntranslatedCount,
    avgCharsPerBook: bookNameList.length > 0 ? Math.round(totalChars / bookNameList.length) : 0,
    minChars,
    maxChars,
    booksUnder1000Chars,
    sampleBooks,
    // 学习状态
    learned: learnedBookNames.length,
    pending: pendingBookNames.length,
    learnedBookNames,
    pendingBookNames,
  };
}

/**
 * 检查书籍是否已存在于知识库
 */
export function isBookExists(bookName: string): boolean {
  loadBookCache();
  if (!bookNameList) return false;
  
  const bookNameLower = bookName.toLowerCase();
  return bookNameList.some(name => 
    name === bookName || 
    name.includes(bookName) || 
    bookName.includes(name) ||
    name.toLowerCase().includes(bookNameLower)
  );
}

/**
 * 获取学习时间预估
 * 基于实际书籍数据（字数、章节数、是否需要翻译）计算保守的时间估算
 */
export function getLearningTimeEstimate(): string {
  loadBookCache();
  const statusMap = loadLearnStatus();
  
  if (!bookCache || !bookNameList) {
    return '📚 知识库当前没有书籍，无法预估学习时间。';
  }
  
  const totalBooks = bookNameList.length;
  if (totalBooks === 0) {
    return '📚 知识库当前没有书籍，无法预估学习时间。';
  }
  
  // 统计各类书籍数据
  let totalChars = 0;
  let chineseBookCount = 0;
  let englishBookCount = 0;
  let learnedCount = 0;
  let learningCount = 0;
  let notStartedCount = 0;
  let totalChapters = 0;
  let learnedChapters = 0;
  
  const bookDetails: { name: string; chars: number; chapters: number; learnedChapters: number; isEnglish: boolean; learned: boolean }[] = [];
  
  for (const name of bookNameList) {
    const content = bookCache.get(name) || '';
    const chars = content.length;
    totalChars += chars;
    
    const isEnglishName = /^[A-Za-z]/.test(name);
    if (isEnglishName) {
      englishBookCount++;
    } else {
      chineseBookCount++;
    }
    
    const status = statusMap.get(name);
    const bookTotalChapters = status?.totalChapters || 0;
    const bookLearnedChapters = status?.learnedChapters || 0;
    const isLearned = status?.learned || false;
    
    totalChapters += bookTotalChapters;
    learnedChapters += bookLearnedChapters;
    
    if (isLearned) {
      learnedCount++;
    } else if (bookLearnedChapters > 0) {
      learningCount++;
    } else {
      notStartedCount++;
    }
    
    bookDetails.push({
      name,
      chars,
      chapters: bookTotalChapters,
      learnedChapters: bookLearnedChapters,
      isEnglish: isEnglishName,
      learned: isLearned,
    });
  }
  
  const remainingBooks = totalBooks - learnedCount;
  const remainingChars = bookDetails.filter(b => !b.learned).reduce((sum, b) => sum + b.chars, 0);
  
  // ===== 时间估算模型 =====
  // 基于保守估计：
  // - 中文书：每1万字约需3分钟深度学习（4层递进：术语→逻辑→关联→应用）
  // - 英文书：需先翻译再学习，每1万字约需8分钟（翻译5分钟+学习3分钟）
  // - 最小处理时间：每本至少5分钟（即使很短也要理解框架）
  // - 并发限制：同时最多3本
  
  const CHINESE_MINUTES_PER_10K = 3;    // 中文每1万字3分钟
  const ENGLISH_MINUTES_PER_10K = 8;    // 英文每1万字8分钟（含翻译）
  const MIN_MINUTES_PER_BOOK = 5;       // 每本至少5分钟
  const CONCURRENCY = 3;                // 并发数
  
  let totalMinutes = 0;
  for (const book of bookDetails) {
    if (book.learned) continue;
    const chars10k = book.chars / 10000;
    const bookMinutes = book.isEnglish
      ? Math.max(MIN_MINUTES_PER_BOOK, chars10k * ENGLISH_MINUTES_PER_10K)
      : Math.max(MIN_MINUTES_PER_BOOK, chars10k * CHINESE_MINUTES_PER_10K);
    totalMinutes += bookMinutes;
  }
  
  // 考虑并发
  const effectiveMinutes = totalMinutes / CONCURRENCY;
  
  // 考虑已部分学习的书（按比例减少剩余时间）
  const partialLearnedReduction = bookDetails
    .filter(b => !b.learned && b.learnedChapters > 0 && b.chapters > 0)
    .reduce((sum, b) => {
      const ratio = b.learnedChapters / b.chapters;
      const chars10k = b.chars / 10000;
      const bookMinutes = b.isEnglish
        ? Math.max(MIN_MINUTES_PER_BOOK, chars10k * ENGLISH_MINUTES_PER_10K)
        : Math.max(MIN_MINUTES_PER_BOOK, chars10k * CHINESE_MINUTES_PER_10K);
      return sum + bookMinutes * ratio;
    }, 0);
  
  const adjustedMinutes = Math.max(0, effectiveMinutes - partialLearnedReduction);
  
  // 格式化时间
  function formatDuration(minutes: number): string {
    if (minutes < 60) return `约${Math.round(minutes)}分钟`;
    const hours = minutes / 60;
    if (hours < 24) return `约${Math.round(hours * 10) / 10}小时`;
    const days = hours / 24;
    if (days < 30) return `约${Math.round(days * 10) / 10}天`;
    const weeks = days / 7;
    if (weeks < 8) return `约${Math.round(weeks * 10) / 10}周`;
    const months = days / 30;
    return `约${Math.round(months * 10) / 10}个月`;
  }
  
  // 按字数分组统计
  const smallBooks = bookDetails.filter(b => b.chars < 10000).length;
  const mediumBooks = bookDetails.filter(b => b.chars >= 10000 && b.chars < 100000).length;
  const largeBooks = bookDetails.filter(b => b.chars >= 100000).length;
  const avgChars = Math.round(totalChars / totalBooks);
  
  const lines: string[] = [];
  lines.push(`⏱️ 学习时间预估报告`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`【知识库概况】`);
  lines.push(`  总藏书量：${totalBooks} 本`);
  lines.push(`  中文原版：${chineseBookCount} 本 | 英文原版（需翻译）：${englishBookCount} 本`);
  lines.push(`  总字符数：${totalChars.toLocaleString()} 字`);
  lines.push(`  平均每本：${avgChars.toLocaleString()} 字`);
  lines.push(``);
  lines.push(`【书籍规模分布】`);
  lines.push(`  小型书（<1万字）：${smallBooks} 本`);
  lines.push(`  中型书（1-10万字）：${mediumBooks} 本`);
  lines.push(`  大型书（>10万字）：${largeBooks} 本`);
  lines.push(``);
  lines.push(`【当前学习状态】`);
  lines.push(`  ✅ 已学完：${learnedCount} 本`);
  lines.push(`  📖 学习中：${learningCount} 本`);
  lines.push(`  ⏳ 未开始：${notStartedCount} 本`);
  lines.push(`  总进度：${totalChapters > 0 ? Math.round(learnedChapters / totalChapters * 100) : 0}%`);
  lines.push(``);
  lines.push(`【时间预估（保守估计）】`);
  lines.push(`  估算方法：`);
  lines.push(`  - 中文书：每1万字约3分钟（4层深度学习：术语→逻辑→关联→应用）`);
  lines.push(`  - 英文书：每1万字约8分钟（翻译5分钟+学习3分钟）`);
  lines.push(`  - 每本最少5分钟 | 同时学习${CONCURRENCY}本`);
  lines.push(``);
  lines.push(`  📊 剩余需学习：${remainingBooks} 本（共${remainingChars.toLocaleString()}字）`);
  lines.push(`  ⏰ 预计总时间：${formatDuration(adjustedMinutes)}`);
  if (englishBookCount > 0) {
    const englishRemaining = bookDetails.filter(b => !b.learned && b.isEnglish);
    const englishMinutes = englishRemaining.reduce((sum, b) => {
      const chars10k = b.chars / 10000;
      return sum + Math.max(MIN_MINUTES_PER_BOOK, chars10k * ENGLISH_MINUTES_PER_10K);
    }, 0) / CONCURRENCY;
    lines.push(`  🌐 其中英文书翻译+学习：${formatDuration(englishMinutes)}`);
  }
  lines.push(``);
  lines.push(`  💡 说明：这是最保守的估计，实际可能更快。学习速度取决于服务器性能和并发数。`);
  lines.push(`  学习不间断——后台持续运行，退出APP也不停止。`);
  
  return lines.join('\n');
}

/**
 * 添加书籍到知识库
 * @param bookName 书名（作为文件名）
 * @param content 完整书籍内容
 * @returns 保存的文件路径
 */
export function addBookToKnowledgeBase(bookName: string, content: string): string {
  const dir = getBookContentDir();
  
  // 确保目录存在
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // 只读文件系统忽略
  }
  
  // 清理文件名中的非法字符
  const safeName = bookName.replace(/[<>:"/\\|?*]/g, '_').trim();
  const fileName = `${safeName}.txt`;
  const filePath = path.join(dir, fileName);
  
  // 写入完整内容，不做任何截断
  fs.writeFileSync(filePath, content, 'utf-8');
  
  // 刷新缓存，让新书可被检索到
  bookCache = null;
  bookNameList = null;
  bookCharCountCache = null;
  dbCachePrimed = false;
  loadBookCache();
  
  // 立即把字数写入缓存（fix: 解决字数显示为 0 的问题）
  bookCharCountCache = bookCharCountCache ?? new Map();
  bookCharCountCache.set(bookName, content.length);
  
  // 🔴 录入即学习：开始学习，解析章节信息
  const chapterInfo = parseChapterInfoFromContent(bookName);
  markBookAsLearned(bookName, content.length, chapterInfo.totalChapters, chapterInfo.chapterStructure);
  
  // 同步到 Supabase（统一真相源，开发/生产共享）
  upsertBookToDb({
    name: bookName,
    content,
    char_count: content.length,
    total_chapters: chapterInfo.totalChapters,
    chapter_structure: chapterInfo.chapterStructure || '章',
  }).then(() => {
    console.log(`[Supabase] 《${bookName}》已持久化到云端数据库`);
  }).catch((err: unknown) => {
    console.error(`[Supabase] 《${bookName}》持久化失败:`, err);
  });
  
  // 异步上传到S3（兜底加速缓存）
  saveBookToS3(bookName, content).then(() => {
    console.log(`[S3] 书籍《${bookName}》已同步到云存储`);
  }).catch((err: unknown) => {
    console.error(`[S3] 书籍《${bookName}》上传云存储失败:`, err);
  });
  
  return filePath;
}

/**
 * 从知识库中删除书籍
 * @param bookName 书名
 * @returns 是否删除成功
 */
export function removeBookFromKnowledgeBase(bookName: string): boolean {
  loadBookCache();
  
  // 找到精确匹配或模糊匹配的书名
  let matchedName: string | null = null;
  if (bookNameList && bookCache) {
    // 先精确匹配
    if (bookCache.has(bookName)) {
      matchedName = bookName;
    } else {
      // 模糊匹配
      for (const name of bookNameList) {
        if (name === bookName || name.includes(bookName) || bookName.includes(name)) {
          matchedName = name;
          break;
        }
      }
    }
  }
  
  if (!matchedName) return false;
  
  const dir = getBookContentDir();
  const safeName = matchedName.replace(/[<>:"/\\|?*]/g, '_').trim();
  const fileName = `${safeName}.txt`;
  const filePath = path.join(dir, fileName);
  
  // 删除本地主文件
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // 删除翻译临时文件（.translating）
  const translatingPath = path.join(dir, `${safeName}.translating`);
  if (fs.existsSync(translatingPath)) {
    fs.unlinkSync(translatingPath);
  }
  
  // 删除任何以该书名开头的相关文件（防止残留）
  try {
    const allFiles = fs.readdirSync(dir);
    for (const f of allFiles) {
      if (f.startsWith(safeName) && (f.endsWith('.txt') || f.endsWith('.translating') || f.endsWith('.tmp') || f.endsWith('.bak'))) {
        fs.unlinkSync(path.join(dir, f));
      }
    }
  } catch {
    // 忽略目录扫描错误
  }
  
  // 从缓存中移除
  bookCache?.delete(matchedName);
  bookCharCountCache?.delete(matchedName);
  if (bookNameList) {
    const idx = bookNameList.indexOf(matchedName);
    if (idx >= 0) bookNameList.splice(idx, 1);
  }
  
  // 从学习状态中移除
  if (learnStatusCache) {
    learnStatusCache.delete(matchedName);
    saveLearnStatus();
  }
  
  // 异步从S3删除
  deleteBookFromS3(matchedName).then(() => {
    console.log(`[S3] 书籍《${matchedName}》已从云存储删除`);
  }).catch((err: unknown) => {
    console.error(`[S3] 书籍《${matchedName}》从云存储删除失败:`, err);
  });

  // 同步从 Supabase 删除（books 表 + book_tasks 表 + 立墓碑）
  (async () => {
    try {
      await deleteBookFromDb(matchedName);
      console.log(`[Supabase] 《${matchedName}》已从 books 表删除`);
    } catch (err) {
      console.error(`[Supabase] 《${matchedName}》从 books 表删除失败:`, err);
    }
    try {
      const { deleteTasksByBookName, addTombstone } = await import('./book-repo');
      await deleteTasksByBookName(matchedName);
      await addTombstone('name', matchedName);
      console.log(`[Supabase] 《${matchedName}》已从 book_tasks 表删除并立墓碑`);
    } catch (err) {
      console.error(`[Supabase] 《${matchedName}》book_tasks 表删除失败:`, err);
    }
    // 通知 task-manager 立即清理内存中的 task
    try {
      // eslint-disable-next-line import/no-cycle
      const { removeTaskByBookName } = await import('./book-task-manager');
      removeTaskByBookName(matchedName);
    } catch {
      // task manager 可能未加载
    }
  })();
  dbCachePrimed = false; // 下次访问重新拉取最新书目
  
  return true;
}

/**
 * 获取书籍目录路径
 */
export function getBookDir(): string {
  return getBookContentDir();
}

/**
 * 获取指定书籍的章节内容
 * @param bookName 书名
 * @param chapterRange 章节范围，如 { start: 1, end: 10 } 表示第1章到第10章
 * @returns 章节内容文本，如果未指定范围则返回整本书
 */
export function getBookChapterContent(
  bookName: string,
  chapterRange?: { start: number; end: number }
): { content: string; totalChapters: number; structureType: string; requestedChapters: string } | null {
  const fullText = getBookFullText(bookName);
  if (!fullText) return null;

  // 解析章节结构
  const chapters = parseChaptersFromText(fullText);
  
  if (chapters.length === 0 || !chapterRange) {
    // 没有章节结构，或不指定范围，返回全文
    return {
      content: fullText,
      totalChapters: chapters.length || 0,
      structureType: chapters.length > 0 ? chapters[0].type : '全文',
      requestedChapters: chapterRange ? '全文（无章节结构）' : '全文'
    };
  }

  // 按范围提取章节
  const start = Math.max(1, chapterRange.start);
  const end = Math.min(chapters.length, chapterRange.end);
  
  const parts: string[] = [];
  for (let i = start - 1; i < end; i++) {
    const chapterStart = chapters[i].startIndex;
    const chapterEnd = i + 1 < chapters.length ? chapters[i + 1].startIndex : fullText.length;
    parts.push(fullText.substring(chapterStart, chapterEnd));
  }

  const structureType = chapters[0].type;
  const rangeDesc = start === end
    ? `第${start}${structureType}`
    : `第${start}${structureType}到第${end}${structureType}`;

  return {
    content: parts.join('\n'),
    totalChapters: chapters.length,
    structureType,
    requestedChapters: rangeDesc
  };
}

/**
 * 从文本中解析章节结构（轻量版，不依赖book-task-manager）
 */
function parseChaptersFromText(text: string): { type: string; startIndex: number }[] {
  const chapters: { type: string; startIndex: number }[] = [];
  
  // 按优先级匹配章节模式
  const patterns: { regex: RegExp; type: string }[] = [
    { regex: /^第[一二三四五六七八九十百千零\d]+[卷篇]\s*第[一二三四五六七八九十百千零\d]+[章节回品]/gm, type: '卷/章' },
    { regex: /^第[一二三四五六七八九十百千零\d]+卦\s*/gm, type: '卦' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[卷]/gm, type: '卷' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[篇]/gm, type: '篇' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[章]/gm, type: '章' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[节]/gm, type: '节' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[回]/gm, type: '回' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[部]/gm, type: '部' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[品]/gm, type: '品' },
    { regex: /^第[一二三四五六七八九十百千零\d]+[门]/gm, type: '门' },
    // 六十四卦名（乾坤屯蒙需讼师比...）
    { regex: /^(乾|坤|屯|蒙|需|讼|师|比|小畜|履|泰|否|同人|大有|谦|豫|随|蛊|临|观|噬嗑|贲|剥|复|无妄|大畜|颐|大过|坎|离|咸|恒|遁|大壮|晋|明夷|家人|睽|蹇|解|损|益|夬|姤|萃|升|困|井|革|鼎|震|艮|渐|归妹|丰|旅|巽|兑|涣|节|中孚|小过|既济|未济)卦\b/gm, type: '卦' },
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      chapters.push({
        type: pattern.type,
        startIndex: match.index
      });
    }
    if (chapters.length >= 3) break; // 找到足够的章节就停止
  }

  // 按位置排序
  chapters.sort((a, b) => a.startIndex - b.startIndex);
  
  return chapters;
}

/**
 * 解析用户消息中的章节范围请求
 * @returns 章节范围对象，如果无法解析则返回null
 */
export function parseChapterRange(message: string): { start: number; end: number } | null {
  // 匹配 "第X章到第Y章" / "第X卦到第Y卦" / "第X篇到第Y篇" 等
  const rangeMatch = message.match(/第([一二三四五六七八九十百千零\d]+)[卦篇章卷部节回]到第([一二三四五六七八九十百千零\d]+)[卦篇章卷部节回]/);
  if (rangeMatch) {
    return { start: chineseToNumber(rangeMatch[1]), end: chineseToNumber(rangeMatch[2]) };
  }
  
  // 匹配 "第X章" / "第X卦" 等（单章）
  const singleMatch = message.match(/第([一二三四五六七八九十百千零\d]+)[卦篇章卷部节回]/);
  if (singleMatch) {
    const n = chineseToNumber(singleMatch[1]);
    return { start: n, end: n };
  }
  
  // 匹配 "前X章" / "前10卦"
  const prefixMatch = message.match(/前([一二三四五六七八九十百千零\d]+)[卦篇章卷部节回]/);
  if (prefixMatch) {
    const n = chineseToNumber(prefixMatch[1]);
    return { start: 1, end: n };
  }
  
  return null;
}

/**
 * 中文数字转阿拉伯数字
 */
function chineseToNumber(str: string): number {
  // 如果是纯数字
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  
  const map: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '百': 100, '千': 1000
  };
  
  let result = 0;
  let current = 0;
  
  for (const char of str) {
    const val = map[char];
    if (val === undefined) continue;
    
    if (val >= 10) {
      if (current === 0) current = 1;
      result += current * val;
      current = 0;
    } else {
      current = val;
    }
  }
  
  result += current;
  return result || 1;
}
