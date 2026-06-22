import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { faceReadingPrompt } from '@/lib/knowledge';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { image, mode = 'casual', birthDate, birthHour, gender } = await request.json();

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
      ? '请用专业术语和经典引文进行面相分析，标注出处。'
      : '请用通俗易懂的语言进行面相分析，像朋友聊天一样，偶尔引用经典原文并附白话翻译。';

    // 三合参断：如有出生信息，提示AI结合八字紫微进行交叉验证
    const birthInfo = birthDate && birthHour && gender
      ? `\n\n三合参断指令：用户提供了出生信息（出生日期：${birthDate}，时辰：${birthHour}，性别：${gender}），请结合八字命理与紫微斗数进行三合参断。面相印证命盘，命盘验证面相，给出多维度交叉验证的精准预测。时间、方位、人物类型全部精确到年、月。`
      : '';

    const messages = [
      {
        role: 'system' as const,
        content: faceReadingPrompt + '\n\n' + modeInstruction + birthInfo,
      },
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: '请分析我的面相，详细解读各个方面，包括流年应期预测。' },
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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '面相分析出错' })}\n\n`));
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
    console.error('Face reading API error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
