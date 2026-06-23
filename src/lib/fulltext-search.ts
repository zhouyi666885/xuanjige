/**
 * 全文检索模块
 * 从本地 book-content/ 目录中的txt文件搜索相关段落
 * 用于将古籍原文注入AI提示词，提供更精准的引用依据
 */

import * as fs from 'fs';
import * as path from 'path';

// 书籍内容缓存
let bookCache: Map<string, string[]> | null = null;
let bookNameList: string[] | null = null;

// 书籍文件目录（生产环境使用/tmp，开发环境使用public）
function getBookContentDir(): string {
  const devDir = path.join(process.cwd(), 'public', 'book-content');
  const prodDir = '/tmp/book-content';
  
  if (process.env.COZE_PROJECT_ENV === 'PROD') {
    // 生产环境：优先检查/tmp，回退到public
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
  
  // 史书
  '史': ['史记', '汉书', '资治通鉴', '三国志'],
  '历史': ['史记', '资治通鉴'],
  
  // 诸子百家
  '墨': ['墨子'],
  '法': ['韩非子', '商君书'],
  '名': ['公孙龙子'],
  '纵横': ['鬼谷子'],
};

// 搜索结果中的段落
export interface BookPassage {
  bookName: string;
  chapter: string;
  content: string;
  relevance: number; // 0-1
}

/**
 * 加载所有书籍内容到缓存
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
      // 按章节分割（=== 标题 === 格式）
      const chapters = content.split(/\n=== .+? ===\n/).filter(s => s.trim().length > 0);
      bookCache.set(bookName, chapters);
      bookNameList.push(bookName);
    } catch {
      // Skip unreadable files
    }
  }
}

/**
 * 根据用户消息确定要搜索的书籍
 */
function getRelevantBooks(message: string): string[] {
  const relevantBooks = new Set<string>();
  
  for (const [keyword, books] of Object.entries(TOPIC_BOOK_MAP)) {
    if (message.includes(keyword)) {
      for (const book of books) {
        relevantBooks.add(book);
      }
    }
  }
  
  return Array.from(relevantBooks);
}

/**
 * 在文本中搜索关键词，返回包含关键词的段落
 */
function searchInText(text: string, keywords: string[], maxPassages: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const results: { text: string; score: number }[] = [];
  
  for (const para of paragraphs) {
    if (para.trim().length < 10) continue; // 跳过太短的段落
    
    let score = 0;
    for (const kw of keywords) {
      const count = (para.match(new RegExp(kw, 'g')) || []).length;
      score += count;
    }
    
    if (score > 0) {
      results.push({ text: para.trim(), score });
    }
  }
  
  // 按相关度排序
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, maxPassages).map(r => r.text);
}

/**
 * 全文检索：从本地txt文件中搜索相关段落
 * @param message 用户消息
 * @param maxBooks 最多搜索多少本书
 * @param maxPassagesPerBook 每本书最多返回多少段落
 * @param maxTotalChars 返回内容的最大总字符数
 */
export function searchFullText(
  message: string,
  maxBooks: number = 5,
  maxPassagesPerBook: number = 3,
  maxTotalChars: number = 6000
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
      if (availableBooks.length >= maxBooks) break;
    }
  }
  
  // 限制搜索书籍数量
  const booksToSearch = availableBooks.slice(0, maxBooks);
  
  // 从用户消息中提取搜索关键词
  const searchKeywords = extractSearchKeywords(message);
  
  const allPassages: BookPassage[] = [];
  let totalChars = 0;
  
  for (const bookName of booksToSearch) {
    const chapters = bookCache.get(bookName);
    if (!chapters) continue;
    
    // 拼接所有章节文本进行搜索
    const fullText = chapters.join('\n\n');
    const passages = searchInText(fullText, searchKeywords, maxPassagesPerBook);
    
    for (const passage of passages) {
      if (totalChars + passage.length > maxTotalChars) break;
      
      allPassages.push({
        bookName,
        chapter: '',  // 章节信息在段落分割时已丢失，后续可优化
        content: passage,
        relevance: 1.0,
      });
      
      totalChars += passage.length;
    }
    
    if (totalChars >= maxTotalChars) break;
  }
  
  return allPassages;
}

/**
 * 从用户消息中提取搜索关键词
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
  ];
  
  for (const term of terms) {
    if (message.includes(term)) {
      keywords.push(term);
    }
  }
  
  // 如果没有匹配到术语，用消息中的中文词组（2-4字）作为关键词
  if (keywords.length === 0) {
    const chineseWords = message.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    keywords.push(...chineseWords.slice(0, 5));
  }
  
  return keywords;
}

/**
 * 格式化全文检索结果为文本
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
  for (const chapters of bookCache.values()) {
    for (const ch of chapters) {
      totalChars += ch.length;
    }
  }
  
  return {
    bookCount: bookNameList.length,
    totalChars,
    bookNames: bookNameList,
  };
}
