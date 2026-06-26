import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { buildSystemPromptProfessional, buildSystemPromptCasual, THREE_IRON_RULES, KNOWLEDGE_IRON_LAW_FOUND, KNOWLEDGE_IRON_LAW_NOT_FOUND } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';
import { matchKnowledge, getAllKnowledge } from '@/lib/classic-knowledge';
import { matchExtendedKnowledge } from '@/lib/extended-classic-knowledge';
import { searchKnowledge, formatKnowledgeResults } from '@/lib/knowledge-search';
import { generateSanHeCanDuanPrompt, getSanHeCanDuanByTopic, SAN_HE_CAN_DUAN_GUIDE } from '@/lib/sanhe-canduan';
import { generateMianXiangFramework, getMianXiangPredictionGuide } from '@/lib/xiangxue';
import { generateShouXiangFramework, getShouXiangPredictionGuide } from '@/lib/shouxiang';
import { searchFullText, searchFullTextAsync, formatFullTextResults, getBookFullText, getBookFullTextAsync, findBooksByName, getDetailedBookStats, getBookChapterContent, parseChapterRange, getLearnedBookCount, getBookLearnStatus, getLearningTimeEstimate } from '@/lib/fulltext-search';
import { getLearningProgressSummary, getBookLearningDetail } from '@/lib/book-task-manager';
import { tongQianQiGua, shiJianQiGua as liuyaoShiJian, formatLiuYaoPaiPan as liuyaoFormat } from '@/lib/liuyao';
import { shiJianQiGua as meihuaShiJian, shuZiQiGua, wenZiQiGua, formatMeiHuaPaiPan as meihuaFormat } from '@/lib/meihua';
import { paiPan as qimenPaiPan, formatQiMenPaiPan as qimenFormat } from '@/lib/qimen';
import { paiPan as liurenPaiPan, formatLiuRenPaiPan as liurenFormat } from '@/lib/liuren';
import { paiPan as fengshuiPaiPan, formatFengShuiPaiPan as fengshuiFormat } from '@/lib/fengshui';
import { calculateXingMing as xingmingCalculate, formatXingMingPaiPan as xingmingFormat } from '@/lib/xingming';

export const dynamic = 'force-dynamic';

interface BirthInfo {
  gender: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  birthMinute: number;
  province: string;
  city: string;
  district: string;
}

