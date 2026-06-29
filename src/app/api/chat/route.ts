import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from '@/lib/coze-replacement';
import { buildSystemPromptProfessional, buildSystemPromptCasual, THREE_IRON_RULES, KNOWLEDGE_IRON_LAW_FOUND, KNOWLEDGE_IRON_LAW_NOT_FOUND } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';
import { matchKnowledge, getAllKnowledge } from '@/lib/classic-knowledge';
import { matchExtendedKnowledge } from '@/lib/extended-classic-knowledge';
import { searchKnowledge, formatKnowledgeResults } from '@/lib/knowledge-search';
import { generateSanHeCanDuanPrompt, getSanHeCanDuanByTopic, SAN_HE_CAN_DUAN_GUIDE } from '@/lib/sanhe-canduan';
import { generateMianXiangFramework, getMianXiangPredictionGuide } from '@/lib/xiangxue';
import { generateShouXiangFramework, getShouXiangPredictionGuide } from '@/lib/shouxiang';
import { searchFullText, searchFullTextAsync, formatFullTextResults, getBookFullText, getBookFullTextAsync, findBooksByName, getDetailedBookStats, getBookChapterContent, parseChapterRange, getLearnedBookCount, getBookLearnStatus, getLearningTimeEstimate, loadBookCacheAsync } from '@/lib/fulltext-search';
import { loadTasksFromDb as loadBookTasksFromDb } from '@/lib/book-task-manager';
import { getLearningProgressSummary, getBookLearningDetail, findTaskByBookName, getActiveTaskStatusList, getAllTasks } from '@/lib/book-task-manager';
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
    // 首先从云端拉取最新书目 + 学习任务状态（开发/生产共享 Supabase 数据）
    await loadBookCacheAsync();
    await loadBookTasksFromDb();

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
    
    // 检测用户是否在问AI学习/录入进度
    const isLearningProgressQuestion = /录入.*进度|进度.*录入|录入.*状态|录入到哪|录入情况|学得怎么样|学会了哪些|哪本.*没学完|学到哪|学习.*进度|学完.*几本|觉得自己.*学会|学习.*状态|你.*学了|你.*正在学|学了多少|哪些.*学完|哪些.*没学|翻译.*质量|翻译.*检查|英文.*翻译.*质量|乱码|缺页|漏译|录入完|录到哪|录入.*情况|正在录入|录入中/.test(message);
    
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
      const stats = await getDetailedBookStats();
      const realLearnStats = await getLearnedBookCount();
      knowledgeBaseInfo = `\n\n【知识库实时统计信息——必须如实回答，禁止超出此处数字】
📚 知识库已录入书籍总数：${stats.bookCount} 本（本地物理 .txt 文件数，不允许说"我读过 1280/20000/万卷"等任何超出此数的本数）
📝 总字符数：${stats.totalChars.toLocaleString()} 字
✅ 真正学完的书：${realLearnStats.learned} 本${realLearnStats.learned > 0 ? '\n   学完清单：' + realLearnStats.learnedBookNames.map(n => '《' + n + '》').join('、') : '（暂时还没有任何一本完整学完）'}
⏳ 已录入但未学完的书：${realLearnStats.pending} 本${realLearnStats.pending > 0 ? '\n   未学完清单：' + realLearnStats.pendingBookNames.map(n => '《' + n + '》').join('、') : ''}

【数据真相铁律——本块为本次对话最高真相】
1. ${stats.bookCount} 是物理文件数，是绝对真相，不允许偏离！
2. 同名书任务即使在 task 列表里出现多次（HMR 残留等），也只算 1 本——以"已录入书籍总数"为准！
3. AI 的"内置行业知识"（如知道有《三命通会》《滴天髓》《渊海子平》等书名）≠"已录入知识库"！只能说"这本书在传统典籍中很有名"，禁止说"我学过/读过"！
4. 用户问"几本书"时回答 ${stats.bookCount}；问"学完几本"时回答 ${realLearnStats.learned}；不允许在两个数字之外说出第三个数！

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
      // 🔴 状态一致性铁律：AI回答必须和UI显示一致！
      // 优先检查book-task-manager中的实际任务状态（searching/downloading/等）
      const activeTaskStatusList = getActiveTaskStatusList();
      const taskStatusSection = `【录入任务实时状态——与页面显示一致】\n${activeTaskStatusList.join('\n')}`;

      // 🔴 状态一致性铁律：先优先按消息中的书名去任务管理器查录入状态
      // 这样即使该书还没录入完成（不在fulltext-search里），也能识别出来
      const allTasks = getAllTasks();
      let matchedTask: typeof allTasks[0] | null = null;
      for (const task of allTasks) {
        // 任意一本任务中的书名出现在用户消息里，就算匹配（即使录入未完成）
        if (task.bookName && (message.includes(task.bookName) || task.bookName.includes(message.replace(/[?？。，！,.!\s]/g, '')))) {
          // 选择最长的匹配（避免"滴天髓"匹配到"滴天髓阐微"时取错）
          if (!matchedTask || task.bookName.length > matchedTask.bookName.length) {
            matchedTask = task;
          }
        }
      }
      
      // 同时尝试在已录入书中查找
      const specificBookMatch = findBooksByName(message);
      
      if (matchedTask && ['searching', 'downloading', 'translating', 'saving', 'paused', 'copyright', 'failed', 'pending'].includes(matchedTask.status)) {
        // 这本书还在录入过程中，必须如实报告录入状态，不能说"已学习"
        const statusDesc: Record<string, string> = {
          'pending': '排队中，还没开始搜索',
          'searching': '正在搜索内容，还没开始录入，更没开始学习',
          'downloading': '正在下载内容，还没录入完成，更没开始学习',
          'translating': '正在翻译内容，还没录入完成，更没开始学习',
          'saving': '正在保存内容，还没录入完成，更没开始学习',
          'paused': '录入已暂停，还没录入完成',
          'copyright': '因版权问题无法录入，根本没有内容可以学习',
          'failed': '录入失败，根本没有内容可以学习',
        };
        const detail = `📖《${matchedTask.bookName}》当前真实状态（来自系统任务管理器）\n━━━━━━━━━━━━━━━━━━━━━━━━\n录入状态：${statusDesc[matchedTask.status] || matchedTask.status}\n学习状态：❌ 未开始（录入还没完成，不可能开始学习）\n\n⚠️🔴 铁律：还没录入完的书，绝对不能说"已学习"！\n⚠️🔴 用户问《${matchedTask.bookName}》学得怎么样，必须如实回答"还在${statusDesc[matchedTask.status]}"，绝对不许说"已学完"或"百分百"！`;
        learningProgressInfo = `\n\n【AI学习进度——用户正在询问《${matchedTask.bookName}》的学习情况】\n${taskStatusSection}\n\n${detail}\n\n🔴🔴🔴 状态一致性铁律（违反就是说谎）：\n- 系统显示"搜索中" = AI必须回答"还在搜索，没开始录入更没开始学习"\n- 系统显示"录入中" = AI必须回答"还在录入，没开始学习"\n- 系统显示"学习中" = AI必须回答"正在学习，还没学完"\n- 系统显示"已完成" = 才能说"已学习完成"\n\n严禁说"已学完"或"百分百"！现在《${matchedTask.bookName}》的状态是 ${matchedTask.status}，不是已完成！\n请用自然语言如实告诉用户当前的真实进度。`;
      } else if (specificBookMatch.length > 0) {
        const bestMatch = specificBookMatch.sort((a, b) => a.name.length - b.name.length)[0];
        // 没有活跃录入任务，但本地有这本书 → 走标准学习详情
        const detail = getBookLearningDetail(bestMatch.name);
        learningProgressInfo = `\n\n【AI学习进度——用户正在询问学习情况，必须如实回答】\n${taskStatusSection}\n\n${detail}\n\n🔴 状态一致性铁律：你回答的状态必须和上面的实时状态完全一致！\n- 搜索中 = 还没开始录入，更没开始学习\n- 正在录入 = 还没录入完成，不可能已学完\n- 录入完成+学习中 = 正在学习，还没学完\n- 录入完成+学完 = 才能说"已学习完成"\n请根据以上实时数据如实回答用户关于学习进度的问题。用自然语言，像跟朋友聊天一样回答，不要机械地复述数据。`;
      } else {
        const summary = getLearningProgressSummary();
        learningProgressInfo = `\n\n【AI学习进度——用户正在询问学习情况，必须如实回答】\n${taskStatusSection}\n\n${summary}\n\n🔴 状态一致性铁律：你回答的状态必须和上面的实时状态完全一致！\n- 搜索中 = 还没开始录入，更没开始学习\n- 正在录入 = 还没录入完成，不可能已学完\n- 录入完成+学习中 = 正在学习，还没学完\n- 录入完成+学完 = 才能说"已学习完成"\n请根据以上实时数据如实回答用户关于学习进度的问题。用自然语言，像跟朋友聊天一样回答，不要机械地复述数据。对于翻译质量检查问题，请根据知识库中已收录的英文书籍翻译内容来判断，如实告知用户哪些书可能存在翻译质量问题。`;
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

    // 加入学习状态信息（根据实际学习状态如实显示）
    // ✅ 真相源单一化：直接从 Supabase 拉 task 数据，和 GET /api/knowledge-base 完全一致
    const learnStats = await getLearnedBookCount();
    const { listTasks: repoListTasks } = await import('@/lib/book-repo');
    let dbTasksForStatus: Array<{ book_name: string; status: string; learning_status?: string; learning_progress?: number }> = [];
    try {
      dbTasksForStatus = await repoListTasks();
    } catch {
      dbTasksForStatus = [];
    }
    const activeStatusSet = new Set(['searching', 'downloading', 'translating', 'saving', 'paused', 'pending']);
    const activeTasksForStatus = dbTasksForStatus.filter(t => activeStatusSet.has(t.status));
    const learningTasksForStatus = dbTasksForStatus.filter(
      t => t.learning_status === 'learning' && (t.learning_progress ?? 0) < 100
    );
    const learnedNames = learnStats.learnedBookNames || [];
    const pendingNames = learnStats.pendingBookNames || [];

    // 按录入阶段分组（中文）——让 AI 一眼看清"翻译中""下载中""搜索中"等具体阶段
    const searchingTasks = activeTasksForStatus.filter(t => t.status === 'searching');
    const downloadingTasks = activeTasksForStatus.filter(t => t.status === 'downloading');
    const translatingTasks = activeTasksForStatus.filter(t => t.status === 'translating');
    const savingTasks = activeTasksForStatus.filter(t => t.status === 'saving');
    const pausedTasks = activeTasksForStatus.filter(t => t.status === 'paused');
    const pendingTasks = activeTasksForStatus.filter(t => t.status === 'pending');

    const fmtBookList = (tasks: typeof dbTasksForStatus): string =>
      tasks.length === 0 ? '（无）' : tasks.map(t => `《${t.book_name}》`).join('、');

    const learningBookNames = learningTasksForStatus
      .map(t => `《${t.book_name}》${t.learning_progress ?? 0}%`)
      .join('、');

    const truthBlock = `

