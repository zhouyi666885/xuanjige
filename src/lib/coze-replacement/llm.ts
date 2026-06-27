/**
 * 替换 coze-coding-dev-sdk LLMClient —— OpenAI 兼容协议
 * 兼容原 SDK 接口：
 *   - stream(messages, options) -> async iterable of { content }
 *   - invoke(messages, options) -> { content }
 */
import OpenAI from 'openai';
import type { Config } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LLMMessageContent = string | any[];

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: LLMMessageContent;
}

export interface LLMStreamOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface LLMStreamChunk {
  content?: string;
  finish_reason?: string | null;
}

export interface LLMInvokeResult {
  content: string;
}

export class LLMClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: Config, customHeaders?: Record<string, string>) {
    if (!config.llmApiKey) {
      throw new Error('[LLMClient] 缺少 LLM_API_KEY 环境变量');
    }
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl,
      defaultHeaders: customHeaders,
    });
    this.defaultModel = config.llmModel;
  }

  /** 流式生成 —— 返回 async iterable */
  async *stream(messages: LLMMessage[], options: LLMStreamOptions = {}): AsyncGenerator<LLMStreamChunk> {
    const model = options.model || this.defaultModel;
    const openaiMessages = messages.map((m) => ({
      role: m.role,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: m.content as any,
    }));

    let response;
    try {
      response = await this.client.chat.completions.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: model as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: openaiMessages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        top_p: options.top_p,
        stream: true,
      });
    } catch (err) {
      throw new Error(`[LLMClient.stream] 调用失败：${(err as Error).message}`);
    }

    for await (const chunk of response) {
      const delta = chunk.choices?.[0]?.delta;
      const finish = chunk.choices?.[0]?.finish_reason;
      if (delta?.content || finish) {
        yield {
          content: delta?.content || '',
          finish_reason: finish,
        };
      }
    }
  }

  /** 非流式同步调用 —— 兼容原 SDK 的 invoke 方法 */
  async invoke(messages: LLMMessage[], options: LLMStreamOptions = {}): Promise<LLMInvokeResult> {
    const model = options.model || this.defaultModel;
    const openaiMessages = messages.map((m) => ({
      role: m.role,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: m.content as any,
    }));
    try {
      const resp = await this.client.chat.completions.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: model as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: openaiMessages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        top_p: options.top_p,
      });
      const content = resp.choices?.[0]?.message?.content || '';
      return { content };
    } catch (err) {
      throw new Error(`[LLMClient.invoke] 调用失败：${(err as Error).message}`);
    }
  }
}