function formatBirthInfoWithPaiPan(birthInfo: BirthInfo, _type?: string): string {
  const gender = birthInfo.gender === '男' ? 'male' : 'female';
  const genderText = birthInfo.gender === '男' ? '乾造（男命）' : '坤造（女命）';
  const currentYear = new Date().getFullYear();

  let paiPanResult = '';
  let baziYearGan = '';
  let baziYearZhi = '';

  // 计算八字排盘
  let baziResult: ReturnType<typeof paiPan> | null = null;
  try {
    baziResult = paiPan(
      gender,
      birthInfo.birthYear,
      birthInfo.birthMonth,
      birthInfo.birthDay,
      birthInfo.birthHour,
      birthInfo.birthMinute,
      birthInfo.province
    );
    const baziText = formatPaiPanFull(baziResult, currentYear);
    baziYearGan = baziResult.yearPillar.gan;
    baziYearZhi = baziResult.yearPillar.zhi;
    paiPanResult = `\n\n【八字精确排盘结果（代码计算，非AI脑补）】\n${baziText}`;
    paiPanResult += `\n\n【八字实战预测】\n${formatShiZhanPrediction(baziResult, currentYear)}`;
  } catch (e) {
    paiPanResult = '\n\n[八字排盘计算出错]';
  }

  // 计算紫微斗数排盘
  let ziweiResult: ReturnType<typeof ziweiPaiPan> | null = null;
  if (baziYearGan) {
    try {
      ziweiResult = ziweiPaiPan({
        year: birthInfo.birthYear,
        month: birthInfo.birthMonth,
        day: birthInfo.birthDay,
        hour: birthInfo.birthHour,
        minute: birthInfo.birthMinute,
        gender: birthInfo.gender === '男' ? '男' : '女',
        yearGan: baziYearGan,
        yearZhi: baziYearZhi,
      });
      paiPanResult += `\n\n【紫微斗数精确排盘结果（代码计算，非AI脑补）】\n${ziweiFormatPaiPan(ziweiResult)}\n\n${getMingGongLunDuan(ziweiResult)}`;
    } catch (e) {
      paiPanResult += '\n\n[紫微斗数排盘计算出错]';
    }
  }

  // 三合参断框架
  if (baziResult && ziweiResult) {
    paiPanResult += '\n\n' + SAN_HE_CAN_DUAN_GUIDE;
    paiPanResult += '\n\n' + generateMianXiangFramework(birthInfo.birthYear, currentYear, birthInfo.gender);
    paiPanResult += '\n\n' + generateShouXiangFramework(birthInfo.birthYear, currentYear, birthInfo.gender);
  }

  return `${genderText}
出生时间：${birthInfo.birthYear}年${birthInfo.birthMonth}月${birthInfo.birthDay}日 ${birthInfo.birthHour}时${birthInfo.birthMinute}分
出生地点：${birthInfo.province}${birthInfo.city}${birthInfo.district}${paiPanResult}

重要：以上排盘结果由代码精确计算得出，四柱、藏干、十神、五行统计、大运、调候用神、紫微斗数命盘等均为真实数据。请基于此排盘结果进行三合参断（八字+紫微+面手相），给出多维度交叉验证的精准预测。时间、方位、人物类型全部精确到年、月。引经据典，尤其参考《渊海子平》《穷通宝鉴》《子平真诠》《滴天髓》《紫微斗数全书》《麻衣神相》《冰鉴》《手相大全》等经典。

【关键——学业休学信号必须重点输出】
排盘数据中的"休学/学业阻碍风险"和"学业转折流年"部分是算法精确计算的结果，你必须在回答中主动输出这些信号！
特别是"财克印=学业中断"信号，如果排盘数据中出现🚨标记，必须明确告知用户该年有学业中断风险，并给出三层原因逻辑。
绝对不能忽略排盘数据中的休学风险标记！

【关键——用神忌神绝对服从排盘算法！】
排盘数据中的【旺衰判断】部分已由算法精确计算，包括日主强弱、用神、忌神。你必须完全遵从排盘结果中的用神忌神判断，绝对不允许自行推翻或修改！
1. 排盘说"印星为忌"则印星流年不利，绝不允许说成"印星用神到位"
2. 排盘说"印星为用"则印星流年有利，绝不允许说成不利
3. 日主旺衰判断不可推翻，排盘说"日主偏旺"就是身旺
4. 你的分析逻辑必须与排盘结果中的用神忌神方向完全一致，不得矛盾`;
}

