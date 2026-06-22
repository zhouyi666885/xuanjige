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
    const { image, mode = 'casual', birthDate, birthHour, gender, birthMinute, province } = await request.json();

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

    if (birthDate && gender) {
      const [yearStr] = (birthDate as string).split('-');
      const bYear = parseInt(yearStr);
      shouXiangFramework = generateShouXiangFramework(bYear, currentYear, gender as string);
    }

    const shouXiangGuide = getShouXiangPredictionGuide();

    let sanHeCanDuanPrompt = '';
    if (birthDate && birthHour && gender) {
      const [yearStr, monthStr, dayStr] = (birthDate as string).split('-');
      const bYear = parseInt(yearStr);
      const bMonth = parseInt(monthStr);
      const bDay = parseInt(dayStr);
      const bHour = parseInt(String(birthHour));
      const bMinute = birthMinute ? parseInt(String(birthMinute)) : 0;
      const genderText = gender as string;
      const g = genderText === '男' ? 'male' : 'female';

      try {
        const baziResult = paiPan(g, bYear, bMonth, bDay, bHour, bMinute, (province as string) || '');
        const baziYearGan = baziResult.yearPillar.gan;
        const baziYearZhi = baziResult.yearPillar.zhi;

        try {
          const ziweiResult = ziweiPaiPan({
            year: bYear, month: bMonth, day: bDay,
            hour: bHour, minute: bMinute,
            gender: genderText === '男' ? '男' : '女',
            yearGan: baziYearGan, yearZhi: baziYearZhi,
          });

          // 三合参断（有手相照片，无面相照片）
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

    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: '请分析我的手相，详细解读五大主线、九大丘位、特殊纹路、流年应期，并结合命盘进行三合参断。必须给出具体的结婚年龄、事业高峰期、财运年份、健康注意年份等预测。' },
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
