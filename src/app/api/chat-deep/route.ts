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
import { searchFullTextAsync } from '@/lib/fulltext-search';
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
  let body: {
    message?: string;
    mode?: 'professional' | 'casual';
    birthInfo?: string;
    noLLM?: boolean;
  };
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

  // 🔑 是否走「📚 原文模式」：完全不调任何 LLM，纯关键词全库检索
  // 触发条件：① 前端显式传 noLLM=true；② 后端 LLM_API_KEY 为空（自动降级）
  const noLLM = body.noLLM === true || !process.env.LLM_API_KEY;

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
        // ╔══════════════════════════════════════════════════════════╗
        // ║ 📚 原文模式：完全零成本，不调任何 LLM                       ║
        // ║ 直接用知识库做关键词全库检索，把命中的「《书名·章节》原文」流式吐出 ║
        // ╚══════════════════════════════════════════════════════════╝
        if (noLLM) {
          send({
            type: 'progress',
            stage: 'prescreen',
            message: '📚 原文模式：直接从知识库检索（零成本，不调 LLM）...',
          });

          // 全库无限制检索（四个 0 = 不限书数、不限段数、不限字数、不截断）
          const passages = await searchFullTextAsync(message, 0, 0, 0);

          // 按书名聚合，便于按出处分组列出
          const bookMap = new Map<
            string,
            Array<{ chapter: string; content: string; relevance: number }>
          >();
          for (const p of passages) {
            if (!bookMap.has(p.bookName)) bookMap.set(p.bookName, []);
            bookMap.get(p.bookName)!.push({
              chapter: p.chapter,
              content: p.content,
              relevance: p.relevance,
            });
          }

          const citations = Array.from(bookMap.keys()).map((name) => ({
            bookName: name,
            chapter: bookMap.get(name)![0]?.chapter || '',
            relevance: bookMap.get(name)![0]?.relevance || 0,
          }));

          send({
            type: 'meta',
            citations,
            totalBooksReviewed: bookMap.size,
            totalBatches: 0,
            prescreenSummary: `共命中 ${bookMap.size} 本典籍｜${passages.length} 个段落`,
            elapsedMs: 0,
            mode: 'raw',
          });

          if (passages.length === 0) {
            const tip =
              `📭 **知识库中未检索到与"${message}"相关的内容**\n\n` +
              `可能原因：\n` +
              `1. 你还没有上传任何书籍 → 请去【📤 上传典籍】添加\n` +
              `2. 已上传书籍中确实没有相关论述\n` +
              `3. 关键词与书中表述方式不一致，可换个说法再问\n\n` +
              `（"📚 原文模式"严格遵守知识库铁律：知识库中没有的就是不知道，不编造任何内容。）`;
            // 按句子拆分流式推送，模拟打字机效果
            for (const piece of tip.split(/(?<=[。\n])/)) {
              if (piece) send({ type: 'chunk', content: piece });
            }
            send({ type: 'done' });
            controller.close();
            return;
          }

          // ---- 按出处分组流式推送 ----
          const header =
            `# 📚 知识库原文检索结果\n\n` +
            `**问题**：${message}\n` +
            `**命中**：${bookMap.size} 本典籍 · ${passages.length} 个段落\n` +
            `**模式**：原文检索（零成本，不调 LLM，全部内容均来自你上传的知识库）\n\n---\n\n`;

          for (const piece of header.split(/(?<=\n)/)) {
            if (piece) send({ type: 'chunk', content: piece });
          }

          let bookIdx = 0;
          for (const [bookName, segs] of bookMap.entries()) {
            bookIdx += 1;
            send({
              type: 'progress',
              stage: 'reducing',
              message: `📖 [${bookIdx}/${bookMap.size}] 整理《${bookName}》的命中段落...`,
              progress: Math.floor((bookIdx / bookMap.size) * 100),
              bookName,
            });

            const bookTitle = `\n## ${bookIdx}. 《${bookName}》\n\n`;
            send({ type: 'chunk', content: bookTitle });

            let segIdx = 0;
            for (const seg of segs) {
              segIdx += 1;
              const chapterTag = seg.chapter ? `**·${seg.chapter}**` : '';
              const block =
                `### 出处 ${segIdx}：《${bookName}${chapterTag ? '·' + seg.chapter : ''}》\n\n` +
                `> ${seg.content.replace(/\n/g, '\n> ')}\n\n`;
              // 按行流式推送
              for (const line of block.split(/(?<=\n)/)) {
                if (line) send({ type: 'chunk', content: line });
              }
            }
          }

          const footer =
            `\n---\n\n📌 **以上全部内容均来自你录入知识库的原始典籍，未经任何 LLM 改写或推测**。\n` +
            `如需 AI 综合分析，请切换到「🔥 深读」或「🟢 快速」模式（需配置 LLM API Key）。`;
          for (const piece of footer.split(/(?<=\n)/)) {
            if (piece) send({ type: 'chunk', content: piece });
          }

          send({ type: 'done' });
        } else {
          // ╔══════════════════════════════════════════════════════════╗
          // ║ 🔥 LLM 深读模式（Map-Reduce 全库精读 + LLM 综合）            ║
          // ╚══════════════════════════════════════════════════════════╝
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
        } // end else (LLM 分支)
      } catch (err) {
        send({ type: 'error', message: (err as Error).message || '处理失败' });
      } finally {
        try {
          controller.close();
        } catch {
          /* 已 close，忽略 */
        }
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
      description: 'Map-Reduce 深度问答（LLM）或 📚 原文模式（noLLM=true，零成本）',
      body: {
        message: 'string (必填)',
        mode: 'professional | casual',
        birthInfo: 'string (可选)',
        noLLM: 'boolean (可选) - true 时走原文模式，不调任何 LLM',
      },
      streamingFormat: 'SSE: progress -> meta -> chunk x N -> done',
      autoFallback: '当后端 LLM_API_KEY 为空时自动降级为原文模式',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