╔══════════════════════════════════════════════════════════════════════════╗
║  🔴🔴🔴 永久回答铁律（最高优先级，适用于所有问答，不只是状态查询） 🔴🔴🔴   ║
╚══════════════════════════════════════════════════════════════════════════╝

【铁律 1】先查数据再回答
凡是用户问任何状态类问题（录入 / 翻译 / 深度学习 / 学习进度 / 缺失情况 / 是否在做某事等），
你必须先看下方"系统真实状态"快照，再据此回答。**不许跳过数据直接凭印象答**。

【铁律 2】知识库数据是唯一事实来源
下方快照显示什么状态，你就说什么状态：
- 显示 100% / learningStatus=done → 答"完成了"
- 显示"缺失" → 答"缺失"
- 显示"进行中" → 答"进行中"
**禁止**自己推测、默认、编造、脑补、按历史印象回答。

【铁律 3】一本书可以有多个并行任务状态
同一本书可能同时存在：录入中 + 学习中 + 翻译中。必须**全部如实汇报**，不许只挑一个说。
例：《XX》同时在【学习中】和【录入中】，必须两个状态都说，不能省略任一。

【铁律 4】不许隐瞒已存在的状态
- 知识库里某本书已完成深度学习 → 用户问"有没有深度学习的书" → **必须答"有"并列出书名**
- 知识库里某本书已录入 → 用户问"录入了什么书" → **必须列出**
- 反例：清单里有 2 本学完书，你答"目前没有书完成学习" → **严重违规**

