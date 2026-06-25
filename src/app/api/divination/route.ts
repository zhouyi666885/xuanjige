import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { divinationPrompts, THREE_IRON_RULES, KNOWLEDGE_IRON_LAW_FOUND, KNOWLEDGE_IRON_LAW_NOT_FOUND } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';
import { matchKnowledge } from '@/lib/classic-knowledge';
import { matchExtendedKnowledge } from '@/lib/extended-classic-knowledge';
import { searchKnowledge, formatKnowledgeResults } from '@/lib/knowledge-search';
import { generateSanHeCanDuanPrompt, getSanHeCanDuanByTopic, SAN_HE_CAN_DUAN_GUIDE } from '@/lib/sanhe-canduan';
import { generateMianXiangFramework, getMianXiangPredictionGuide } from '@/lib/xiangxue';
import { generateShouXiangFramework, getShouXiangPredictionGuide } from '@/lib/shouxiang';
import { tongQianQiGua, shiJianQiGua as liuyaoShiJian, formatLiuYaoPaiPan as liuyaoFormat } from '@/lib/liuyao';
import { shiJianQiGua as meihuaShiJian, shuZiQiGua, wenZiQiGua, formatMeiHuaPaiPan as meihuaFormat } from '@/lib/meihua';
import { paiPan as qimenPaiPan, formatQiMenPaiPan as qimenFormat } from '@/lib/qimen';
import { paiPan as liurenPaiPan, formatLiuRenPaiPan as liurenFormat } from '@/lib/liuren';
import { paiPan as fengshuiPaiPan, formatFengShuiPaiPan as fengshuiFormat } from '@/lib/fengshui';
import { calculateXingMing as xingmingCalculate, formatXingMingPaiPan as xingmingFormat } from '@/lib/xingming';
import { searchFullText, formatFullTextResults, getDetailedBookStats, findBooksByName, getBookFullText, getBookChapterContent, parseChapterRange, getLearnedBookCount, getBookLearnStatus } from '@/lib/fulltext-search';

export const dynamic = 'force-dynamic';

const typeToKeywords: Record<string, string> = {
  bazi: '八字命理 四柱排盘',
  ziwei: '紫微斗数 命盘',
  liuyao: '六爻 火珠林',
  meihua: '梅花易数',
  qimen: '奇门遁甲',
  liuren: '大六壬',
  fengshui: '风水地理',
  xingming: '姓名学',
};

