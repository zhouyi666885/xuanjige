import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from '@/lib/coze-replacement';
import { faceReadingPrompt, THREE_IRON_RULES, KNOWLEDGE_IRON_LAW_FOUND, KNOWLEDGE_IRON_LAW_NOT_FOUND } from '@/lib/knowledge';
import { searchKnowledge, formatKnowledgeResults } from '@/lib/knowledge-search';
import { matchExtendedKnowledge } from '@/lib/extended-classic-knowledge';
import { searchFullTextAsync, formatFullTextResults } from '@/lib/fulltext-search';
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
    const fullTextPassages = await searchFullTextAsync('面相 五官 十二宫 气色 流年', 0, 0, 0);
    const fullTextStr = formatFullTextResults(fullTextPassages);

    const knowledgeIronLaw = THREE_IRON_RULES + (knowledgeResults.length > 0 || fullTextPassages.length > 0 || extendedResults.length > 0
      ? KNOWLEDGE_IRON_LAW_FOUND
      : KNOWLEDGE_IRON_LAW_NOT_FOUND);

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
      model: process.env.LLM_MODEL || 'doubao-seed-2-0-pro-260215',
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