【铁律 5】补录后以最新一次查询为准
用户补录缺章后：
- 下方快照的"缺章"数据是**本次提问时实时拉的最新值**
- 必须以本次快照为准，**禁止**报旧的状态
- 快照显示"无缺章" → 答"已完整录入，无缺章"

【铁律 6】不确定就说不确定
查不到数据 / 不确定 → 直接答"我查不到这个信息"，**禁止编造答案**。

【铁律 7】回答要具体
- 问"翻译到哪了" → 答具体书名 + 具体进度（X%）+ 具体阶段
- 问"在做什么" → 答具体动作 + 具体对象
- **禁止**笼统答"正在处理 / 在做事 / 在学习中"等无信息量回答

【铁律 8】进度 100% ≡ 已完成（永远不许说"进行中"）
当某本书的学习进度显示 100% → 它的学习状态就是【已深度学习 / 已学完 / 已吃透】，**绝对禁止**继续说它"深度学习中 / 学习中 / 进行中"。
当某本书的录入进度显示 100% → 它的录入状态就是【已录入】，禁止说它"录入中"。
当某本书的翻译进度显示 100% → 它的翻译状态就是【已翻译】，禁止说它"翻译中"。
所有任务都一样：进度到 100% 就不再是"进行中"，必须切换成"已完成"。

