import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { buildSystemPromptProfessional, buildSystemPromptCasual } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';
import { matchKnowledge, getAllKnowledge } from '@/lib/classic-knowledge';
import { matchExtendedKnowledge } from '@/lib/extended-classic-knowledge';
import { searchKnowledge, formatKnowledgeResults } from '@/lib/knowledge-search';
import { generateSanHeCanDuanPrompt, getSanHeCanDuanByTopic, SAN_HE_CAN_DUAN_GUIDE } from '@/lib/sanhe-canduan';
import { generateMianXiangFramework, getMianXiangPredictionGuide } from '@/lib/xiangxue';
import { generateShouXiangFramework, getShouXiangPredictionGuide } from '@/lib/shouxiang';
import { searchFullText, formatFullTextResults, getBookFullText, findBooksByName, getDetailedBookStats } from '@/lib/fulltext-search';
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
绝对不能忽略排盘数据中的休学风险标记！`;
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

    // 全文检索：从本地txt文件中搜索相关古籍原文段落（不限制！从第一个字到最后一个字完整收录！）
    const fullTextPassages = searchFullText(message, 0, 0, 0);
    const fullTextStr = formatFullTextResults(fullTextPassages);
    
    // 检测用户是否在问关于知识库本身的问题
    const isKnowledgeBaseQuestion = /知识库|多少本书|多少书|收录|录入|藏书|书库|英文.*翻译|翻译.*中文|整本书|完整.*录入|第一页.*最后|第一个字.*最后|全本|全文.*收录|有没有.*书/.test(message);
    let knowledgeBaseInfo = '';
    if (isKnowledgeBaseQuestion) {
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
    
    // 如果用户明确提到了某本书，直接获取该书完整全文
    const bookNameMatches = findBooksByName(message);
    let specificBookFullText = '';
    if (bookNameMatches.length > 0) {
      // 取最匹配的书籍（名称最短的=最精确匹配）
      const bestMatch = bookNameMatches.sort((a, b) => a.name.length - b.name.length)[0];
      const fullText = getBookFullText(bestMatch.name);
      if (fullText) {
        specificBookFullText = `\n\n【${bestMatch.name}完整全文（从第一个字到最后一个字，一字不漏）】\n${fullText}`;
      }
    }

    // 合并语义搜索结果、关键词匹配结果、扩展知识和全文检索结果（四者互补，不应二选一）
    const finalKnowledgeStr = (knowledgeSearchStr ? '【知识库语义检索结果】\n' + knowledgeSearchStr : '')
      + (classicKnowledgeStr ? '\n\n【关键词匹配补充知识】\n' + classicKnowledgeStr : '')
      + (extendedKnowledgeStr ? '\n\n【全部典籍核心论断——必须全部引用】\n' + extendedKnowledgeStr : '')
      + (fullTextStr ? '\n\n【典籍原文摘录（来自知识库藏书全文）——优先引用原文】\n' + fullTextStr : '')
      + (specificBookFullText ? specificBookFullText : '');

    // 知识库强制引用铁律（追加到systemPrompt最末尾，确保最高优先级）
    const knowledgeIronLaw = knowledgeResults.length > 0 || fullTextPassages.length > 0 || extendedKnowledgeResults.length > 0 || specificBookFullText
      ? '\n\n🔴🔴🔴【搜索铁律】回答问题时，必须遍历整个知识库中所有书籍来搜索答案，不要分领域、不要限定范围！搜索范围包括：知识库里的所有书籍、所有领域、所有内容！不是只搜索这个领域的书，是所有书都搜！只要和这个问题有关的内容，全部整合起来回答。收到问题 → 遍历知识库全部书籍 → 找到所有相关内容 → 综合整理成完整回答。不分领域、不限范围、所有书籍全部查！\n\n🔴🔴🔴【完整回答铁律】回答问题时，不要限制字数！用户问什么就完整回答什么，不要因为回答到一半就说"已到达字数限制"或者"回答已结束"就直接中断！完整回答要求：1.问题问什么就回答什么，要回答完整 2.不要中途截断，不要只回答一半 3.如果内容较长就完整分段输出，直到把答案全部说完为止 4.无论回答多少字都要完整输出，不设上限！问多少答多少，完整输出，不断章取义！\n\n🔴🔴🔴【知识库铁律——永久生效——绝对不可违反】🔴🔴🔴\n你的知识库中已检索到典籍论断和原文。你的回答必须遵循以下铁律：\n\n【最高原则】所有回答必须且只能来自知识库！知识库是唯一的回答来源！\n\n1. ⚠️ 你必须基于知识库中【所有】相关典籍论断和原文进行分析，一条都不能忽略！不是只看几条就下结论，是所有论断都要纳入分析！\n2. 你不需要把所有论断逐条罗列出来——而是要把所有论断消化吸收后，给出深度综合分析\n3. 分析过程中自然引用典籍论断的知识点，在判断逻辑中体现推理过程即可，⚠️禁止在回答中标注或出现任何书名（如《某某》），所有书籍知识消化吸收后融入分析\n4. 同一问题必须引用至少3本以上不同典籍的论断进行交叉验证后才能下结论\n5. 如果不同典籍论断有矛盾，必须如实说明矛盾点，不能只选一个\n6. 最终判断必须体现综合分析的结果，⚠️但禁止出现任何书名\n7. 不引用知识库内容就直接回答的判断，视为无效\n8. 🔴🔴🔴你的所有判断必须且只能来自知识库中真实存在的典籍论断，禁止凭空编造任何书籍名称、论断内容或案例。绝不许自行编造！\n9. 🔴🔴🔴知识库中没有的内容就是不知道！必须如实说"知识库中未找到相关典籍论断"，绝不许自行编造！\n10. 🔴回答不限制行数、字数、篇幅！该写多长就写多长，宁可详细不可遗漏！不要因为篇幅限制而压缩内容！\n11. 🔴🔴检索没有上限！无论原文检索还是任何检索，都没有数量上限！能检索多少就检索多少，能引用多少就引用多少！绝不允许因为"太多了"而省略任何内容！\n12. 🔴🔴你的回答也没有上限！知识库有100条论断就引用100条，有200条就引用200条！没有上限！没有上限！没有上限！\n13. 🔴🔴🔴书籍全文从第一个字到最后一个字完整收录！绝不允许以"字数到了"或"行数到了"为由截断！知识库中的每一本书都是完整的，你引用时也必须完整引用，不得删减！\n14. 🔴🔴🔴当用户提到具体书名时，知识库中该书的完整全文已经提供给你。你必须基于完整全文来回答，不得只看部分章节！'
      : '\n\n🔴🔴🔴【知识库铁律——永久生效——绝对不可违反】🔴🔴🔴\n⚠️ 知识库中未检索到与用户问题相关的典籍论断！\n你必须遵循以下规则：\n1. 🔴🔴🔴你不能凭空编造任何命理判断，所有判断必须有典籍依据\n2. 🔴🔴🔴没有知识库论断支撑的问题，你必须明确告知用户"此问题在现有典籍知识库中未找到充分依据，我无法给出可靠判断"\n3. 你可以建议用户换一种方式提问，或者告诉用户哪些领域的问题你能够基于典籍给出判断\n4. 🔴🔴🔴禁止在没有典籍依据的情况下给出看似专业的判断——那不是分析，是编造！\n5. 如果只能给出部分判断，必须明确标注哪些部分有典籍依据、哪些部分是推测\n6. 🔴🔴🔴所有回答必须且只能来自知识库！知识库是唯一的回答来源！知识库中没有的就是不知道！';

    const basePrompt = mode === 'professional'
      ? buildSystemPromptProfessional(birthInfoStr)
      : buildSystemPromptCasual(birthInfoStr);
    
    // 加入三合参断话题指引
    const topicGuide = getSanHeCanDuanByTopic(message);
    // 加入自动起卦/排盘
    const autoQiGuaResult = autoQiGua(message, birthInfo ? (birthInfo as BirthInfo) : null);
    const contextStr = context ? `\n\n【前置分析结果】\n${context}\n请在以上分析结果基础上，继续深入回答用户的问题。` : '';
    const systemPrompt = basePrompt + '\n\n' + finalKnowledgeStr + knowledgeBaseInfo + '\n\n' + topicGuide + autoQiGuaResult + contextStr + knowledgeIronLaw;

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
