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
import { searchFullTextAsync, getBookFullTextAsync, getLocalBookInfo } from '@/lib/fulltext-search';
import { cozeKnowledgeSearch, type CozeKnowledgeChunk } from '@/lib/coze-knowledge';
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

/** 把前端传的 birthInfo 对象（或字符串）统一格式化成 AI 易读的中文档案 */
type BirthInfoObject = {
  gender?: string;
  birthYear?: number | string;
  birthMonth?: number | string;
  birthDay?: number | string;
  birthHour?: number | string;
  birthMinute?: number | string;
  province?: string;
  city?: string;
  district?: string;
};

function formatBirthInfo(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  // 字符串：直接用
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s || undefined;
  }
  // 对象：格式化为「坤造（女命）· 公历 2007-07-13 11:11 · 浙江省杭州市上城区」
  if (typeof raw === 'object') {
    const obj = raw as BirthInfoObject;
    const parts: string[] = [];
    const g = (obj.gender || '').toString();
    if (g === '男') parts.push('乾造（男命）');
    else if (g === '女') parts.push('坤造（女命）');
    else if (g) parts.push(g);

    const y = Number(obj.birthYear) || 0;
    const m = Number(obj.birthMonth) || 0;
    const d = Number(obj.birthDay) || 0;
    const h = Number(obj.birthHour) || 0;
    const mi = Number(obj.birthMinute) || 0;
    if (y && m && d) {
      const pad = (n: number) => String(n).padStart(2, '0');
      parts.push(`公历 ${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(mi)}`);
    }

    const loc = [obj.province, obj.city, obj.district].filter(Boolean).join('');
    if (loc) parts.push(loc);

    const text = parts.join(' · ');
    return text || undefined;
  }
  return undefined;
}