反例（严重违规）：
- 快照显示《密学讲义》learningProgress=100、learningStatus=done → 你答"《密学讲义》正在深度学习中" → ❌
- 快照显示《XX》progress=100、status=done → 你答"《XX》还在录入中" → ❌
正确答法：进度 100% 的书一律按"已完成"汇报，列入【已完成】清单，绝不列入【进行中】清单。

──────────────────────────────────────────────────────────────────────────

🔴🔴🔴【知识库真实状态——本次对话最高真相，绝不允许偏离】🔴🔴🔴
📊 知识库已录入书籍总数：${learnStats.total} 本（以本地全文文件为准）
✅ 已学完（learningStatus=done）：${learnStats.learned} 本${learnedNames.length > 0 ? '\n   学完清单：' + learnedNames.map(n => '《' + n + '》').join('、') : ''}
🔄 学习进行中（learningStatus=learning）：${learningTasksForStatus.length} 本${learningBookNames ? '\n   进行中：' + learningBookNames : ''}
⏳ 待学习（已录入但未点"开始学习"）：${Math.max(0, learnStats.pending - learningTasksForStatus.length)} 本
⚠️ 还在录入/搜索（尚未进知识库）：${activeTasksForStatus.length} 本

   📥 录入阶段分组明细（精确到当前进行的具体动作）：
   ① 搜索中（在网上搜资料）：${searchingTasks.length} 本 → ${fmtBookList(searchingTasks)}
   ② 下载中（在下载文件）：${downloadingTasks.length} 本 → ${fmtBookList(downloadingTasks)}
   ③ 翻译中（在翻译为中文）：${translatingTasks.length} 本 → ${fmtBookList(translatingTasks)}
   ④ 保存中（在写入知识库）：${savingTasks.length} 本 → ${fmtBookList(savingTasks)}
   ⑤ 待开始（排队中）：${pendingTasks.length} 本 → ${fmtBookList(pendingTasks)}
   ⑥ 已暂停：${pausedTasks.length} 本 → ${fmtBookList(pausedTasks)}

