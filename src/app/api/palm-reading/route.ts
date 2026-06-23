import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { palmReadingPrompt } from '@/lib/knowledge';
import { searchKnowledge, formatKnowledgeResults } from '@/lib/knowledge-search';
import { matchExtendedKnowledge } from '@/lib/extended-classic-knowledge';
import { searchFullText, formatFullTextResults } from '@/lib/fulltext-search';
import { generateShouXiangFramework, getShouXiangPredictionGuide } from '@/lib/shouxiang';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan } from '@/lib/ziwei';
import { generateSanHeCanDuanPrompt } from '@/lib/sanhe-canduan';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { image, mode = 'casual', birthInfo } = await request.json();

    if (!image) {
      return new Response(JSON.stringify({ error: '请提供手掌照片' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const modeInstruction = mode === 'professional'
      ? '请用专业术语进行手相分析，将典籍知识融入分析逻辑中，禁止出现任何书名。'
      : '请用通俗易懂的语言进行手相分析，像朋友聊天一样，将典籍知识融入白话解读中，禁止出现任何书名。';

    const currentYear = new Date().getFullYear();
    let shouXiangFramework = '';

    const hasBirthInfo = birthInfo && birthInfo.gender && birthInfo.birthYear && birthInfo.birthMonth && birthInfo.birthDay;

    if (hasBirthInfo) {
      shouXiangFramework = generateShouXiangFramework(birthInfo.birthYear, currentYear, birthInfo.gender);
    }

    const shouXiangGuide = getShouXiangPredictionGuide();

    let sanHeCanDuanPrompt = '';
    if (hasBirthInfo && birthInfo.birthHour) {
      const bYear = birthInfo.birthYear;
      const bMonth = birthInfo.birthMonth;
      const bDay = birthInfo.birthDay;
      const bHour = birthInfo.birthHour || 12;
      const bMinute = birthInfo.birthMinute || 0;
      const genderText = birthInfo.gender;
      const g = genderText === '男' ? 'male' : 'female';

      try {
        const baziResult = paiPan(g, bYear, bMonth, bDay, bHour, bMinute, birthInfo.province || '');
        const baziYearGan = baziResult.yearPillar.gan;
        const baziYearZhi = baziResult.yearPillar.zhi;

        try {
          const ziweiResult = ziweiPaiPan({
            year: bYear, month: bMonth, day: bDay,
            hour: bHour, minute: bMinute,
            gender: genderText,
            yearGan: baziYearGan, yearZhi: baziYearZhi,
          });

          sanHeCanDuanPrompt = generateSanHeCanDuanPrompt(baziResult, ziweiResult, currentYear, false, true);
        } catch (_e) {
          sanHeCanDuanPrompt = '\n\n【八字排盘数据】\n' + formatPaiPanFull(baziResult, currentYear) + '\n\n' + formatShiZhanPrediction(baziResult, currentYear);
        }
      } catch (_e) {
        // 八字排盘失败，仅手相
      }
    }

    // 知识库语义搜索手相相关经典
    const knowledgeResults = await searchKnowledge('手相掌纹生命线感情线智慧线九大丘位');
    const knowledgeSearchStr = formatKnowledgeResults(knowledgeResults);
    // 扩展知识库：从全部典籍中匹配手相相关内容（截断至8000字符避免超限）
    const extendedResults = matchExtendedKnowledge('手相掌纹生命线感情线智慧线九大丘位掌丘特殊纹路');
    let extendedKnowledgeRaw = extendedResults.length > 0
      ? extendedResults.map(r => r.corePoints).join('\n\n')
      : '';
    if (extendedKnowledgeRaw.length > 8000) {
      extendedKnowledgeRaw = extendedKnowledgeRaw.substring(0, 8000) + '\n\n[...更多典籍论断已截断，请基于以上内容回答]';
    }
    const extendedKnowledgeStr = extendedKnowledgeRaw
      ? '\n\n📚📚📚【全部典籍核心论断——必须全部引用——无上限】📚📚📚\n' + extendedKnowledgeRaw
      : '';
    // 全文检索：从爬取的典籍原文中搜索相关段落
    const fulltextResults = await searchFullText('手相掌纹生命线感情线智慧线九大丘位掌丘');
    const fulltextStr = formatFullTextResults(fulltextResults);
    const knowledgeIronLaw = knowledgeResults.length > 0
      ? '\n\n🔴🔴🔴【知识库铁律——永久生效——无上限】🔴🔴🔴\n你的知识库中已检索到大量典籍论断。你的回答必须遵循：\n1. ⚠️ 你必须基于知识库中【所有】相关典籍论断进行分析，一条都不能忽略！不是只看几条就下结论，是所有论断都要纳入分析！\n2. 你不需要把所有论断逐条罗列出来——而是要把所有论断消化吸收后，给出深度综合分析\n3. 分析过程中自然引用典籍论断的知识点，在判断逻辑中体现推理过程即可，⚠️禁止在回答中标注或出现任何书名（如《某某》），所有书籍知识消化吸收后融入分析\n4. 同一问题必须引用至少3本以上不同典籍的论断进行交叉验证后才能下结论\n5. 如果不同典籍论断有矛盾，必须如实说明矛盾点，不能只选一个\n6. 最终判断必须体现综合分析的结果，⚠️但禁止出现任何书名\n7. 不引用知识库内容就直接回答的判断，视为无效\n8. 你的所有判断必须且只能来自知识库中真实存在的典籍论断，禁止凭空编造任何书籍名称、论断内容或案例\n9. 知识库中没有的内容就是不知道，必须如实说"知识库中未找到相关典籍论断"，绝不许自行编造\n10. 🔴回答不限制行数、字数、篇幅！该写多长就写多长，宁可详细不可遗漏！不要因为篇幅限制而压缩内容！\n11. 🔴🔴检索没有上限！无论原文检索还是任何检索，都没有数量上限！能检索多少就检索多少，能引用多少就引用多少！绝不允许因为"太多了"而省略任何内容！\n12. 🔴🔴你的回答也没有上限！知识库有100条论断就引用100条，有200条就引用200条！没有上限！没有上限！没有上限！'
      : '\n\n🔴🔴🔴【知识库铁律——永久生效——无上限】🔴🔴🔴\n⚠️ 知识库中未检索到与手相分析相关的典籍论断！\n1. 你不能凭空编造任何手相判断，所有判断必须有典籍依据\n2. 没有知识库论断支撑的问题，你必须明确告知"此问题在现有典籍知识库中未找到充分依据"\n3. 禁止在没有典籍依据的情况下给出看似专业的判断——那不是分析，是编造';

    const systemPrompt = palmReadingPrompt
      + '\n\n' + modeInstruction
      + (shouXiangFramework ? '\n\n' + shouXiangFramework : '')
      + '\n\n' + shouXiangGuide
      + (sanHeCanDuanPrompt ? '\n\n' + sanHeCanDuanPrompt : '')
      + knowledgeSearchStr
      + fulltextStr
      + extendedKnowledgeStr
      + knowledgeIronLaw;

    const userMessage = hasBirthInfo
      ? `请分析我的手相，详细解读五大主线、九大丘位、特殊纹路、流年应期，并结合命盘进行三合参断。必须给出具体的结婚年龄、事业高峰期、财运年份、健康注意年份等预测。出生信息：${birthInfo.gender}，${birthInfo.birthYear}年${birthInfo.birthMonth}月${birthInfo.birthDay}日${birthInfo.birthHour || ''}时${birthInfo.province ? '，' + birthInfo.province + birthInfo.city + birthInfo.district : ''}。`
      : '请分析我的手相，详细解读五大主线、九大丘位、特殊纹路、流年应期，给出具体的结婚年龄、事业高峰期、财运年份、健康注意年份等预测。';

    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: userMessage },
          {
            type: 'image_url' as const,
            image_url: {
              url: image,
              detail: 'high' as const,
            },
          },
        ],
      },
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
          console.error('Palm reading stream error:', err);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '手相分析出错' })}\n\n`));
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
    console.error('Palm reading API error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
