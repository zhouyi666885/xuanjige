import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { buildSystemPromptProfessional, buildSystemPromptCasual } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';

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

  let paiPanResult = '';
  let baziYearGan = '';
  let baziYearZhi = '';

  // 先计算八字排盘（含调候用神）
  try {
    const baziResult = paiPan(
      gender,
      birthInfo.birthYear,
      birthInfo.birthMonth,
      birthInfo.birthDay,
      birthInfo.birthHour,
      birthInfo.birthMinute,
      birthInfo.province
    );
    const baziText = formatPaiPanFull(baziResult);
    baziYearGan = baziResult.yearPillar.gan;
    baziYearZhi = baziResult.yearPillar.zhi;
    paiPanResult = `\n\n【八字精确排盘结果（代码计算，非AI脑补）】\n${baziText}`;
  } catch (e) {
    paiPanResult = '\n\n[八字排盘计算出错]';
  }

  // 始终同时计算紫微斗数排盘（双盘互参）
  if (baziYearGan) {
    try {
      const result = ziweiPaiPan({
        year: birthInfo.birthYear,
        month: birthInfo.birthMonth,
        day: birthInfo.birthDay,
        hour: birthInfo.birthHour,
        minute: birthInfo.birthMinute,
        gender: birthInfo.gender === '男' ? '男' : '女',
        yearGan: baziYearGan,
        yearZhi: baziYearZhi,
      });
      paiPanResult += `\n\n【紫微斗数精确排盘结果（代码计算，非AI脑补）】\n${ziweiFormatPaiPan(result)}\n\n${getMingGongLunDuan(result)}`;
    } catch (e) {
      paiPanResult += '\n\n[紫微斗数排盘计算出错]';
    }
  }

  return `${genderText}
出生时间：${birthInfo.birthYear}年${birthInfo.birthMonth}月${birthInfo.birthDay}日 ${birthInfo.birthHour}时${birthInfo.birthMinute}分
出生地点：${birthInfo.province}${birthInfo.city}${birthInfo.district}${paiPanResult}

重要：以上排盘结果由代码精确计算得出，四柱、藏干、十神、五行统计、大运、调候用神、紫微斗数命盘等均为真实数据，请直接基于此排盘结果进行分析解读，不要再自行推算。八字与紫微斗数双盘互参。分析时必须引经据典，尤其参考《渊海子平》《穷通宝鉴》《子平真诠》《滴天髓》《紫微斗数全书》等经典。`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, mode = 'casual', history = [], birthInfo } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: '请提供消息内容' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 默认同时计算八字和紫微排盘（双盘互参）
  const birthInfoStr = birthInfo ? formatBirthInfoWithPaiPan(birthInfo as BirthInfo) : undefined;
    const systemPrompt = mode === 'professional'
      ? buildSystemPromptProfessional(birthInfoStr)
      : buildSystemPromptCasual(birthInfoStr);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const stream = client.stream(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: mode === 'professional' ? 0.5 : 0.8,
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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成内容时出错' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