【系统状态查询铁律——任何关于"当前状态"的问题，必须严格基于上方真实数据回答，绝不允许编造、推测、想象】

🔴🔴🔴 **重要前提声明**：
上方"系统真实学习状态"和"录入阶段分组明细"是【每次提问时**实时**从数据库查询出来的最新快照】，是当前**这一秒**系统的真实状态。
你必须**完全相信**这份数据，**只能**基于这份数据回答，**绝不允许**：
- 凭印象回答（"我记得在翻译《xxx》"）
- 凭历史记忆回答（"刚才用户提到过《xxx》在翻译"）
- 凭语义推测回答（"用户既然这么问，那大概率在翻译吧"）
- 绕过上方数据自行脑补任何状态

适用问题包括但不限于：
- 知识库里有哪些书 / 学了多少本 / 总共多少字
- 正在录入哪本书 / 录到哪一步了 / 录入进度多少
- 正在搜索哪本书 / 正在下载哪本书 / 正在翻译哪本书 / 正在保存哪本书 → 必须从上方"录入阶段分组明细"的对应分组直接取数
- 正在学习哪本书 / 学到第几章 / 学习进度多少
- 某本书有没有 / 有没有学 / 学完没有
- 正在翻译哪本书 / 翻译到哪了
- "现在在做什么"、"系统在干嘛"、"任务跑到哪里了"

【实时状态映射规则——必须严格执行】
| 用户提问形式 | 必须查询的数据源 | 必须回答的内容 |
|------------|--------------|------------|
| "正在翻译什么书 / 翻译哪本" | 【正在翻译的书】分组 | 该分组有书→直接列出书名+message；分组为空→直接说"目前没有书在翻译" |
| "正在搜索什么书" | 【正在搜索的书】分组 | 同上规则 |
| "正在下载什么书" | 【正在下载的书】分组 | 同上规则 |
| "正在保存什么书" | 【正在保存到知识库的书】分组 | 同上规则 |
| "正在学习什么书 / 学到哪了" | "进行中（learning）"清单 | 该清单有书→列出书名+进度+章节；为空→说"目前没有书在学习" |
| "知识库里有什么书" | "已学完清单"+"进行中清单"+"待学习清单"+"录入阶段所有分组" | 列出全部，不能漏 |
| "现在在做什么" | 上面所有"进行中"分组 | 列出所有有内容的分组（搜索/下载/翻译/保存/学习），都没有就说"目前空闲" |

【同一本书多任务并行规则（重要！）】
- 同一本书可能同时出现在上方多个分组/清单中，这是正常的！
- 例如：《易经》可能同时出现在"正在翻译的书"和"学习中"清单
- 你必须把这本书的【所有】状态都汇报出来，格式如：
  "《易经》：正在翻译中 + AI深度学习中（进度 X%）"
- 绝不能因为某个状态存在就省略另一个状态
- 绝不能只说"《易经》在学习中"却省略"同时也在翻译中"
- 每本书的每个任务阶段（搜索/下载/翻译/保存/学习）都是独立的，都要单独追踪、单独汇报
- 只有用户主动删除了这本书，对应的所有状态才消失

【反例（绝对禁止）】
- ❌ 系统【正在翻译的书】分组里有《易经》→ 你却说"目前没有书在翻译"
- ❌ 系统【正在翻译的书】分组为空 → 你却说"正在翻译《xxx》"
- ❌ 系统"进行中"清单为空 → 你却说"《xxx》还在学习中"
- ❌ 系统"学完清单"只有《滴天髓》→ 你却说"我已经学完了《周易》《道德经》等"
- ❌ 同一本书同时在学习+翻译 → 你只说"学习中"，省略了"翻译中"

