import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { palmReadingPrompt } from '@/lib/knowledge';
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
      ? '请用专业术语和经典引文进行手相分析，标注出处。'
      : '请用通俗易懂的语言进行手相分析，像朋友聊天一样，偶尔引用经典原文并附白话翻译。';

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

    const systemPrompt = palmReadingPrompt
      + '\n\n' + modeInstruction
      + (shouXiangFramework ? '\n\n' + shouXiangFramework : '')
      + '\n\n' + shouXiangGuide
      + (sanHeCanDuanPrompt ? '\n\n' + sanHeCanDuanPrompt : '');

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '手相分析出错' })}\n\n`));
          controller.close();
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
