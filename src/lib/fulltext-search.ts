/**
 * 全文检索模块
 * 从本地 book-content/ 目录中的txt文件搜索相关段落
 * 用于将古籍原文注入AI提示词，提供更精准的引用依据
 * 
 * 核心原则：书籍从第一个字到最后一个字完整收录，绝不截断！
 */

import * as fs from 'fs';
import * as path from 'path';
import { saveBook as saveBookToS3, getBookContent as getBookFromS3, deleteBookFromS3 } from './book-storage';

// 书籍内容缓存
let bookCache: Map<string, string> | null = null;
let bookNameList: string[] | null = null;

// 书籍文件目录（生产环境使用/tmp，开发环境使用public）
function getBookContentDir(): string {
  const devDir = path.join(process.cwd(), 'public', 'book-content');
  const prodDir = '/tmp/book-content';
  
  if (process.env.COZE_PROJECT_ENV === 'PROD') {
    if (fs.existsSync(prodDir)) return prodDir;
  }
  
  if (fs.existsSync(devDir)) return devDir;
  return devDir;
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
 */
function loadBookCache(): void {
  if (bookCache) return;
  
  bookCache = new Map();
  bookNameList = [];
  
  const dir = getBookContentDir();
  if (!fs.existsSync(dir)) return;
  
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
function extractSearchKeywords(message: string): string[] {
  const keywords: string[] = [];
  
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
  
  // 确定相关书籍
  const relevantBookNames = getRelevantBooks(message);
  
  // 从缓存中查找实际存在的书籍
  const availableBooks: string[] = [];
  for (const name of relevantBookNames) {
    if (bookCache.has(name)) {
      availableBooks.push(name);
    }
  }
  
  // 如果关键词匹配不到，尝试从所有书籍名中模糊匹配
  if (availableBooks.length === 0) {
    const msgKeywords = message.replace(/[，。！？、：；""''《》\s]/g, '').split('').filter(c => c.charCodeAt(0) > 0x4e00);
    for (const bookName of bookNameList) {
      for (const kw of msgKeywords) {
        if (bookName.includes(kw)) {
          if (!availableBooks.includes(bookName)) {
            availableBooks.push(bookName);
          }
          break;
        }
      }
      if (maxBooks > 0 && availableBooks.length >= maxBooks) break;
    }
  }
  
  // 限制搜索书籍数量（0=不限制）
  const booksToSearch = maxBooks > 0 ? availableBooks.slice(0, maxBooks) : availableBooks;
  
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
  getBookFromS3(bookName).then((content: string | null) => {
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
  
  let totalChars = 0;
  for (const content of bookCache.values()) {
    totalChars += content.length;
  }
  
  return {
    bookCount: bookNameList.length,
    totalChars,
    bookNames: bookNameList,
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
 * 添加书籍到知识库
 * @param bookName 书名（作为文件名）
 * @param content 完整书籍内容
 * @returns 保存的文件路径
 */
export function addBookToKnowledgeBase(bookName: string, content: string): string {
  const dir = getBookContentDir();
  
  // 确保目录存在
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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
  loadBookCache();
  
  // 异步上传到S3（不阻塞主流程）
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
  
  // 删除本地文件
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // 从缓存中移除
  bookCache?.delete(matchedName);
  if (bookNameList) {
    const idx = bookNameList.indexOf(matchedName);
    if (idx >= 0) bookNameList.splice(idx, 1);
  }
  
  // 异步从S3删除
  deleteBookFromS3(matchedName).then(() => {
    console.log(`[S3] 书籍《${matchedName}》已从云存储删除`);
  }).catch((err: unknown) => {
    console.error(`[S3] 书籍《${matchedName}》从云存储删除失败:`, err);
  });
  
  return true;
}

/**
 * 获取书籍目录路径
 */
export function getBookDir(): string {
  return getBookContentDir();
}