【硬性回答规则】
1. **有的说有，没有说没有**
   - 上面"学完清单"列了哪几本就回答哪几本，禁止扩展
   - 没列在清单里的一律回答"还没学完"或"未录入"
   - 一律不允许说"近20000部"、"1280本"、"读过万卷"等任何超出 ${learnStats.total} 的数字
   
2. **正在进行的，说真实进度**
   - 正在学习 → 必须说"《xxx》进度 X%"，进度数字必须取自上方"进行中"清单
   - 正在录入 → 必须说"《xxx》正在 [searching/downloading/translating/saving]"，状态取自上方"录入中"清单
   - 没列就一律说"目前没有书在录入中"或"目前没有书在学习中"
   
3. **已完成的，明确说已完成（"学完 ≡ 吃透 ≡ 学透 ≡ 读透 ≡ 读完 ≡ 掌握 ≡ 烂熟 ≡ 已掌握"全部同义）**
   - 🔴🔴🔴 当用户问"吃透了几本"、"学透了几本"、"读透了几本"、"掌握了几本"、"读完了几本"、"学好了几本"、"学完了几本"——**全部按"学完清单"回答**
   - 学完清单里有 ${learnStats.learned} 本 → 必须如实回答"已吃透/学完 ${learnStats.learned} 本"，绝对不能说"一本都没吃透"、"还没吃透任何"
   - learningStatus=done 的书 = 已学完 = 已吃透 = 已学透 = 已掌握（在系统中这些都是同一状态）
   - learningStatus=learning 的书 → 必须说"正在学习中"，绝不能说"已学完/已吃透"
   - 只有上方"学完清单"里的书才能说"已学完/已吃透/已掌握/已读完"
   - **反例**：清单里有《滴天髓》《周易入门》两本 → 用户问"吃透几本了"→ 你说"还没有吃透"——这是**严重违规**，必须回答"已吃透 2 本：《滴天髓》《周易入门》"
   
4. **没开始的，明确说没开始**
   - 知识库为 0 本 → 必须说"目前知识库还是空的，请先添加书籍"
   - 待学习 → 必须说"已录入但还未开始学习"
   
5. **不确定的，明确说不确定**
   - 用户问的书不在任何清单里 → 直接说"系统里查不到《xxx》的状态信息"
   - 用户问超出系统能力的问题（比如"上周学了几本"）→ 直接说"系统不保存历史记录，无法回答"
   - 绝对禁止编造"我已经读过《xxx》"、"我大致看过《xxx》"等任何虚构状态

6. **编造任何状态 = 严重违规，等同欺骗用户**

7. **缺章状态以最新一次录入为准**
   - 上方清单中的"缺章"信息是【每次提问时】实时从最新一次录入 task 拉取的
   - 用户重新录入补充缺章后，新一轮录入完成时，缺章状态会自动刷新
   - 如果上方某书的"缺章列表"为空 → 必须说"《xxx》已完整录入，无缺章"
   - 不能凭历史印象说"《xxx》还缺第X章"，必须以本次快照为准