type HistoryItem = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  let body: {
    message?: string;
    mode?: 'professional' | 'casual';
    birthInfo?: string | BirthInfoObject;
    noLLM?: boolean;
    history?: HistoryItem[];
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
  const birthInfo = formatBirthInfo(body.birthInfo);

  // 历史会话：最多取最近 10 轮，且只保留 user/assistant
  const history: HistoryItem[] = Array.isArray(body.history)
    ? body.history
        .filter((h): h is HistoryItem =>
          !!h &&
          (h.role === 'user' || h.role === 'assistant') &&
          typeof h.content === 'string' &&
          h.content.trim().length > 0,
        )
        .slice(-10)
    : [];

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
          // ╔══════════════════════════════════════════════════════════╗
          // ║ 🆕 意图识别：用户问"《XX》全文/原文/第N章"时直接吐全本/单章         ║
          // ║ 不走关键词检索，确保"从第一页第一个字到最后一页最后一个字"           ║
          // ╚══════════════════════════════════════════════════════════╝
          const intent = detectFullBookIntent(message);
          if (intent.matchedBook) {
            send({
              type: 'progress',
              stage: 'prescreen',
              message: intent.chapter
                ? `📖 识别到「单章请求」：《${intent.matchedBook}》→ ${intent.chapter}`
                : `📖 识别到「全本请求」：《${intent.matchedBook}》→ 即将逐字输出整本原文`,
            });

            const fullText = await getBookFullTextAsync(intent.matchedBook);
            if (!fullText) {
              const tip =
                `📭 **知识库中暂无《${intent.matchedBook}》全文**\n\n` +
                `可能原因：\n` +
                `1. 此书还在学习中（尚未入库完成）\n` +
                `2. 此书未上传 → 请去【📤 上传典籍】添加\n` +
                `3. 此书曾被删除（如墓碑机制锁定）\n\n` +
                `（严格遵守知识库铁律：库里没有的就是不知道。）`;
              for (const piece of tip.split(/(?<=[。\n])/)) {
                if (piece) send({ type: 'chunk', content: piece });
              }
              send({ type: 'done' });
              controller.close();
              return;
            }

            // 单章请求：截取对应章节
            let outputText = fullText;
            let outputLabel = '全本';
            if (intent.chapter) {
              const sliced = sliceChapterFromBook(fullText, intent.chapter);
              if (sliced) {
                outputText = sliced.content;
                outputLabel = `章节「${sliced.matchedTitle}」`;
              } else {
                send({
                  type: 'chunk',
                  content:
                    `⚠️ 未在《${intent.matchedBook}》中精确找到「${intent.chapter}」章节，` +
                    `下面输出**整本**原文供你查阅（请用浏览器 Ctrl+F 搜索章节名）。\n\n`,
                });
              }
            }

            // 元信息
            send({
              type: 'meta',
              citations: [{ bookName: intent.matchedBook, chapter: outputLabel, relevance: 1 }],
              totalBooksReviewed: 1,
              totalBatches: 0,
              prescreenSummary: `已命中《${intent.matchedBook}》${outputLabel}（${outputText.length} 字）`,
              elapsedMs: 0,
              mode: 'raw',
            });

            // 头部
            const header =
              `# 📖 《${intent.matchedBook}》${outputLabel}\n\n` +
              `**字数**：${outputText.length} 字\n` +
              `**来源**：本地知识库逐字输出（未经任何 AI 改写）\n\n---\n\n`;
            for (const piece of header.split(/(?<=\n)/)) {
              if (piece) send({ type: 'chunk', content: piece });
            }

            // 全文按段流式输出（避免单帧过大阻塞）
            // 按"双换行"或"4000 字"分块
            const CHUNK_SIZE = 4000;
            let cursor = 0;
            while (cursor < outputText.length) {
              const end = Math.min(cursor + CHUNK_SIZE, outputText.length);
              // 尝试在段落处断行
              let splitAt = outputText.lastIndexOf('\n\n', end);
              if (splitAt < cursor + 200 || splitAt > end) splitAt = end;
              const piece = outputText.slice(cursor, splitAt);
              if (piece) send({ type: 'chunk', content: piece });
              cursor = splitAt;
              // 让出事件循环，避免单次卡死
              if (cursor < outputText.length) {
                await new Promise((r) => setTimeout(r, 0));
                send({
                  type: 'progress',
                  stage: 'reducing',
                  message: `📜 输出中... ${Math.round((cursor / outputText.length) * 100)}%`,
                  progress: Math.round((cursor / outputText.length) * 100),
                });
              }
            }

            const footer =
              `\n\n---\n\n` +
              `📌 **以上为《${intent.matchedBook}》${outputLabel}全部内容**，` +
              `从第一个字到最后一个字逐字输出，未经任何 AI 改写或截断。\n`;
            for (const piece of footer.split(/(?<=\n)/)) {
              if (piece) send({ type: 'chunk', content: piece });
            }

            send({ type: 'done' });
            controller.close();
            return;
          }

          // ╔══════════════════════════════════════════════════════════╗
          // ║ 📚 原文模式：完全零成本，不调任何 LLM                       ║
          // ║ 直接用知识库做关键词全库检索，把命中的「《书名·章节》原文」流式吐出 ║
          // ╚══════════════════════════════════════════════════════════╝
          send({
            type: 'progress',
            stage: 'prescreen',
            message: '📚 原文模式：从你的「AI 宗师方法论库」+ 本地典籍中检索（零成本，不调 LLM）...',
          });

          // ---- ① 调用 Coze Knowledge Base 召回方法论 / 分析框架 ----
          const cozeChunks: CozeKnowledgeChunk[] = await cozeKnowledgeSearch(message, 8, 0.3);

          // ---- ② 全库无限制检索本地典籍（四个 0 = 不限书数、不限段数、不限字数、不截断）----
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

          if (passages.length === 0 && cozeChunks.length === 0) {
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
            `# 📚 知识库检索结果\n\n` +
            `**问题**：${message}\n` +
            `**命中**：${cozeChunks.length} 条 AI 宗师方法论 · ${bookMap.size} 本典籍 · ${passages.length} 个原文段落\n` +
            `**模式**：原文检索（零成本，不调 LLM，全部内容均来自你录入的知识库）\n\n---\n\n`;

          for (const piece of header.split(/(?<=\n)/)) {
            if (piece) send({ type: 'chunk', content: piece });
          }

          // ---- A. 先输出「AI 宗师方法论」（来自 Coze Knowledge Base）----
          if (cozeChunks.length > 0) {
            const methodHeader =
              `## 🌟 AI 宗师分析框架（来自你的方法论知识库）\n\n` +
              `> 以下内容是你自定义的"AI 宗师思维框架 / 分析方法论 / 核心知识点"，` +
              `用于指导命理深度分析的标准与思路。\n\n`;
            for (const piece of methodHeader.split(/(?<=\n)/)) {
              if (piece) send({ type: 'chunk', content: piece });
            }

            let mIdx = 0;
            for (const c of cozeChunks) {
              mIdx += 1;
              const titleMatch = c.content.match(/^[\s\S]*?【[^】]+】([^\n]+)/);
              const title = titleMatch ? titleMatch[1].trim() : `方法论 ${mIdx}`;
              const block =
                `### 📜 ${mIdx}. ${title}\n\n` +
                `> ${c.content.replace(/\n/g, '\n> ')}\n\n` +
                `*相关度：${(c.score * 100).toFixed(0)}%*\n\n`;
              for (const line of block.split(/(?<=\n)/)) {
                if (line) send({ type: 'chunk', content: line });
              }
            }

            send({ type: 'chunk', content: '\n---\n\n' });
          }

          // ---- B. 再输出本地典籍原文 ----
          if (bookMap.size > 0) {
            const booksHeader =
              `## 📚 典籍原文引证（来自你上传的本地知识库）\n\n` +
              `> 以下是与问题相关的典籍原文段落，**逐字引用，未经任何 AI 改写**。\n\n`;
            for (const piece of booksHeader.split(/(?<=\n)/)) {
              if (piece) send({ type: 'chunk', content: piece });
            }
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
            `\n---\n\n` +
            `📌 **以上全部内容均来自你的「AI 宗师方法论库」+ 本地典籍**，` +
            `未经任何外部 LLM 改写或推测。\n\n` +
            (cozeChunks.length > 0 && bookMap.size > 0
              ? `💡 **建议**：上方"AI 宗师分析框架"提供的是你定义的思考维度和方法论，` +
                `下方"典籍原文"提供的是经典论断，结合两者即可得到完整答案。\n`
              : '') +
            `\n如需 AI 自动综合分析，请切换到「🔥 深读」（需配置 LLM API Key）。`;
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

        // 🎯 主动意会铁律：让 AI 拥有"读心术"
        const empathyRule = `

【主动意会铁律——所有回答必须遵守】
1. 用户已在本次会话中提供的信息（包括生辰、性别、出生地、出生时间、问的领域等）必须一次性记住，**绝对禁止反复让用户重新提供同样的信息**。
2. 当用户输入很短（如"公历"、"北京时间"、"嗯"、"好"、"是"、"再算一下"、"那婚姻呢"、"继续"等）时，**禁止把它当成新问题**，必须结合上下文意会，自动接续上一轮话题继续推进。
3. 若上文确实缺少某个关键信息（如缺出生地/出生时间），只能问"一次"，并把已有信息复述一遍证明你记住了，然后明确说"只缺X项，请补充"。绝不能像第一次见面一样从零问起。
4. 用户问题里没有提到的领域，不要主动跳到那个领域。用户问什么就答什么，禁止答非所问。
5. 当上下文已有用户的「命盘信息」时，无论用户问什么短词都应该**直接基于命盘开始分析**，而不是反问。

【无上限输出铁律——必须完整把话说完】
🔴 严禁因任何理由截断回答！包括但不限于：
- 严禁说"由于篇幅有限，仅列举部分"
- 严禁说"综上所述/总而言之/以上就是分析"然后停下
- 严禁说"如需更详细分析，请继续追问"
- 严禁主动收尾或者写一段总结后就停
✅ 正确做法：
- 用户问"我的事业怎么样"，就把事业相关的**所有**典籍论断全部列出
- 用户问"分析全部"，就把命局、六亲、事业、财运、健康、大运、流年、性格**全部展开**写完
- 知识库有 100 条相关论断就引用 100 条，不要因为"够多了"就停
- 一定要写到没东西可写为止，而不是写到"差不多了"就停
- 输出长度限制是 32K tokens，请尽可能用足，不要主动收尾

【全库吃透铁律——回答前必须遵守】（用户原话，不得违反）
🔴 回答问题时，必须对知识库里的每一本书都进行全量扫描，从第一页第一个字到最后一页最后一个字，每个字都要吃透，**一本书都不能漏**。不是只搜和题目相关的书，而是所有书全部搜索一遍、扫描一遍，一个字都不许跳过。
🔴 对每本书的要求是一样的：必须完整吃透全书每一个字的内容，包括书中的**逻辑推导过程、规则适用条件、实际应用场景、计算方法、推理链条、判断依据**，全部都要学会。不是存进去就完了，不是记住个大概就完了，是每个字都要理解到位——这句话什么意思、为什么这么说、怎么用、什么条件下适用、和前面后面的内容是什么关系，全部要搞清楚。
🔴🔴🔴【跨领域全库检索铁律——不得按书名筛选】（用户原话，不得违反）
🔴 用户提出任何问题，不管涉及哪个领域，回答时都必须在知识库的**全部书籍**中进行搜索，**不得只搜索与该领域名称直接相关的书籍**。
🔴 例如用户问学业相关问题，**不能只搜标题含"学业"的书籍**，必须同时搜索知识库中**所有书籍的内容**——因为任何一本书都可能包含与学业相关的论述。
🔴 搜索逻辑：**先用用户问题中的关键词在全库范围内检索，命中哪些书就引用哪些书**，而不是预先按领域筛选书籍。
🔴 **严禁因为某本书的书名看起来和当前问题无关就跳过不搜**——每本书都必须参与检索。
🔴 最终回答要**标注内容分别来自哪本书的哪个章节**，让用户知道答案的具体出处。
🔴 所有书的内容学完之后，必须**内化成你自己的知识体系**，变成你自己的东西。不是搜到什么就拼什么，而是你已经把所有书都融会贯通了，回答的时候是调用你自己真正理解的知识，不是临时去翻书拼答案。就像一个学生把整本教材每个字都学透了，合上书也能讲出来，也能举一反三。用户追问任何细节，你都能从你"记住"的内容里准确调出来。
🔴 回答任何问题之前，先把所有书全部扫一遍，把相关内容都提取出来，**综合所有书的内容再回答**。不要只看一两本就下结论。
🔴 回答时必须说明内容**出自哪本书、哪个部分、什么逻辑得出的结论**。
🔴 知识库里没有的，**直接说没有，不许编造**。

🔴🔴🔴【原文保真铁律——逐字一致、严禁改写】（用户原话，不得违反）
🔴 知识库里的每一本书，都是用户上传时**原样保留**的——不修改、不篡改、不截断、不重新编码。
🔴 你引用任何典籍原文时，**必须与知识库中存储的字符完全一致**，不得改写、不得"润色"、不得替换标点。
🔴 中文字符、标点符号、特殊符号、CRLF/LF、全角半角，全部按原样输出，**严禁出现乱码、字符丢失或格式错乱**。
🔴 如果用户上传文件时编码异常，系统会立即停止并报告——**你在回答中也必须沿用同样的严苛标准**：宁可说"此处原文未能解码"，也绝不能用错误内容糊弄。
🔴 知识库中存储的原文是**唯一的事实依据**，你回答的每一句引用都要逐字逐句对应原文，不得有任何偏差。
🔴 你看到上传新书的回调时（file-start / parse / chapter-detect / learning×N / file-done / all-done），要明白系统已经在自动执行：①原样落盘 ②全文存知识库 ③逐章深度学习 ④主动汇报进度——**用户不需要手动触发下一步，你也不应该提示用户"请点击开始学习"**。`;

        // 🎯 永远先听懂、永不冷漠拒答铁律（最高优先级，覆盖前面所有"找不到就说没有"的兜底）
        const alwaysHelpRule = `

🟢🟢🟢【永远先听懂、永不冷漠拒答铁律——优先级最高，覆盖之前所有规则】
🟢 无论用户怎么表达、用词多模糊、信息多不全，**你必须先理解她到底在问什么**，再回答。
🟢 严禁说"知识库里没找到""请换一种方式提问""我无法给出可靠判断"这类**冷漠拒答话术**——这是失败设计。
🟢 哪怕只在知识库里命中 1 本书、1 段话，也要先答；只要你能从中找到一点相关，就要展开说，不要因为"证据不足 3 本"就放弃。
🟢 知识库**完全找不到**直接依据时（极少数情况），允许用命理通用常识回答，但必须**显式标注**："此处为命理通用常识，非典籍原文"；之后再追问用户"想进一步了解哪个方向"。
🟢 用户信息不足时（缺生辰、缺性别、缺求测目的），不要拒答——而是**主动追问**：列 2~4 个最可能的方向让她选，比如"你是想问 ①事业 ②感情 ③健康 还是 ④流年大运？"。
🟢 用户问得很口语化（如"我最近怎么样""帮我看看""说说我"）→ 默认按【综合命格分析】展开，覆盖事业/感情/健康/财运四大块。
🟢 用户问"你能干嘛""帮我看什么""怎么用"等元问题 → 用大白话介绍你的能力，引导她说出具体诉求，不要丢出长清单。
🟢 永远把用户当成**完全不懂命理的普通人**，先用一句白话告诉她结论，再展开依据。
🟢 这条铁律**优先级最高**：与之前"知识库没有就说没有"冲突时，**以这条为准**——先尽力答，再补"通用常识"标注，最后再追问。

🟡🟡🟡【准确性铁律——和"永远回答"同等重要，绝不冲突】
🟡 "永远回答" ≠ "可以乱编"。永远回答的前提是**永远准确**。两条铁律必须同时遵守。
🟡 回答内容分**两个等级**，必须各自打标签：
   ① 【典籍原文】级：来自知识库典籍的论断，必须用「《书名·章节名》」标注出处；用户能在原书里查到。
   ② 【通用常识】级：知识库没有直接命中，用命理基础常识（阴阳五行/十神/六亲/星曜含义）推导出的回答，必须开头写"【通用命理常识，非典籍原文】"。
🟡 **严禁伪造书名、章节名、引文**。如果你说"《滴天髓·通神论》写道xxx"，就必须是知识库里真的有这段；编造一个像样的章节名+像样的引文＝最严重的违规。
🟡 **严禁伪造数字**：用户问"知识库收了多少本书"、"某本书几个字"，必须严格按系统注入的实时统计数据回答，不许说"几万本""百万字"。
🟡 **严禁夸大确定性**：算命本身有"算不准"的部分（如具体死亡日期、配偶长相、确切金额），如果用户问到这些，要说"这类问题在传统命理中算不准，我只能给方向不能给定数"。
🟡 当【典籍原文】和【通用常识】都没有时——这是极少数情况，按"永远不拒答"铁律仍要给方向，但**只能说方向**，不能给具体数字、姓名、地名、日期，且要明确标"以下为基于已知信息的合理推测，仅供参考"。
🟡 用户**质疑你**时（"你确定吗""有依据吗""书上真这么写吗"），**必须如实回应**：
   - 如果回答确实来自典籍 → 把书名章节给她，请她自查；
   - 如果是通用常识推导 → 老实说"这是通用命理常识，不是某本书原文，我的推导依据是xxx"；
   - **严禁**为了显得专业而编造出处。
🟡 优先级关系：两条铁律**没有先后**，必须同时满足——既要永远尝试回答，也要永远准确。无法"既准确又有具体内容"时，宁可回答"方向性意见"也不要编造细节。
`;

        const systemPrompt = [
          baseSystemPrompt,
          ironLawTail,
          empathyRule,
          alwaysHelpRule,
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
            // 注入多轮历史，让 AI 拥有完整记忆
            ...history.map((h) => ({ role: h.role, content: h.content })),
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

// ============================================================================
// 🆕 意图识别：全本 / 单章 请求
// ============================================================================

/**
 * 检测用户消息中的"看全本"或"看某一章"意图。
 * 优先返回匹配到的书名+可选章节标记。
 */
function detectFullBookIntent(message: string): {
  matchedBook: string | null;
  chapter: string | null;
} {
  const text = message.trim();
  if (!text) return { matchedBook: null, chapter: null };

  // 1) 拉取所有书名（含本地+云端）
  const { bookNames } = getLocalBookInfo();
  if (!bookNames || bookNames.length === 0) {
    return { matchedBook: null, chapter: null };
  }

  // 2) 匹配书名：精确包含优先（长名优先，避免「滴天髓」抢「滴天髓阐微」）
  const sortedBooks = [...bookNames].sort((a, b) => b.length - a.length);
  // 去掉书名号干扰
  const cleanText = text.replace(/[《》「」『』]/g, '');
  let matchedBook: string | null = null;
  for (const name of sortedBooks) {
    const cleanName = name.replace(/[《》「」『』]/g, '');
    if (cleanText.includes(cleanName)) {
      matchedBook = name;
      break;
    }
  }
  if (!matchedBook) return { matchedBook: null, chapter: null };

  // 3) 判断意图：包含「全本/全文/原文/完整/整本/全篇/所有内容/从第一」等关键词
  // 还有"发我"、"给我看"等口语化表达
  const fullBookPatterns = [
    /全文|全部原文|全本|整本|全篇|完整内容|所有内容/,
    /从第一(页|字|个字|章)/,
    /到最后一(页|字|个字|章)/,
    /从头到尾|一字不漏|逐字/,
    /原文.*(发|看|读|展示|给我|出来)/,
    /(发|看|读|展示).*原文/,
  ];
  const isFullBookIntent = fullBookPatterns.some((re) => re.test(text));

  // 4) 判断单章意图：「第N章/第N卷/第N回/第N篇/第N卦/第N部」
  // 中文数字 + 阿拉伯数字
  const chapterMatch = text.match(
    /第\s*([一二三四五六七八九十百千零\d]+)\s*(章|卷|回|篇|卦|部|节|讲|册|集|课)/,
  );
  if (chapterMatch) {
    return { matchedBook, chapter: `第${chapterMatch[1]}${chapterMatch[2]}` };
  }

  // 5) 如果只匹配到书名 + 全本意图 → 返回全本
  if (isFullBookIntent) {
    return { matchedBook, chapter: null };
  }

  // 6) 用户只说书名没说要全本，也没说哪一章 → 不主动返全本，回归关键词检索
  return { matchedBook: null, chapter: null };
}

/**
 * 从书籍全文中截取指定章节。
 * @param fullText 完整书全文
 * @param chapterLabel 章节标签，如「第一章」「第三卷」「第六十四卦」
 * @returns 命中章节的内容+真实匹配标题；未命中返回 null
 */
function sliceChapterFromBook(
  fullText: string,
  chapterLabel: string,
): { content: string; matchedTitle: string } | null {
  // 在全文里找包含该章节标签的行
  const labelRe = new RegExp(
    chapterLabel.replace(/[第章卷回篇卦部节讲册集课]/g, (m) => '\\' + m),
    'g',
  );
  const lines = fullText.split('\n');
  let startIdx = -1;
  let matchedTitle = '';
  for (let i = 0; i < lines.length; i++) {
    if (labelRe.test(lines[i])) {
      startIdx = i;
      matchedTitle = lines[i].trim();
      break;
    }
    labelRe.lastIndex = 0;
  }
  if (startIdx === -1) return null;

  // 找下一章作为结束位置：匹配"第X章/卷/回/篇/卦/部/节/讲/册/集/课"行（且不是当前章节）
  const nextChapRe = /第\s*[一二三四五六七八九十百千零\d]+\s*(章|卷|回|篇|卦|部|节|讲|册|集|课)/;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (nextChapRe.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  const content = lines.slice(startIdx, endIdx).join('\n').trim();
  return { content, matchedTitle };
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
