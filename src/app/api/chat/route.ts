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
    // 匹配扩展知识库（全部书籍的核心内容，截断至8000字符避免超限）
    const extendedKnowledgeResults = matchExtendedKnowledge(message);
    let extendedKnowledgeStr = extendedKnowledgeResults.length > 0
      ? extendedKnowledgeResults.map(r => r.corePoints).join('\n\n')
      : '';
    if (extendedKnowledgeStr.length > 8000) {
      extendedKnowledgeStr = extendedKnowledgeStr.substring(0, 8000) + '\n\n[...更多典籍论断已截断，请基于以上内容回答]';
    }

    // 知识库语义搜索（向量化检索，精准度更高）
    // 搜索用户消息+排盘相关的所有领域知识
    const searchQuery = message + (birthInfoStr ? ' 命理八字紫微面相手相' : '');
    const knowledgeResults = await searchKnowledge(searchQuery);
    const knowledgeSearchStr = formatKnowledgeResults(knowledgeResults);

    // 合并语义搜索结果、关键词匹配结果和扩展知识（三者互补，不应二选一）
    const finalKnowledgeStr = (knowledgeSearchStr ? '【知识库语义检索结果】\n' + knowledgeSearchStr : '')
      + (classicKnowledgeStr ? '\n\n【关键词匹配补充知识】\n' + classicKnowledgeStr : '')
      + (extendedKnowledgeStr ? '\n\n【全部典籍核心论断——必须全部引用】\n' + extendedKnowledgeStr : '');

    // 知识库强制引用铁律（追加到systemPrompt最末尾，确保最高优先级）
    const knowledgeIronLaw = knowledgeResults.length > 0
      ? '\n\n🔴🔴🔴【知识库铁律——永久生效——无上限】🔴🔴🔴\n你的知识库中已检索到大量典籍论断。你的回答必须遵循：\n1. ⚠️ 你必须基于知识库中【所有】相关典籍论断进行分析，一条都不能忽略！不是只看几条就下结论，是所有论断都要纳入分析！\n2. 你不需要把所有论断逐条罗列出来——而是要把所有论断消化吸收后，给出深度综合分析\n3. 分析过程中自然引用典籍论断的知识点，在判断逻辑中体现推理过程即可，⚠️禁止在回答中标注或出现任何书名（如《某某》），所有书籍知识消化吸收后融入分析\n4. 同一问题必须引用至少3本以上不同典籍的论断进行交叉验证后才能下结论\n5. 如果不同典籍论断有矛盾，必须如实说明矛盾点，不能只选一个\n6. 最终判断必须体现综合分析的结果，⚠️但禁止出现任何书名\n7. 不引用知识库内容就直接回答的判断，视为无效\n8. 你的所有判断必须且只能来自知识库中真实存在的典籍论断，禁止凭空编造任何书籍名称、论断内容或案例\n9. 知识库中没有的内容就是不知道，必须如实说"知识库中未找到相关典籍论断"，绝不许自行编造\n10. 🔴回答不限制行数、字数、篇幅！该写多长就写多长，宁可详细不可遗漏！不要因为篇幅限制而压缩内容！\n11. 🔴🔴检索没有上限！无论原文检索还是任何检索，都没有数量上限！能检索多少就检索多少，能引用多少就引用多少！绝不允许因为"太多了"而省略任何内容！\n12. 🔴🔴你的回答也没有上限！知识库有100条论断就引用100条，有200条就引用200条！没有上限！没有上限！没有上限！'
      : '\n\n🔴🔴🔴【知识库铁律——永久生效——无上限】🔴🔴🔴\n⚠️ 知识库中未检索到与用户问题相关的典籍论断！\n你必须遵循以下规则：\n1. 你不能凭空编造任何命理判断，所有判断必须有典籍依据\n2. 没有知识库论断支撑的问题，你必须明确告知用户"此问题在现有典籍知识库中未找到充分依据，我无法给出可靠判断"\n3. 你可以建议用户换一种方式提问，或者告诉用户哪些领域的问题你能够基于典籍给出判断\n4. 禁止在没有典籍依据的情况下给出看似专业的判断——那不是分析，是编造\n5. 如果只能给出部分判断，必须明确标注哪些部分有典籍依据、哪些部分是推测';

    const basePrompt = mode === 'professional'
      ? buildSystemPromptProfessional(birthInfoStr)
      : buildSystemPromptCasual(birthInfoStr);
    
    // 加入三合参断话题指引
    const topicGuide = getSanHeCanDuanByTopic(message);
    // 加入自动起卦/排盘
    const autoQiGuaResult = autoQiGua(message, birthInfo ? (birthInfo as BirthInfo) : null);
    const contextStr = context ? `\n\n【前置分析结果】\n${context}\n请在以上分析结果基础上，继续深入回答用户的问题。` : '';
    const systemPrompt = basePrompt + '\n\n' + finalKnowledgeStr + '\n\n' + topicGuide + autoQiGuaResult + contextStr + knowledgeIronLaw;

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
