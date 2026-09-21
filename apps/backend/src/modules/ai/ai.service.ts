import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AiTool {
  name: string;
  description: string;
  input_schema: object;
  handler: (input: any) => Promise<unknown>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly authHeader: string;
  private readonly model: string;

  constructor() {
    this.baseUrl =
      process.env.AI_BASE_URL ??
      process.env.SPLITBILL_AI_BASE_URL ??
      'https://api.ghrocx.my.id';
    this.apiKey =
      process.env.AI_API_KEY ?? process.env.SPLITBILL_AI_API_KEY ?? '';
    this.authHeader =
      process.env.AI_AUTH_HEADER ?? 'x-bf-vk';
    this.model =
      process.env.AI_MODEL ?? process.env.SPLITBILL_AI_MODEL ?? 'ghrocx/sonnet-5';

    if (!this.apiKey) {
      this.logger.warn('AI_API_KEY belum di-set — fitur AI tidak akan berjalan.');
    }
  }

  /** Satu call ke OpenAI-compatible API, return raw response (choices[0].message) */
  async chat(params: {
    system: string;
    messages: ChatMessage[];
    tools?: AiTool[];
    maxTokens?: number;
  }): Promise<any> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('AI_API_KEY belum dikonfigurasi di environment.');
    }

    const allMessages: ChatMessage[] = [
      { role: 'system', content: params.system },
      ...params.messages,
    ];

    const body: Record<string, any> = {
      model: this.model,
      max_tokens: params.maxTokens ?? 2048,
      messages: allMessages,
    };

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
      body.tool_choice = 'auto';
    }

    const res = await fetch(${this.baseUrl}/v1/chat/completions, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [this.authHeader]: this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.logger.error(AI API error : );
      throw new InternalServerErrorException(AI API gagal (HTTP ));
    }

    const data = await res.json();
    return data.choices?.[0]?.message ?? null;
  }

  /** Tool-calling loop — loop hingga finish_reason !== 'tool_calls' atau maxIterations.
   *  Return text terakhir dari model. */
  async runToolLoop(params: {
    system: string;
    userMessage: string;
    tools: AiTool[];
    maxTokens?: number;
    maxIterations?: number;
  }): Promise<string> {
    const { system, userMessage, tools, maxTokens = 2048, maxIterations = 5 } = params;

    const messages: ChatMessage[] = [{ role: 'user', content: userMessage }];

    for (let i = 0; i < maxIterations; i++) {
      const assistantMessage = await this.chat({ system, messages, tools, maxTokens });

      if (!assistantMessage) return '';

      // Append assistant reply
      messages.push(assistantMessage);

      const finishReason = assistantMessage.finish_reason ??
        (assistantMessage.tool_calls?.length ? 'tool_calls' : 'stop');

      if (finishReason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
        return assistantMessage.content ?? '';
      }

      // Jalankan tiap tool_call
      for (const toolCall of assistantMessage.tool_calls as OpenAiToolCall[]) {
        const tool = tools.find((t) => t.name === toolCall.function.name);
        let toolContent: string;

        if (!tool) {
          this.logger.warn(Tool tidak ditemukan: );
          toolContent = JSON.stringify({ error: Tool  tidak tersedia });
        } else {
          try {
            let input: any;
            try {
              input = JSON.parse(toolCall.function.arguments);
            } catch {
              input = {};
            }
            const result = await tool.handler(input);
            toolContent = JSON.stringify(result);
          } catch (err: any) {
            this.logger.error(Tool  error: );
            toolContent = JSON.stringify({ error: err?.message ?? 'Tool error' });
          }
        }

        messages.push({
          role: 'tool',
          content: toolContent,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }
    }

    this.logger.warn(unToolLoop mencapai maxIterations ());
    // Return teks dari assistant message terakhir
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.content) return msg.content;
    }
    return '';
  }
}
