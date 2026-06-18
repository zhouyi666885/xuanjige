import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { divinationPrompts } from '@/lib/knowledge';
import { paiPan, formatPaiPanFull } from '@/lib/bazi';
import { paiPan as ziweiPaiPan, formatPaiPan as ziweiFormatPaiPan, getMingGongLunDuan } from '@/lib/ziwei';
import { matchKnowledge } from '@/lib/classic-knowledge';

export const dynamic = 'force-dynamic';

/** divination type 到经典知识点类别的关键词（用于 matchKnowledge） */
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

    // 注入该术数对应的经典知识点
    const keywords = typeToKeywords[type] || '';
    const classicKnowledgeStr = keywords ? matchKnowledge(keywords) : '';
    const systemPrompt = baseSystemPrompt + (classicKnowledgeStr ? '\n\n' + classicKnowledgeStr : '');

    const modeInstruction = mode === 'professional'
      ? '请用专业术语和经典引文进行解读，标注出处。'
      : '请用通俗易懂的语言进行解读，像朋友聊天一样，偶尔引用经典原文并附白话翻译。';

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    let userInput = input;
    let paiPanAppend = '';

    // 对于八字和紫微，使用真实排盘数据
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

      // 计算八字排盘（含调候用神）
      let baziYearGan = '';
      let baziYearZhi = '';
      try {
        const g = gender === '男' ? 'male' : 'female';
        const baziResult = paiPan(g, birthYear, birthMonth, birthDay, birthHour, birthMinute, province || '');
        const baziText = formatPaiPanFull(baziResult);
        paiPanAppend = `\n\n【八字精确排盘结果（代码计算，非AI脑补）】\n${baziText}`;
        baziYearGan = baziResult.yearPillar.gan;
        baziYearZhi = baziResult.yearPillar.zhi;
      } catch (e) {
        paiPanAppend = '\n\n[八字排盘计算出错]';
      }

      // 如果是紫微斗数，额外计算紫微排盘
      if (type === 'ziwei') {
        try {
          const ziweiResult = ziweiPaiPan({
            year: birthYear,
            month: birthMonth,
            day: birthDay,
            hour: birthHour,
            minute: birthMinute,
            gender: gender === '男' ? '男' : '女',
            yearGan: baziYearGan || '甲',
            yearZhi: baziYearZhi || '子',
          });
          paiPanAppend += `\n\n【紫微斗数精确排盘结果（代码计算，非AI脑补）】\n${ziweiFormatPaiPan(ziweiResult)}\n\n${getMingGongLunDuan(ziweiResult)}`;
        } catch (e) {
          paiPanAppend += '\n\n[紫微斗数排盘计算出错]';
        }
      }

      paiPanAppend += '\n\n重要：以上排盘结果由代码精确计算得出，四柱、藏干、十神、五行统计、大运、调候用神、紫微斗数命盘等均为真实数据，请直接基于此排盘结果进行分析解读，不要再自行推算。分析时必须引经据典，尤其参考《渊海子平》《穷通宝鉴》《子平真诠》《滴天髓》《紫微斗数全书》等经典。';
    } else if (birthInfo) {
      // 其他术数类型，仅拼接出生信息
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
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt + paiPanAppend + '\n\n' + modeInstruction },
      { role: 'user' as const, content: userInput },
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
    console.error('Divination API error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