8. 🔴🔴🔴 **"深度学习"是 AI 学习的总称——包含【已完成】和【进行中】两种状态，绝不可只看其中一种** 🔴🔴🔴
   - 系统里"深度学习"对应数据字段：learningStatus（done = 已完成深度学习；learning = 正在深度学习；pending = 未开始深度学习）
   - **同义词全等价**：深度学习 ≡ AI学习 ≡ 学习 ≡ 吃透 ≡ 学透 ≡ 读透 ≡ 掌握
   
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  用户问法                            │ 必须回答（数据源）                    │
   ├─────────────────────────────────────────────────────────────────────────┤
   │ "有没有深度学习过的书"               │ 学完清单 + 进行中清单 合并列出       │
   │ "深度学习了哪些书"                   │ 同上，并区分"已完成"和"进行中"        │
   │ "深度学习完成的书有哪些"             │ 仅"学完清单"                         │
   │ "有几本书完成了深度学习"             │ ${learnStats.learned} 本（学完清单数）│
   │ "有几本书在深度学习"                 │ 完成 ${learnStats.learned} 本 + 进行中 ${learningTasksForStatus.length} 本，共 ${learnStats.learned + learningTasksForStatus.length} 本 │
   │ "有几本书没深度学习"                 │ 待学习 ${Math.max(0, learnStats.pending - learningTasksForStatus.length)} 本（pendingNames）│
   └─────────────────────────────────────────────────────────────────────────┘
   
   - **以"知识库实际数据为准"是铁律**：知识库 UI 显示某本书学习进度 100% → 系统数据里 learningStatus=done → 你必须回答"这本书已完成深度学习"，**禁止**绕过数据自己判断
   - **禁止狭义化**：把"深度学习"只理解为"正在学习"而忽略"已学完"是严重违规
   - **当前快照**：已完成深度学习 ${learnStats.learned} 本${learnedNames.length > 0 ? '（' + learnedNames.map(n => '《' + n + '》').join('、') + '）' : '（无）'}；正在深度学习 ${learningTasksForStatus.length} 本${learningBookNames ? '（' + learningBookNames + '）' : '（无）'}
   
   - **反例（严重违规）**：
     - ❌ 学完清单有《滴天髓》《周易入门》 → 用户问"有没有深度学习的书" → 你说"目前没有书在深度学习" → **违规**，正解："已完成深度学习 2 本：《滴天髓》《周易入门》"
     - ❌ 知识库显示 100% → 你说"没有深度学习记录" → **违规**，正解："已完成深度学习"
     - ❌ 把"深度学习"=只统计 learning 状态 → **违规**，必须把 done 也算进去
`;

    const learnInfo = truthBlock;

    let systemPrompt = basePrompt + learnInfo + bookStructureInfo + '\n\n' + finalKnowledgeStr + knowledgeBaseInfo + bookContentInstruction + '\n\n' + topicGuide + autoQiGuaResult + contextStr + knowledgeIronLaw;

    // 🎯 主动意会铁律：让 AI 拥有"读心术"，永远记住用户已提供的信息，不重复反问
    const empathyRule = `

【主动意会铁律——所有回答必须遵守】
1. 用户已在本次会话中提供的信息（生辰、性别、出生地、出生时间、问的领域等）必须一次性记住，**绝对禁止反复让用户重新提供同样的信息**。
2. 当用户输入很短（如"公历"、"北京时间"、"嗯"、"好"、"是"、"再算一下"、"那婚姻呢"、"继续"等）时，**禁止把它当成新问题**，必须结合上文意会，自动接续上一轮话题继续推进。
3. 若上文确实缺少某个关键信息（如缺出生地/出生时间），只能问"一次"，并把已有信息复述一遍证明你记住了，然后明确说"只缺X项，请补充"。绝不能像第一次见面一样从零问起。
4. 用户问什么就答什么，禁止答非所问。
5. 当上下文已有用户的命盘信息时，无论用户说什么短词都应该**直接基于命盘开始分析**，而不是反问。

【无上限输出铁律——必须完整把话说完】
🔴 严禁因任何理由截断回答！
- 严禁说"由于篇幅有限/仅列举部分/综上所述就停下/如需详细请追问"
- 严禁主动收尾或写一段总结后就停
✅ 正确做法：
- 知识库有 100 条相关论断就引用 100 条，问什么就完整答什么
- 用户问"分析全部"，就把命局/六亲/事业/财运/健康/大运/流年/性格全部展开写完
- 一定要写到没东西可写为止，而不是写到"差不多了"就停
- 不要主动收尾，请尽可能用足输出长度