export async function POST(request: NextRequest) {
  try {
    const { type, input, mode = 'casual', birthInfo } = await request.json();

    const promptMap: Record<string, string> = {
      bazi: divinationPrompts.bazi,
      liuyao: divinationPrompts.liuyao,
      meihua: divinationPrompts.meihua,
      ziwei: divinationPrompts.ziwei,
      qimen: divinationPrompts.qimen,
      liuren: divinationPrompts.liuren,
      fengshui: divinationPrompts.fengshui,
      xingming: divinationPrompts.xingming,
    };

    const baseSystemPrompt = promptMap[type];
    if (!baseSystemPrompt) {
      return new Response(JSON.stringify({ error: '不支持的测算类型' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const keywords = typeToKeywords[type] || '';
    // 知识库语义搜索（向量化检索，精准度更高）
    const searchQuery = (input || keywords) + ' 命理八字紫微面相手相';
    const knowledgeResults = await searchKnowledge(searchQuery);
    const knowledgeSearchStr = formatKnowledgeResults(knowledgeResults);
    // 关键词匹配兜底
    const classicKnowledgeStr = keywords ? matchKnowledge(keywords) : '';
    // 扩展知识库匹配——全部典籍内容（绝不截断！从第一个字到最后一个字完整收录！）
    const extendedKnowledgeResults = matchExtendedKnowledge(searchQuery);
    const extendedKnowledgeStr = extendedKnowledgeResults.map(r => r.corePoints).join('\n\n');
    // 全文检索：从本地txt文件中搜索相关古籍原文段落（不限制！从第一个字到最后一个字完整收录！）
    const fullTextPassages = searchFullText(searchQuery, 0, 0, 0);
    const fullTextStr = formatFullTextResults(fullTextPassages);

    const finalKnowledgeStr = (knowledgeSearchStr || (classicKnowledgeStr ? '\n\n' + classicKnowledgeStr : '') || (extendedKnowledgeStr ? '\n\n' + extendedKnowledgeStr : '')
      + (fullTextStr ? '\n\n' + fullTextStr : ''))
      + '\n\n【知识库学习指引——学思路不学结果】以上知识库内容不是让你照搬原文，而是让你学习其中的分析思路和方法论。重点关注：1.宗师看到某组合时按什么逻辑推理；2.用神忌神在实际案例中如何运用；3.宫位星曜配合的判断规则；4.大运流年叠加的具体方法。理解其分析逻辑后融入你自己的推理链，不是机械复制原文凑数。';
    
    // 知识库强制引用铁律
    const knowledgeIronLaw = THREE_IRON_RULES + (knowledgeResults.length > 0 || fullTextPassages.length > 0 || extendedKnowledgeResults.length > 0
      ? KNOWLEDGE_IRON_LAW_FOUND
      : KNOWLEDGE_IRON_LAW_NOT_FOUND);
    
    // 检测用户是否在问关于知识库本身的问题
    const isKnowledgeBaseQuestion = /知识库|多少本书|多少书|收录|录入|藏书|书库|英文.*翻译|翻译.*中文|整本书|完整.*录入|第一页.*最后|第一个字.*最后|全本|全文.*收录|有没有.*书/.test(input);
    
    // 检测用户是否要求查看某本书的全文或章节
    const isBookContentRequest = /全文|内容|发给我|发过来|给我看|看看|查看|读一读|章节|第[一二三四五六七八九十百千零\d]+[卦篇章卷部节回]|前[一二三四五六七八九十百千零\d]+[卦篇章卷部节回]|原文|原文内容|书里.*写|书上.*说/.test(input);
    
    let knowledgeBaseInfo = '';
    let bookContentInfo = '';
    if (isKnowledgeBaseQuestion && !isBookContentRequest) {
      const stats = getDetailedBookStats();
      knowledgeBaseInfo = `\n\n【知识库实时统计信息——用户正在询问知识库相关情况，必须如实回答】
📚 知识库总藏书量：${stats.bookCount} 本
📝 总字符数：${stats.totalChars.toLocaleString()} 字
📊 平均每本：${stats.avgCharsPerBook.toLocaleString()} 字
🇨🇳 中文原版书：${stats.chineseBookCount} 本
🇬🇧 英文原版书：${stats.englishBookCount} 本（已全部翻译为中文：${stats.englishTranslatedCount} 本，未翻译：${stats.englishUntranslatedCount} 本）

【知识库录入规则】
1. 每本书从第一页第一个字到最后一页最后一个字完整录入，一个字都不遗漏
2. 所有英文原版书均已翻译为中文，翻译同样从第一个字到最后一个字完整翻译
3. 书籍目录按原书叫法显示（卦就写卦、章就写章、卷就写卷）

请根据以上实时统计数据如实回答用户关于知识库的问题。`;
    } else if (isBookContentRequest) {
      // 检测书籍内容请求
      const bookNameMatches = findBooksByName(input);
      if (bookNameMatches.length > 0) {
        const bestMatch = bookNameMatches.sort((a, b) => a.name.length - b.name.length)[0];
        const chapterRange = parseChapterRange(input);
        const bookContent = getBookChapterContent(bestMatch.name, chapterRange || undefined);
        
        if (bookContent) {
          bookContentInfo = `\n\n【《${bestMatch.name}》${bookContent.requestedChapters}——从第一个字到最后一个字完整呈现，绝不截断】
总${bookContent.structureType}数：${bookContent.totalChapters}
当前显示：${bookContent.requestedChapters}

${bookContent.content}

【书籍内容输出指令——最高优先级！】
用户要求查看《${bestMatch.name}》的内容。你必须：
1. 将上方的书籍原文完整输出给用户，从第一个字到最后一个字，一个字都不许省略！
2. 绝对不允许限制字数！绝对不允许限制行数！
3. 绝对不允许以"字数到了""行数到了""篇幅有限"为由截断！
4. 原文有多长就输出多长，完整输出，不断章取义！
5. 输出格式：直接输出原文内容，不需要额外解释`;
        }
      }
    }

    // 加入学习状态信息
    const learnStats = getLearnedBookCount();
    const learnInfo = `\n\n🔴【学习状态】系统已自动学习知识库中全部${learnStats.learned}本书籍（从第一页第一个字到最后一页最后一个字全部学会），你已是一位通读万卷书的学者，回答问题时要像消化吸收过一样专业、精准、有深度！`;

    // 检测书籍结构问题（多少章/卦/卷/学到第几章）
    let bookStructureInfo = '';
    const structureQuestionMatch = input.match(/(.+?)(?:一共有|总共有|有多少)(多少|几|几多)(?:个|个的)?(章|卦|卷|篇|部|节|回|品|门|诀|式|局)/);
    const learningProgressMatch = input.match(/(.+?)(?:学到|学完|学到了|学到第|学到了第)(第?.+)/);
    const bookStructureNameMatch = input.match(/《(.+?)》.*(?:结构|目录|章|卦|卷|篇)/);
    const structureBookName = structureQuestionMatch?.[1]?.replace(/[《》？?]/g, '').trim()
      || learningProgressMatch?.[1]?.replace(/[《》？?]/g, '').trim()
      || bookStructureNameMatch?.[1]?.trim();
    if (structureBookName) {
      const status = getBookLearnStatus(structureBookName);
      if (status) {
        bookStructureInfo = `\n\n📚【书籍结构信息 - ${structureBookName}】\n- 总${status.chapterStructure || '章'}数：${status.totalChapters || '未知'}\n- 已学习：${status.learnedChapters || 0} / ${status.totalChapters || '未知'}\n- 学习进度：${status.totalChapters ? Math.round((status.learnedChapters || 0) / status.totalChapters * 100) : 0}%\n- 章节结构类型：${status.chapterStructure || '未知'}\n请根据以上数据准确回答用户关于书籍结构的问题。`;
      }
    }

    let systemPrompt = baseSystemPrompt + learnInfo + bookStructureInfo + finalKnowledgeStr + knowledgeBaseInfo + bookContentInfo + knowledgeIronLaw;

    const modeInstruction = mode === 'professional'
      ? '请用专业术语进行解读，将典籍知识融入分析逻辑中，禁止出现任何书名。'
      : '请用通俗易懂的语言进行解读，像朋友聊天一样，将典籍知识融入白话解读中，禁止出现任何书名。';

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    let userInput = input;
    let paiPanAppend = '';
    const currentYear = new Date().getFullYear();

    // 对于八字和紫微，使用真实排盘数据 + 三合参断
    if (birthInfo && (type === 'bazi' || type === 'ziwei')) {
      const { gender, birthYear, birthMonth, birthDay, birthHour, birthMinute, province, city, district } = birthInfo;
      const parts: string[] = [];
      if (gender) parts.push(`性别：${gender}`);
      if (birthYear && birthMonth && birthDay) {
        parts.push(`出生日期：${birthYear}年${birthMonth}月${birthDay}日`);
      }
      if (birthHour !== undefined && birthMinute !== undefined) {
        parts.push(`出生时间：${birthHour}时${birthMinute}分`);
      }
      if (province) {
        let loc = `出生地：${province}`;
        if (city) loc += ` ${city}`;
        if (district) loc += ` ${district}`;
        parts.push(loc);
      }
      if (parts.length > 0) {
        userInput = parts.join('\n') + '\n\n' + input;
      }

      // 计算八字排盘
      let baziYearGan = '';
      let baziYearZhi = '';
      let baziResult: ReturnType<typeof paiPan> | null = null;
      try {
        const g = gender === '男' ? 'male' : 'female';
        baziResult = paiPan(g, birthYear, birthMonth, birthDay, birthHour, birthMinute, province || '');
        const baziText = formatPaiPanFull(baziResult, currentYear);
        paiPanAppend = `\n\n【八字精确排盘结果（代码计算，非AI脑补）】\n${baziText}`;
        paiPanAppend += `\n\n【八字实战预测】\n${formatShiZhanPrediction(baziResult, currentYear)}`;
        baziYearGan = baziResult.yearPillar.gan;
        baziYearZhi = baziResult.yearPillar.zhi;
      } catch (e) {
        paiPanAppend = '\n\n[八字排盘计算出错]';
      }

      // 计算紫微斗数排盘
      let ziweiResult: ReturnType<typeof ziweiPaiPan> | null = null;
      if (baziYearGan && baziResult) {
        try {
          ziweiResult = ziweiPaiPan({
            year: birthYear, month: birthMonth, day: birthDay,
            hour: birthHour, minute: birthMinute,
            gender: gender === '男' ? '男' : '女',
            yearGan: baziYearGan, yearZhi: baziYearZhi,
          });
          paiPanAppend += `\n\n【紫微斗数精确排盘结果（代码计算，非AI脑补）】\n${ziweiFormatPaiPan(ziweiResult)}\n\n${getMingGongLunDuan(ziweiResult)}`;
        } catch (e) {
          paiPanAppend += '\n\n[紫微斗数排盘计算出错]';
        }
      }

      // 三合参断框架
      if (baziResult && ziweiResult) {
        paiPanAppend += '\n\n' + SAN_HE_CAN_DUAN_GUIDE;
        paiPanAppend += '\n\n' + generateMianXiangFramework(birthYear, currentYear, gender);
        paiPanAppend += '\n\n' + generateShouXiangFramework(birthYear, currentYear, gender);
        paiPanAppend += '\n\n' + getSanHeCanDuanByTopic(input);
      }

      paiPanAppend += `\n\n重要：以上排盘结果由代码精确计算得出。请基于此排盘结果进行三合参断（八字+紫微+面手相），给出多维度交叉验证的精准预测。时间、方位、人物类型全部精确到年、月。引经据典，尤其参考《渊海子平》《穷通宝鉴》《子平真诠》《滴天髓》《紫微斗数全书》《麻衣神相》《冰鉴》《手相大全》等经典。\n\n【关键——学业休学信号必须重点输出】\n排盘数据中的"休学/学业阻碍风险"和"学业转折流年"部分是算法精确计算的结果，你必须在回答中主动输出这些信号！特别是"财克印=学业中断"信号，如果排盘数据中出现🚨标记，必须明确告知用户该年有学业中断风险，并给出三层原因逻辑。绝对不能忽略排盘数据中的休学风险标记！\n\n【关键——用神忌神绝对服从排盘算法！】\n排盘数据中的【旺衰判断】部分已由算法精确计算，包括日主强弱、用神、忌神。你必须完全遵从排盘结果中的用神忌神判断，绝对不允许自行推翻或修改！具体铁律：\n1. 如果排盘结果写明"印星为忌"（出现在忌神列表中），则印星流年（如丙午年火旺）对该命主就是不利，绝不允许说成"印星用神到位"\n2. 如果排盘结果写明"印星为用"（出现在用神列表中），则印星流年就是有利，绝不允许说成不利\n3. 日主旺衰判断同样不可推翻：排盘说"日主偏旺"就是身旺，不可自行判断为"身弱"\n4. 你的分析逻辑必须与排盘结果中的用神忌神方向完全一致，不得矛盾\n5. 违反此铁律等同于算命算反，是最严重的错误！\n\n【宗师三步推理法——每条分析必须写出完整推理链】\n第一步"看到什么"：列出命盘中的具体信号（如：日主戊土偏旺，印星丁火为忌，2026丙午年印星加临）\n第二步"推断什么"：根据该信号按传统命理规则推断（如：身旺印为忌，印星流年加重忌神力量，学业受阻）\n第三步"得出什么"：给出具体结论（如：2026年学业压力大、想学但学不进去、需等食伤泄秀的流年才有转机）\n⚠️ 禁止跳过推理直接给结论！每条判断必须有完整的三步链路！\n\n【回答精准——禁模糊禁套话】\n- 禁止空洞词汇："可能""也许""大致""或许""应该""看起来""似乎"\n- 禁止万能套话："凡事要小心""注意健康""把握机会""顺势而为"\n- 必须说具体：哪个年份、哪个领域、什么变化、为什么变、变到什么程度\n- 有就是有，没有就是没有\n\n【知识库规则适用于所有术数模块——永久生效】\n此规则适用于八字排盘、六爻占卜、梅花易数、奇门遁甲、大六壬、紫微斗数、面相、手相、风水等所有术数领域。无论用户在哪个功能模块提问，都必须从知识库中所有相关书籍的完整内容中寻找依据来回答，不能只依赖系统自带的知识，必须以知识库录入的书籍内容为准。\n\n【学推理过程而非学结论——永久生效】\n深入学习每本书中的分析逻辑和推断方法，包括大师们如何从命盘中提取信息、如何一步步推导出结论的完整思维过程。重点学会推理的过程和方法，不是只记住最终结论或断语，而是掌握"为什么这样判断"的逻辑链条，这样才能灵活应用到每个用户的具体命盘中。学的是"宗师看到某个组合会怎么分析"的思路，不是"某本书说某组合主凶"的结论！`;
    } else if (birthInfo) {
      const { gender, birthYear, birthMonth, birthDay, birthHour, birthMinute, province, city, district } = birthInfo;
      const parts: string[] = [];
      if (gender) parts.push(`性别：${gender}`);
      if (birthYear && birthMonth && birthDay) {
        parts.push(`出生日期：${birthYear}年${birthMonth}月${birthDay}日`);
      }
      if (birthHour !== undefined && birthMinute !== undefined) {
        parts.push(`出生时间：${birthHour}时${birthMinute}分`);
      }
      if (province) {
        let loc = `出生地：${province}`;
        if (city) loc += ` ${city}`;
        if (district) loc += ` ${district}`;
        parts.push(loc);
      }

      // 六爻起卦
      if (type === 'liuyao') {
        try {
          // 用时间起卦，日干日支从八字排盘推算
          const bazi = paiPan(gender === '男' ? 'male' : 'female', birthYear, birthMonth, birthDay, birthHour || 12, birthMinute || 0, province || '');
          const guaResult = liuyaoShiJian(birthYear, birthMonth, birthDay, birthHour || 12, bazi.dayPillar.gan, bazi.dayPillar.zhi, bazi.monthPillar.zhi, input);
          paiPanAppend = `\n\n【六爻起卦结果（代码计算，非AI脑补）】\n${liuyaoFormat(guaResult)}`;
        } catch (e) {
          paiPanAppend = '\n\n[六爻起卦计算出错]';
        }
      }

      // 梅花易数起卦
      if (type === 'meihua') {
        try {
          const guaResult = meihuaShiJian(birthYear, birthMonth, birthDay, birthHour || 12, input);
          paiPanAppend = `\n\n【梅花易数起卦结果（代码计算，非AI脑补）】\n${meihuaFormat(guaResult)}`;
        } catch (e) {
          paiPanAppend = '\n\n[梅花易数起卦计算出错]';
        }
      }

      // 奇门遁甲排盘
      if (type === 'qimen') {
        try {
          const bazi = paiPan(gender === '男' ? 'male' : 'female', birthYear, birthMonth, birthDay, birthHour || 12, birthMinute || 0, province || '');
          const qmResult = qimenPaiPan(birthMonth, birthDay, birthHour || 12, bazi.dayPillar.gan + bazi.dayPillar.zhi);
          paiPanAppend = `\n\n【奇门遁甲排盘结果（代码计算，非AI脑补）】\n${qimenFormat(qmResult)}`;
        } catch (e) {
          paiPanAppend = '\n\n[奇门遁甲排盘计算出错]';
        }
      }

      // 大六壬排盘
      if (type === 'liuren') {
        try {
          const bazi = paiPan(gender === '男' ? 'male' : 'female', birthYear, birthMonth, birthDay, birthHour || 12, birthMinute || 0, province || '');
          const lrResult = liurenPaiPan(birthYear, birthMonth, birthDay, birthHour || 12, bazi.dayPillar.gan, bazi.dayPillar.zhi);
          paiPanAppend = `\n\n【大六壬排盘结果（代码计算，非AI脑补）】\n${liurenFormat(lrResult)}`;
        } catch (e) {
          paiPanAppend = '\n\n[大六壬排盘计算出错]';
        }
      }

      // 风水排盘
      if (type === 'fengshui' && birthYear) {
        try {
          const fsResult = fengshuiPaiPan(birthYear || currentYear, '坎', '离');
          paiPanAppend = `\n\n【风水排盘结果（代码计算，非AI脑补）】\n${fengshuiFormat(fsResult)}`;
        } catch (e) {
          paiPanAppend = '\n\n[风水排盘计算出错]';
        }
      }

      // 姓名测算
      if (type === 'xingming' && input) {
        try {
          const xmResult = xingmingCalculate(input);
          paiPanAppend = `\n\n【姓名测算结果（代码计算，非AI脑补）】\n${xingmingFormat(xmResult)}`;
        } catch (e) {
          paiPanAppend = '\n\n[姓名测算计算出错]';
        }
      }

      // 对于有出生信息的六爻/梅花/奇门/六壬，也追加八字紫微双盘辅助参断
      if (['liuyao', 'meihua', 'qimen', 'liuren'].includes(type) && birthYear && birthMonth && birthDay) {
        try {
          const g = gender === '男' ? 'male' : 'female';
          const baziResult = paiPan(g, birthYear, birthMonth, birthDay, birthHour || 12, birthMinute || 0, province || '');
          paiPanAppend += `\n\n【辅助参断·八字排盘】\n${formatPaiPanFull(baziResult, currentYear)}`;
          const ziweiResult = ziweiPaiPan({
            year: birthYear, month: birthMonth, day: birthDay,
            hour: birthHour || 12, minute: birthMinute || 0,
            gender: gender === '男' ? '男' : '女',
            yearGan: baziResult.yearPillar.gan, yearZhi: baziResult.yearPillar.zhi,
          });
          paiPanAppend += `\n\n【辅助参断·紫微斗数排盘】\n${ziweiFormatPaiPan(ziweiResult)}`;
          paiPanAppend += '\n\n重要：请结合上述排盘/起卦结果与八字紫微辅助盘，进行交叉参断。时间精确到年月。引经据典。';
        } catch (_e) {
          // 辅助排盘失败不影响主流程
        }
      }

      if (parts.length > 0) {
        userInput = parts.join('\n') + '\n\n' + input;
      }
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt + paiPanAppend + '\n\n' + modeInstruction },
      { role: 'user' as const, content: userInput },
    ];

    let stream;
    try {
      stream = client.stream(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: mode === 'professional' ? 0.4 : 0.7,
      });
    } catch (e) {
      console.error('Stream creation error:', e);
      return new Response(JSON.stringify({ error: '创建流失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成内容出错' })}\n\n`));
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
    console.error('Divination API error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
