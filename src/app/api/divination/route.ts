import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { divinationPrompts } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';
import { matchKnowledge } from '@/lib/classic-knowledge';
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
    const finalKnowledgeStr = knowledgeSearchStr || (classicKnowledgeStr ? '\n\n' + classicKnowledgeStr : '');
    
    // 知识库强制引用铁律
    const knowledgeIronLaw = knowledgeResults.length > 0
      ? '\n\n🔴🔴🔴【知识库铁律——永久生效——无上限】🔴🔴🔴\n你的知识库中已检索到大量典籍论断。你的回答必须遵循：\n1. ⚠️ 你必须基于知识库中【所有】相关典籍论断进行分析，一条都不能忽略！不是只看几条就下结论，是所有论断都要纳入分析！\n2. 你不需要把所有论断逐条罗列出来——而是要把所有论断消化吸收后，给出深度综合分析\n3. 分析过程中自然引用典籍论断的知识点，在判断逻辑中体现推理过程即可，⚠️禁止在回答中标注或出现任何书名（如《某某》），所有书籍知识消化吸收后融入分析\n4. 同一问题必须引用至少3本以上不同典籍的论断进行交叉验证后才能下结论\n5. 如果不同典籍论断有矛盾，必须如实说明矛盾点，不能只选一个\n6. 最终判断必须体现综合分析的结果，⚠️但禁止出现任何书名\n7. 不引用知识库内容就直接回答的判断，视为无效\n8. 你的所有判断必须且只能来自知识库中真实存在的典籍论断，禁止凭空编造任何书籍名称、论断内容或案例\n9. 知识库中没有的内容就是不知道，必须如实说"知识库中未找到相关典籍论断"，绝不许自行编造\n10. 🔴回答不限制行数、字数、篇幅！该写多长就写多长，宁可详细不可遗漏！不要因为篇幅限制而压缩内容！\n11. 🔴🔴检索没有上限！无论原文检索还是任何检索，都没有数量上限！能检索多少就检索多少，能引用多少就引用多少！绝不允许因为"太多了"而省略任何内容！\n12. 🔴🔴你的回答也没有上限！知识库有100条论断就引用100条，有200条就引用200条！没有上限！没有上限！没有上限！'
      : '\n\n🔴🔴🔴【知识库铁律——永久生效——无上限】🔴🔴🔴\n⚠️ 知识库中未检索到与用户问题相关的典籍论断！\n你必须遵循以下规则：\n1. 你不能凭空编造任何命理判断，所有判断必须有典籍依据\n2. 没有知识库论断支撑的问题，你必须明确告知用户"此问题在现有典籍知识库中未找到充分依据，我无法给出可靠判断"\n3. 你可以建议用户换一种方式提问，或者告诉用户哪些领域的问题你能够基于典籍给出判断\n4. 禁止在没有典籍依据的情况下给出看似专业的判断——那不是分析，是编造\n5. 如果只能给出部分判断，必须明确标注哪些部分有典籍依据、哪些部分是推测';
    
    const systemPrompt = baseSystemPrompt + finalKnowledgeStr + knowledgeIronLaw;

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

      paiPanAppend += '\n\n重要：以上排盘结果由代码精确计算得出。请基于此排盘结果进行三合参断（八字+紫微+面手相），给出多维度交叉验证的精准预测。时间、方位、人物类型全部精确到年、月。引经据典，尤其参考《渊海子平》《穷通宝鉴》《子平真诠》《滴天髓》《紫微斗数全书》《麻衣神相》《冰鉴》《手相大全》等经典。\n\n【关键——学业休学信号必须重点输出】\n排盘数据中的"休学/学业阻碍风险"和"学业转折流年"部分是算法精确计算的结果，你必须在回答中主动输出这些信号！特别是"财克印=学业中断"信号，如果排盘数据中出现🚨标记，必须明确告知用户该年有学业中断风险，并给出三层原因逻辑。绝对不能忽略排盘数据中的休学风险标记！';
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
