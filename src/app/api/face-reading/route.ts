import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { faceReadingPrompt } from '@/lib/knowledge';
import { searchKnowledge, formatKnowledgeResults } from '@/lib/knowledge-search';
import { matchExtendedKnowledge } from '@/lib/extended-classic-knowledge';
import { searchFullText, formatFullTextResults } from '@/lib/fulltext-search';
import { generateMianXiangFramework, getMianXiangPredictionGuide } from '@/lib/xiangxue';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan } from '@/lib/ziwei';
import { generateSanHeCanDuanPrompt } from '@/lib/sanhe-canduan';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { image, mode = 'casual', birthInfo } = await request.json();

    if (!image) {
      return new Response(JSON.stringify({ error: '请提供面部照片' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const modeInstruction = mode === 'professional'
      ? '请用专业术语进行面相分析，将典籍知识融入分析逻辑中，禁止出现任何书名。'
      : '请用通俗易懂的语言进行面相分析，像朋友聊天一样，将典籍知识融入白话解读中，禁止出现任何书名。';

    const currentYear = new Date().getFullYear();
    let mianXiangFramework = '';

    // birthInfo 格式: { gender, birthYear, birthMonth, birthDay, birthHour, birthMinute, province, city, district }
    const hasBirthInfo = birthInfo && birthInfo.gender && birthInfo.birthYear && birthInfo.birthMonth && birthInfo.birthDay;

    if (hasBirthInfo) {
      mianXiangFramework = generateMianXiangFramework(birthInfo.birthYear, currentYear, birthInfo.gender);
    }

    const mianXiangGuide = getMianXiangPredictionGuide();

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

          sanHeCanDuanPrompt = generateSanHeCanDuanPrompt(baziResult, ziweiResult, currentYear, true, false);
        } catch (_e) {
          sanHeCanDuanPrompt = '\n\n【八字排盘数据】\n' + formatPaiPanFull(baziResult, currentYear) + '\n\n' + formatShiZhanPrediction(baziResult, currentYear);
        }
      } catch (_e) {
        // 八字排盘失败，仅面相
      }
    }

    // 知识库语义搜索面相相关经典
    const knowledgeResults = await searchKnowledge('面相手相五官三停十二宫');
    const knowledgeSearchStr = formatKnowledgeResults(knowledgeResults);
    // 扩展典籍知识 - 全部书籍内容（绝不截断！从第一个字到最后一个字完整收录！）
    const extendedResults = matchExtendedKnowledge('面相手相五官三停十二宫');
    const extendedKnowledgeRaw = extendedResults.length > 0
      ? extendedResults.map(r => r.corePoints).join('\n\n')
      : '';
    const extendedKnowledgeStr = extendedKnowledgeRaw
      ? '\n\n📚📚📚【全部典籍核心论断——必须全部引用】📚📚📚\n' + extendedKnowledgeRaw
      : '';
    // 全文检索（不限制！从第一个字到最后一个字完整收录！）
    const fullTextPassages = searchFullText('面相 五官 十二宫 气色 流年', 0, 0, 0);
    const fullTextStr = formatFullTextResults(fullTextPassages);

    const knowledgeIronLaw = knowledgeResults.length > 0 || fullTextPassages.length > 0 || extendedResults.length > 0
      ? '\n\n🔴🔴🔴【搜索铁律】回答问题时，必须遍历整个知识库中所有书籍来搜索答案，不要分领域、不要限定范围！搜索范围包括：知识库里的所有书籍、所有领域、所有内容！不是只搜索这个领域的书，是所有书都搜！只要和这个问题有关的内容，全部整合起来回答。收到问题 → 遍历知识库全部书籍 → 找到所有相关内容 → 综合整理成完整回答。不分领域、不限范围、所有书籍全部查！\n\n🔴🔴🔴【完整回答铁律】回答问题时，不要限制字数！用户问什么就完整回答什么，不要因为回答到一半就说"已到达字数限制"或者"回答已结束"就直接中断！完整回答要求：1.问题问什么就回答什么，要回答完整 2.不要中途截断，不要只回答一半 3.如果内容较长就完整分段输出，直到把答案全部说完为止 4.无论回答多少字都要完整输出，不设上限！问多少答多少，完整输出，不断章取义！\n\n🔴🔴🔴【知识库铁律——永久生效——绝对不可违反】🔴🔴🔴\n你的知识库中已检索到典籍论断和原文。你的回答必须遵循以下铁律：\n\n【最高原则】所有回答必须且只能来自知识库！知识库是唯一的回答来源！\n\n1. ⚠️ 你必须基于知识库中【所有】相关典籍论断进行分析，一条都不能忽略！\n2. 你不需要把所有论断逐条罗列出来——而是要把所有论断消化吸收后，给出深度综合分析\n3. 分析过程中自然引用典籍论断的知识点，⚠️禁止在回答中标注或出现任何书名\n4. 同一问题必须引用至少3本以上不同典籍的论断进行交叉验证后才能下结论\n5. 如果不同典籍论断有矛盾，必须如实说明矛盾点，不能只选一个\n6. 最终判断必须体现综合分析的结果，⚠️但禁止出现任何书名\n7. 不引用知识库内容就直接回答的判断，视为无效\n8. 🔴🔴🔴你的所有判断必须且只能来自知识库中真实存在的典籍论断，禁止凭空编造任何书籍名称、论断内容或案例！\n9. 🔴🔴🔴知识库中没有的内容就是不知道！必须如实说"知识库中未找到相关典籍论断"，绝不许自行编造！\n10. 🔴回答不限制行数、字数、篇幅！该写多长就写多长！\n11. 🔴🔴检索没有上限！能检索多少就检索多少，绝不允许因为"太多了"而省略！\n12. 🔴🔴你的回答也没有上限！知识库有100条论断就引用100条，有200条就引用200条！没有上限！\n13. 🔴🔴🔴书籍全文从第一个字到最后一个字完整收录！绝不允许以"字数到了"或"行数到了"为由截断！\n14. 🔴🔴🔴所有回答必须且只能来自知识库！知识库是唯一的回答来源！知识库中没有的就是不知道！'
      : '\n\n🔴🔴🔴【知识库铁律——永久生效——绝对不可违反】🔴🔴🔴\n⚠️ 知识库中未检索到与面相分析相关的典籍论断！\n1. 🔴🔴🔴你不能凭空编造任何面相判断，所有判断必须有典籍依据\n2. 🔴🔴🔴没有知识库论断支撑的问题，你必须明确告知"此问题在现有典籍知识库中未找到充分依据"\n3. 🔴🔴🔴禁止在没有典籍依据的情况下给出看似专业的判断——那不是分析，是编造！\n4. 🔴🔴🔴所有回答必须且只能来自知识库！知识库是唯一的回答来源！知识库中没有的就是不知道！';

    const systemPrompt = faceReadingPrompt
      + '\n\n' + modeInstruction
      + (mianXiangFramework ? '\n\n' + mianXiangFramework : '')
      + '\n\n' + mianXiangGuide
      + (sanHeCanDuanPrompt ? '\n\n' + sanHeCanDuanPrompt : '')
      + knowledgeSearchStr
      + extendedKnowledgeStr
      + (fullTextStr ? '\n\n【典籍原文摘录——优先引用原文】\n' + fullTextStr : '')
      + knowledgeIronLaw;

    const userMessage = hasBirthInfo
      ? `请分析我的面相，详细解读五官十二宫、三停六府、流年气色，并结合命盘进行三合参断。必须给出具体的贵人方位/属相/时间、财运年份、姻缘时机等预测。出生信息：${birthInfo.gender}，${birthInfo.birthYear}年${birthInfo.birthMonth}月${birthInfo.birthDay}日${birthInfo.birthHour || ''}时${birthInfo.province ? '，' + birthInfo.province + birthInfo.city + birthInfo.district : ''}。`
      : '请分析我的面相，详细解读五官十二宫、三停六府、流年气色，给出具体的贵人方位、财运年份、姻缘时机等预测。';

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
          console.error('Face reading stream error:', err);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '面相分析出错' })}\n\n`));
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
    console.error('Face reading API error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