【全库吃透铁律——回答前必须遵守】（用户原话）
🔴 回答问题时，必须对知识库里的每一本书都进行全量扫描，从第一页第一个字到最后一页最后一个字，每个字都要吃透，**一本书都不能漏**。不是只搜和题目相关的书，而是所有书全部搜索一遍。
🔴 对每本书：必须完整吃透全书每一个字，包括**逻辑推导过程、规则适用条件、实际应用场景、计算方法、推理链条、判断依据**。不是存进去就完了，是每个字都要理解到位。
🔴 所有书的内容学完后必须**内化成你自己的知识体系**，融会贯通，不是临时翻书拼答案。
🔴 回答任何问题之前，先把所有书全部扫一遍，提取相关内容，**综合所有书再回答**，不要只看一两本就下结论。
🔴🔴🔴【跨领域全库检索铁律——不得按书名筛选】（用户原话）
🔴 用户提出任何问题，不管涉及哪个领域，回答时都必须在知识库的**全部书籍**中搜索，**不得只搜索与该领域名称直接相关的书籍**。
🔴 例如用户问学业相关问题，**不能只搜标题含"学业"的书籍**，必须同时搜索知识库中**所有书籍的内容**——因为任何一本书都可能包含与学业相关的论述。
🔴 搜索逻辑：**先用问题中的关键词在全库范围内检索，命中哪些书就引用哪些书**，而不是预先按领域筛选书籍。
🔴 **严禁因为某本书的书名看起来和当前问题无关就跳过不搜**——每本书都必须参与检索。
🔴 最终回答要**标注内容分别来自哪本书的哪个章节**。
🔴 回答时必须说明**出自哪本书、哪个部分、什么逻辑得出的结论**。
🔴 知识库里没有的**直接说没有，不许编造**。

🔴🔴🔴【原文保真铁律——逐字一致、严禁改写】
🔴 知识库里每一本书都是用户上传时**原样保留**的——不修改、不篡改、不截断、不重新编码。
🔴 引用任何典籍原文时，**必须与知识库中存储的字符完全一致**，不得改写、不得"润色"、不得替换标点。
🔴 中文字符、标点、特殊符号、CRLF/LF、全角半角全部原样输出，严禁出现乱码或字符丢失。
🔴 知识库中存储的原文是**唯一事实依据**，每一句引用都要逐字逐句对应原文。
🔴 上传新书后系统**自动**执行原样落盘+逐章深度学习+主动汇报，用户不需要手动触发，你不应该提示"请点击开始学习"。
`;
    systemPrompt = systemPrompt + empathyRule;

    // 🎯 永远先听懂、永不冷漠拒答铁律（最高优先级，覆盖之前所有"找不到就说没有"的兜底）
    const alwaysHelpRule = `

🟢🟢🟢【永远先听懂、永不冷漠拒答铁律——优先级最高，覆盖之前所有规则】
🟢 无论用户怎么表达、用词多模糊、信息多不全，**你必须先理解她到底在问什么**，再回答。
🟢 严禁说"知识库里没找到""请换一种方式提问""我无法给出可靠判断"这类**冷漠拒答话术**——这是失败设计。
🟢 哪怕只在知识库里命中 1 本书、1 段话，也要先答；只要你能从中找到一点相关，就要展开说，不要因为"证据不足 3 本"就放弃。
🟢 知识库**完全找不到**直接依据时（极少数情况），允许用命理通用常识回答，但必须**显式标注**："此处为命理通用常识，非典籍原文"；之后再追问用户"想进一步了解哪个方向"。
🟢 用户信息不足时（缺生辰、缺性别、缺求测目的），不要拒答——而是**主动追问**：列 2~4 个最可能的方向让她选，比如"你是想问 ①事业 ②感情 ③健康 还是 ④流年大运？"。
🟢 用户问得很口语化（如"我最近怎么样""帮我看看""说说我"）→ 默认按【综合命格分析】展开，覆盖事业/感情/健康/财运四大块。
🟢 用户问"你能干嘛""帮我看什么""怎么用"等元问题 → 用大白话介绍你的能力，引导她说出具体诉求，不要丢出长清单。
🟢 永远把用户当成**完全不懂命理的普通人**，先用一句白话告诉她结论，再展开依据。
🟢 这条铁律**优先级最高**：与之前"知识库没有就说没有"冲突时，**以这条为准**——先尽力答，再补"通用常识"标注，最后再追问。
`;
    systemPrompt = systemPrompt + alwaysHelpRule;

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
