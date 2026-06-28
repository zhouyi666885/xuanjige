/**
 * /api/chat-deep
 *
 * Map-Reduce 深度 AI 玄学问答接口（SSE 流式）。
 *
 * 与 /api/chat（单次塞 system prompt）不同，本接口对知识库中**所有**书籍进行：
 *   1. 关键词预筛 → 按相关度分级（高/中/低/兜底抽样）
 *   2. Map 阶段：高/中相关书全量精读 + 兜底书抽样审读，并行执行
 *   3. Reduce 阶段：把所有 Map 输出合并 + LLM 流式综合给出最终答案
 *
 * 保证「翻遍所有书的每一个字」的知识库铁律，绕开 LLM 单次 context window 的硬限制。
 *
 * Request: { message: string; mode?: 'professional' | 'casual'; birthInfo?: string }
 * Response: SSE 流式
 *   - data: { type: 'progress', message: string, progress?: number }
 *   - data: { type: 'meta', citations: [...], totalBooksReviewed: number, totalBatches: number, prescreenSummary: string }
 *   - data: { type: 'chunk', content: string }
 *   - data: { type: 'done' }
 *   - data: { type: 'error', message: string }
 */

import { NextRequest } from 'next/server';
import { Config, LLMClient } from '@/lib/coze-replacement';
import { mapReduceKnowledgeSearch } from '@/lib/map-reduce-search';
import {
  buildSystemPromptProfessional,
  buildSystemPromptCasual,
  KNOWLEDGE_IRON_LAW_FOUND,
  KNOWLEDGE_IRON_LAW_NOT_FOUND,
} from '@/lib/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

function sseLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: { message?: string; mode?: 'professional' | 'casual'; birthInfo?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求体不是合法 JSON' }), { status: 400 });
  }

  const message = (body.message || '').toString().trim();
  if (!message) {
    return new Response(JSON.stringify({ error: '缺少 message 字段' }), { status: 400 });
  }

  const mode: 'professional' | 'casual' = body.mode === 'casual' ? 'casual' : 'professional';
  const birthInfo = body.birthInfo ? String(body.birthInfo) : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseLine(payload)));
        } catch {
          /* 客户端断开，忽略 */
        }
      };

      try {
        const config = new Config();
        const llm = new LLMClient(config);

        // ---- Map-Reduce 阶段：翻遍所有书 ----
        const mr = await mapReduceKnowledgeSearch(message, llm, {
          onProgress: (event) => {
            send({
              type: 'progress',
              stage: event.stage,
              message: event.message,
              progress: event.progress,
              bookName: event.bookName,
            });
          },
        });

        // ---- 元信息发给前端用于显示「引用书目」----
        send({
          type: 'meta',
          citations: mr.citations,
          totalBooksReviewed: mr.totalBooksReviewed,
          totalBatches: mr.totalBatches,
          prescreenSummary: mr.prescreenSummary,
          elapsedMs: mr.elapsedMs,
        });

        // ---- Reduce 阶段：基于 Map 阶段产出的 context 流式综合 ----
        const hasContext = mr.context.trim().length > 0;
        const baseSystemPrompt =
          mode === 'casual' ? buildSystemPromptCasual(birthInfo) : buildSystemPromptProfessional(birthInfo);
        const ironLawTail = hasContext ? KNOWLEDGE_IRON_LAW_FOUND : KNOWLEDGE_IRON_LAW_NOT_FOUND;

        const systemPrompt = [
          baseSystemPrompt,
          ironLawTail,
          hasContext
            ? `\n\n【知识库原文摘录——本次精读来自 ${mr.totalBooksReviewed} 部典籍、${mr.totalBatches} 个批次】\n${mr.context}`
            : '\n\n【知识库当前为空或本次预筛未命中任何书】请遵守"知识库铁律"，不要编造任何书名与论断。',
        ].join('\n');

        send({
          type: 'progress',
          stage: 'reducing',
          message: '✍️ 综合所有典籍论断，正在为你撰写最终回答...',
          progress: 90,
        });

        const llmStream = llm.stream(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          { temperature: 0.6 },
        );

        for await (const chunk of llmStream) {
          if (chunk.content) {
            send({ type: 'chunk', content: chunk.content });
          }
          if (chunk.finish_reason) {
            break;
          }
        }

        send({ type: 'done' });
      } catch (err) {
        send({ type: 'error', message: (err as Error).message || '处理失败' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET() {
  return new Response(
    JSON.stringify({
      endpoint: '/api/chat-deep',
      method: 'POST',
      description: 'Map-Reduce 深度问答：翻遍所有书的每一个字',
      body: { message: 'string (必填)', mode: 'professional | casual', birthInfo: 'string (可选)' },
      streamingFormat: 'SSE: progress -> meta -> chunk x N -> done',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