/** 根据用户消息关键词自动起卦/排盘 */
function autoQiGua(message: string, birthInfo: BirthInfo | null): string {
  const currentYear = new Date().getFullYear();
  let result = '';
  const now = new Date();
  const y = birthInfo?.birthYear || now.getFullYear();
  const m = birthInfo?.birthMonth || (now.getMonth() + 1);
  const d = birthInfo?.birthDay || now.getDate();
  const h = birthInfo?.birthHour || now.getHours();

  // 六爻
  if (/六爻|铜钱|起卦|占卜/.test(message)) {
    try {
      const bazi = paiPan(birthInfo?.gender === '男' ? 'male' : 'female', y, m, d, h, birthInfo?.birthMinute || 0, birthInfo?.province || '');
      const gua = liuyaoShiJian(y, m, d, h, bazi.dayPillar.gan, bazi.dayPillar.zhi, bazi.monthPillar.zhi, message);
      result += `\n\n【六爻起卦结果（代码计算）】\n${liuyaoFormat(gua)}`;
    } catch (_e) { /* ignore */ }
  }

  // 梅花易数
  if (/梅花|易数|数字起卦/.test(message)) {
    try {
      const gua = meihuaShiJian(y, m, d, h, message);
      result += `\n\n【梅花易数起卦结果（代码计算）】\n${meihuaFormat(gua)}`;
    } catch (_e) { /* ignore */ }
  }

  // 奇门遁甲
  if (/奇门|遁甲/.test(message)) {
    try {
      const bazi = paiPan(birthInfo?.gender === '男' ? 'male' : 'female', y, m, d, h, birthInfo?.birthMinute || 0, birthInfo?.province || '');
      const qm = qimenPaiPan(m, d, h, bazi.dayPillar.gan + bazi.dayPillar.zhi);
      result += `\n\n【奇门遁甲排盘结果（代码计算）】\n${qimenFormat(qm)}`;
    } catch (_e) { /* ignore */ }
  }

  // 大六壬
  if (/六壬|大六壬/.test(message)) {
    try {
      const bazi = paiPan(birthInfo?.gender === '男' ? 'male' : 'female', y, m, d, h, birthInfo?.birthMinute || 0, birthInfo?.province || '');
      const lr = liurenPaiPan(y, m, d, h, bazi.dayPillar.gan, bazi.dayPillar.zhi);
      result += `\n\n【大六壬排盘结果（代码计算）】\n${liurenFormat(lr)}`;
    } catch (_e) { /* ignore */ }
  }

  // 风水
  if (/风水|住房|房子|搬家|装修/.test(message) && birthInfo) {
    try {
      const fs = fengshuiPaiPan(currentYear, '坎', '离');
      result += `\n\n【风水排盘结果（代码计算）】\n${fengshuiFormat(fs)}`;
    } catch (_e) { /* ignore */ }
  }

  // 姓名
  if (/姓名|名字|取名|改名/.test(message)) {
    try {
      const name = message.replace(/[^一-龥]/g, '').slice(0, 4);
      if (name.length >= 2) {
        const xm = xingmingCalculate(name);
        result += `\n\n【姓名测算结果（代码计算）】\n${xingmingFormat(xm)}`;
      }
    } catch (_e) { /* ignore */ }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { message, mode = 'casual', history = [], birthInfo, context } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: '请提供消息内容' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const birthInfoStr = birthInfo ? formatBirthInfoWithPaiPan(birthInfo as BirthInfo) : undefined;
  
    // 根据用户消息智能匹配经典知识点（关键词匹配兜底）
    const classicKnowledgeStr = matchKnowledge(message) || '';
    // 匹配扩展知识库（全部书籍的核心内容，绝不截断！从第一个字到最后一个字完整收录！）
    const extendedKnowledgeResults = matchExtendedKnowledge(message);
    const extendedKnowledgeStr = extendedKnowledgeResults.length > 0
      ? extendedKnowledgeResults.map(r => r.corePoints).join('\n\n')
      : '';

    // 知识库语义搜索（向量化检索，精准度更高）
    // 搜索用户消息+排盘相关的所有领域知识
    const searchQuery = message + (birthInfoStr ? ' 命理八字紫微面相手相' : '');
    const knowledgeResults = await searchKnowledge(searchQuery);
    const knowledgeSearchStr = formatKnowledgeResults(knowledgeResults);

    // 检测用户是否在问关于知识库本身的问题
    const isKnowledgeBaseQuestion = /知识库|多少本书|多少书|收录|录入|藏书|书库|英文.*翻译|翻译.*中文|整本书|完整.*录入|第一页.*最后|第一个字.*最后|全本|全文.*收录|有没有.*书/.test(message);
    
    // 检测用户是否要求查看某本书的全文或章节
    const isBookContentRequest = /全文|内容|发给我|发过来|给我看|看看|查看|读一读|章节|第[一二三四五六七八九十百千零\d]+[卦篇章卷部节回]|前[一二三四五六七八九十百千零\d]+[卦篇章卷部节回]|原文|原文内容|书里.*写|书上.*说/.test(message);
    
    // 检测用户是否在问书籍结构问题（多少章/卦/卷/学到哪了）
    const isBookStructureQuestion = /多少[卦篇章卷部节回]|几[卦篇章卷部节回]|总共.*[卦篇章卷部节回]|[卦篇章卷部节回].*数量|学到.*第|学习.*进度|学完.*多少|学到哪/.test(message);
    
    // 检测用户是否在问AI学习进度
    const isLearningProgressQuestion = /学得怎么样|学会了哪些|哪本.*没学完|学到哪|学习.*进度|学完.*几本|觉得自己.*学会|学习.*状态|你.*学了|你.*正在学|学了多少|哪些.*学完|哪些.*没学|翻译.*质量|翻译.*检查|英文.*翻译.*质量|乱码|缺页|漏译/.test(message);
    
    // 检测用户是否在问学习时间预估
    const isLearningTimeQuestion = /需要.*多久|需要.*多长时间|大概.*时间|时间.*估算|时间.*预估|预估.*时间|多久.*学完|几天|几周|几个月|学完.*多久|保守.*估计|最保守|赶时间|心里有数|等多久|要多长时间|什么时候.*学完|学完.*什么时候/.test(message);
    
    let knowledgeBaseInfo = '';
    let fullTextStr = '';
    let specificBookFullText = '';
    let bookContentInstruction = '';
    let bookStructureInfo = '';
    let learningProgressInfo = '';
    
    if (isKnowledgeBaseQuestion && !isBookContentRequest) {
      // 知识库相关问题：只注入统计数据，跳过全文检索（避免超上下文窗口）
      const stats = getDetailedBookStats();
      knowledgeBaseInfo = `\n\n【知识库实时统计信息——用户正在询问知识库相关情况，必须如实回答】
📚 知识库总藏书量：${stats.bookCount} 本
📝 总字符数：${stats.totalChars.toLocaleString()} 字
📊 平均每本：${stats.avgCharsPerBook.toLocaleString()} 字
📏 最短的书：${stats.minChars.toLocaleString()} 字 | 最长的书：${stats.maxChars.toLocaleString()} 字
🇨🇳 中文原版书：${stats.chineseBookCount} 本
🇬🇧 英文原版书：${stats.englishBookCount} 本（已全部翻译为中文：${stats.englishTranslatedCount} 本，未翻译：${stats.englishUntranslatedCount} 本）
⚠️ 字数少于1000的书：${stats.booksUnder1000Chars} 本

📖 部分书籍抽样：
${stats.sampleBooks.map(b => `  《${b.name}》${b.chars.toLocaleString()}字 [${b.language}]`).join('\n')}

【知识库录入规则】
1. 每本书从第一页第一个字到最后一页最后一个字完整录入，一个字都不遗漏
2. 所有英文原版书均已翻译为中文，翻译同样从第一个字到最后一个字完整翻译
3. 翻译使用【段N】编号方案，确保每一段原文和译文一一对应，100%段落匹配
4. 书籍目录按原书叫法显示（卦就写卦、章就写章、卷就写卷）
5. 知识库内容是AI回答的唯一来源，不允许编造知识库中没有的内容

请根据以上实时统计数据如实回答用户关于知识库的问题。`;
    }
    
    // 检测书籍结构问题（多少章/卦/卷/学到哪了）
    if (isBookStructureQuestion) {
      const bookNameMatches = findBooksByName(message);
      if (bookNameMatches.length > 0) {
        const bookInfos = bookNameMatches.slice(0, 5).map(b => {
          const status = getBookLearnStatus(b.name);
          if (status) {
            const structure = status.chapterStructure || '章';
            const total = status.totalChapters || 0;
            const learned = status.learnedChapters || 0;
            return `《${b}》：共${total}${structure}，已学习${learned}${structure}（学习进度${total > 0 ? Math.round(learned/total*100) : 0}%）`;
          }
          return `《${b}》：未找到学习记录`;
        });
        bookStructureInfo = `\n\n【书籍结构信息】\n${bookInfos.join('\n')}\n\n请根据以上数据准确回答用户关于书籍结构的问题。`;
      }
    }
    
    // 检测AI学习进度问题
    if (isLearningProgressQuestion || isLearningTimeQuestion) {
      // 先检查用户是否问的是某本特定书
      const specificBookMatch = findBooksByName(message);
      if (specificBookMatch.length > 0) {
        const bestMatch = specificBookMatch.sort((a, b) => a.name.length - b.name.length)[0];
        const detail = getBookLearningDetail(bestMatch.name);
        learningProgressInfo = `\n\n【AI学习进度——用户正在询问学习情况，必须如实回答】\n${detail}\n\n请根据以上实时数据如实回答用户关于学习进度的问题。用自然语言，像跟朋友聊天一样回答，不要机械地复述数据。`;
      } else {
        const summary = getLearningProgressSummary();
        learningProgressInfo = `\n\n【AI学习进度——用户正在询问学习情况，必须如实回答】\n${summary}\n\n请根据以上实时数据如实回答用户关于学习进度的问题。用自然语言，像跟朋友聊天一样回答，不要机械地复述数据。对于翻译质量检查问题，请根据知识库中已收录的英文书籍翻译内容来判断，如实告知用户哪些书可能存在翻译质量问题。`;
      }
      // 如果用户问的是时间预估，追加时间估算报告
      if (isLearningTimeQuestion) {
        const timeEstimate = getLearningTimeEstimate();
        learningProgressInfo += `\n\n【学习时间预估——用户想知道大概要学多久，必须如实回答】\n${timeEstimate}\n\n请根据以上时间预估数据如实回答用户。用自然语言，像朋友聊天一样告诉用户大概要等多久。不用赶时间，按最保守的估计来。说清楚：总共多少本书、每本大概多长时间、总体需要多久。如果有英文书需要翻译的，翻译时间也要算进去。`;
      }
    }
    
    if (!isKnowledgeBaseQuestion && !isLearningProgressQuestion && !isLearningTimeQuestion) {
      // 非知识库统计问题：正常全文检索
      // 全文检索：从本地txt文件或S3中搜索相关古籍原文段落（不限制！从第一个字到最后一个字完整收录！）
      const fullTextPassages = await searchFullTextAsync(message, 0, 0, 0);
      fullTextStr = formatFullTextResults(fullTextPassages);
      
      // 检测书籍内容请求
      const bookNameMatches = findBooksByName(message);
      if (bookNameMatches.length > 0) {
        const bestMatch = bookNameMatches.sort((a, b) => a.name.length - b.name.length)[0];
        
        if (isBookContentRequest) {
          // 用户要求查看书籍内容
          const chapterRange = parseChapterRange(message);
          const bookContent = getBookChapterContent(bestMatch.name, chapterRange || undefined);
          
          if (bookContent) {
            specificBookFullText = `\n\n【《${bestMatch.name}》${bookContent.requestedChapters}——从第一个字到最后一个字完整呈现，绝不截断】
总${bookContent.structureType}数：${bookContent.totalChapters}
当前显示：${bookContent.requestedChapters}

${bookContent.content}`;

            bookContentInstruction = `\n\n【书籍内容输出指令——最高优先级！】
用户要求查看《${bestMatch.name}》的内容。你必须：
1. 将上方的书籍原文完整输出给用户，从第一个字到最后一个字，一个字都不许省略！
2. 绝对不允许限制字数！绝对不允许限制行数！绝对不允许限制篇幅！
3. 绝对不允许以"字数到了""行数到了""篇幅有限"为由截断！
4. 原文有多长就输出多长，完整输出，不断章取义！
5. 输出格式：直接输出原文内容，不需要额外解释，不需要总结概括
6. 如果用户要求特定章节，只输出那些章节的原文；如果要求全文，输出全部原文
7. 这不是"引用"而是"展示原文"，所以不要加引号标记，直接呈现原文`;
          }
        } else {
          // 用户只是提到了某本书，获取完整全文供AI参考
          const fullText = await getBookFullTextAsync(bestMatch.name);
          if (fullText) {
            specificBookFullText = `\n\n【${bestMatch.name}完整全文（从第一个字到最后一个字，一字不漏）】\n${fullText}`;
          }
        }
      }
    }

    // 合并语义搜索结果、关键词匹配结果、扩展知识和全文检索结果（四者互补，不应二选一）
    const finalKnowledgeStr = (knowledgeSearchStr ? '【知识库语义检索结果】\n' + knowledgeSearchStr : '')
      + (classicKnowledgeStr ? '\n\n【关键词匹配补充知识】\n' + classicKnowledgeStr : '')
      + (extendedKnowledgeStr ? '\n\n【全部典籍核心论断——必须全部引用】\n' + extendedKnowledgeStr : '')
      + (fullTextStr ? '\n\n【典籍原文摘录（来自知识库藏书全文）——优先引用原文】\n' + fullTextStr : '')
      + (specificBookFullText ? specificBookFullText : '')
      + (knowledgeBaseInfo ? knowledgeBaseInfo : '')
      + (bookStructureInfo ? bookStructureInfo : '')
      + (learningProgressInfo ? learningProgressInfo : '')
      + '\n\n【知识库学习指引——学思路不学结果】以上知识库内容不是让你照搬原文，而是让你学习其中的分析思路和方法论。重点关注：1.宗师看到某组合时按什么逻辑推理；2.用神忌神在实际案例中如何运用；3.宫位星曜配合的判断规则；4.大运流年叠加的具体方法。理解其分析逻辑后融入你自己的推理链，不是机械复制原文凑数。';

    // 知识库强制引用铁律（追加到systemPrompt最末尾，确保最高优先级）
    const knowledgeIronLaw = THREE_IRON_RULES + (knowledgeResults.length > 0 || fullTextStr.length > 0 || extendedKnowledgeResults.length > 0 || specificBookFullText
      ? KNOWLEDGE_IRON_LAW_FOUND
      : KNOWLEDGE_IRON_LAW_NOT_FOUND);

    const basePrompt = mode === 'professional'
      ? buildSystemPromptProfessional(birthInfoStr)
      : buildSystemPromptCasual(birthInfoStr);
    
    // 加入三合参断话题指引
    const topicGuide = getSanHeCanDuanByTopic(message);
    // 加入自动起卦/排盘
    const autoQiGuaResult = autoQiGua(message, birthInfo ? (birthInfo as BirthInfo) : null);
    const contextStr = context ? `\n\n【前置分析结果】\n${context}\n请在以上分析结果基础上，继续深入回答用户的问题。` : '';

    // 加入学习状态信息
    const learnStats = getLearnedBookCount();
    const learnInfo = `\n\n🔴【学习状态】系统已自动学习知识库中全部${learnStats.learned}本书籍（从第一页第一个字到最后一页最后一个字全部学会），你已是一位通读万卷书的学者，回答问题时要像消化吸收过一样专业、精准、有深度！`;

    let systemPrompt = basePrompt + learnInfo + bookStructureInfo + '\n\n' + finalKnowledgeStr + knowledgeBaseInfo + bookContentInstruction + '\n\n' + topicGuide + autoQiGuaResult + contextStr + knowledgeIronLaw;

    // 智能截断：确保总token不超模型上下文窗口（约128K tokens，中文约1.7字/token）
    // 书籍内容请求时：优先保留书籍内容，截断其他检索结果
    // 普通问答时：优先保留检索段落，截断整本书全文
    const MAX_SYSTEM_CHARS = 180000; // 约100K tokens，留28K给历史和回复
    if (systemPrompt.length > MAX_SYSTEM_CHARS) {
      if (bookContentInstruction) {
        // 书籍内容请求：保留书籍原文，截断其他内容
        // 第一轮：截断全文检索段落
        if (systemPrompt.length > MAX_SYSTEM_CHARS && fullTextStr) {
          systemPrompt = systemPrompt.replace(fullTextStr, '');
        }
        // 第二轮：截断扩展知识
        if (systemPrompt.length > MAX_SYSTEM_CHARS && extendedKnowledgeStr) {
          systemPrompt = systemPrompt.replace(extendedKnowledgeStr, '');
        }
        // 第三轮：截断关键词匹配
        if (systemPrompt.length > MAX_SYSTEM_CHARS && classicKnowledgeStr) {
          systemPrompt = systemPrompt.replace(classicKnowledgeStr, '');
        }
        // 第四轮：截断语义搜索
        if (systemPrompt.length > MAX_SYSTEM_CHARS && knowledgeSearchStr) {
          systemPrompt = systemPrompt.replace(knowledgeSearchStr, '');
        }
        // 第五轮：如果书籍内容本身超长，按章节截断保留请求的部分
        if (systemPrompt.length > MAX_SYSTEM_CHARS && specificBookFullText) {
          const maxBookChars = MAX_SYSTEM_CHARS - 2000; // 留2K给系统提示
          if (specificBookFullText.length > maxBookChars) {
            const truncated = specificBookFullText.substring(0, maxBookChars);
            const note = `\n\n【注意：该书${bookContentInstruction.includes('章节') ? '所请求章节' : '全文'}过长，此处展示了前${maxBookChars.toLocaleString()}字。如需查看后续内容，请告诉我"继续"或指定具体章节。】`;
            systemPrompt = systemPrompt.replace(specificBookFullText, truncated + note);
          }
        }
      } else {
        // 普通问答：原有截断逻辑
        // 第一轮截断：移除specificBookFullText（整本书全文最占空间）
        if (specificBookFullText) {
          systemPrompt = systemPrompt.replace(specificBookFullText, '\n\n【注：该书全文过长，已截断。请基于已有段落引用回答。】');
        }
        // 第二轮截断：截断全文检索段落
        if (systemPrompt.length > MAX_SYSTEM_CHARS && fullTextStr) {
          const keepChars = MAX_SYSTEM_CHARS - (systemPrompt.length - fullTextStr.length);
          if (keepChars > 0) {
            const truncatedFullText = fullTextStr.substring(0, keepChars);
            systemPrompt = systemPrompt.replace(fullTextStr, truncatedFullText + '\n\n[...更多段落已省略，但回答时仍须完整，不可说"省略了"]');
          } else {
            systemPrompt = systemPrompt.replace(fullTextStr, '');
          }
        }
        // 第三轮：仍超限则从末尾截断扩展知识
        if (systemPrompt.length > MAX_SYSTEM_CHARS && extendedKnowledgeStr) {
          const keepChars = MAX_SYSTEM_CHARS - (systemPrompt.length - extendedKnowledgeStr.length - 200);
          if (keepChars > 0) {
            const truncated = extendedKnowledgeStr.substring(0, keepChars);
            systemPrompt = systemPrompt.replace(extendedKnowledgeStr, truncated + '\n\n[...更多论断已省略]');
          }
        }
      }
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const stream = client.stream(messages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: mode === 'professional' ? 0.4 : 0.7,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成内容时出错' })}\n\n`));
          } catch { /* controller already closed */ }
          try { controller.close(); } catch { /* already closed */ }
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
