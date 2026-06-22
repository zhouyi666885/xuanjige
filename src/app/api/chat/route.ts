import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { buildSystemPromptProfessional, buildSystemPromptCasual } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull, formatShiZhanPrediction } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';
import { matchKnowledge, getAllKnowledge } from '@/lib/classic-knowledge';
import { generateSanHeCanDuanPrompt, getSanHeCanDuanByTopic, SAN_HE_CAN_DUAN_GUIDE } from '@/lib/sanhe-canduan';
import { generateMianXiangFramework, getMianXiangPredictionGuide } from '@/lib/xiangxue';
import { generateShouXiangFramework, getShouXiangPredictionGuide } from '@/lib/shouxiang';

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

重要：以上排盘结果由代码精确计算得出，四柱、藏干、十神、五行统计、大运、调候用神、紫微斗数命盘等均为真实数据。请基于此排盘结果进行三合参断（八字+紫微+面手相），给出多维度交叉验证的精准预测。时间、方位、人物类型全部精确到年、月。引经据典，尤其参考《渊海子平》《穷通宝鉴》《子平真诠》《滴天髓》《紫微斗数全书》《麻衣神相》《冰鉴》《手相大全》等经典。`;
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

    const birthInfoStr = birthInfo ? formatBirthInfoWithPaiPan(birthInfo as BirthInfo) : undefined;
  
    // 根据用户消息智能匹配经典知识点
    const classicKnowledgeStr = matchKnowledge(message) || getAllKnowledge();

    const basePrompt = mode === 'professional'
      ? buildSystemPromptProfessional(birthInfoStr)
      : buildSystemPromptCasual(birthInfoStr);
    
    // 加入三合参断话题指引
    const topicGuide = getSanHeCanDuanByTopic(message);
    const systemPrompt = basePrompt + '\n\n' + classicKnowledgeStr + '\n\n' + topicGuide;

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
