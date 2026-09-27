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
  private readonly model: string;
  private readonly fastModel: string;

  constructor() {
    // 9router (self-hosted, OpenAI-compatible) — dari container, host-nya diakses via
    // host.docker.internal (lihat extra_hosts di docker-compose.prod.yml).
    this.baseUrl = process.env.AI_BASE_URL ?? 'http://host.docker.internal:20128';
    this.apiKey = process.env.AI_API_KEY ?? '';
    this.model = process.env.AI_MODEL ?? 'cc/claude-sonnet-5';
    // Model murah/cepat buat tugas pendek (kategorisasi, ekstraksi) — lihat 02-conventions.md §3.
    this.fastModel = process.env.AI_MODEL_FAST ?? 'cc/claude-haiku-4-5-20251001';

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
    /** 'fast' = AI_MODEL_FAST (kategorisasi dll), atau nama model eksplisit. Default AI_MODEL. */
    model?: 'fast' | string;
  }): Promise<any> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('AI_API_KEY belum dikonfigurasi di environment.');
    }

    const allMessages: ChatMessage[] = [
      { role: 'system', content: params.system },
      ...params.messages,
    ];

    const model = params.model === 'fast' ? this.fastModel : (params.model ?? this.model);

    const body: Record<string, any> = {
      model,
      // 9router defaults ke SSE streaming kalau field ini nggak eksplisit di-set false, walau
      // request-nya bukan buat streaming — respons jadi "data: {...}\n\n" chunks, bukan JSON tunggal.
      stream: false,
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

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.logger.error(`AI API error ${res.status}: ${errText}`);
      throw new InternalServerErrorException(`AI API gagal (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message ?? null;
  }

  /** Tool-calling loop — loop hingga finish_reason !== 'tool_calls' atau maxIterations.
   *  `messages` = history lengkap (termasuk pesan user terbaru). Return HANYA pesan baru
   *  yang dihasilkan (assistant + tool), berurutan, supaya caller bisa persist ke DB. */
  async runToolLoop(params: {
    system: string;
    messages: ChatMessage[];
    tools: AiTool[];
    maxTokens?: number;
    maxIterations?: number;
  }): Promise<ChatMessage[]> {
    const { system, tools, maxTokens = 2048, maxIterations = 5 } = params;

    const working: ChatMessage[] = [...params.messages];
    const newMessages: ChatMessage[] = [];

    for (let i = 0; i < maxIterations; i++) {
      const assistantMessage = await this.chat({ system, messages: working, tools, maxTokens });

      if (!assistantMessage) break;

      working.push(assistantMessage);
      newMessages.push(assistantMessage);

      const finishReason = assistantMessage.finish_reason ??
        (assistantMessage.tool_calls?.length ? 'tool_calls' : 'stop');

      if (finishReason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
        return newMessages;
      }

      // Jalankan tiap tool_call
      for (const toolCall of assistantMessage.tool_calls as OpenAiToolCall[]) {
        const tool = tools.find((t) => t.name === toolCall.function.name);
        let toolContent: string;

        if (!tool) {
          this.logger.warn(`Tool tidak ditemukan: ${toolCall.function.name}`);
          toolContent = JSON.stringify({ error: `Tool ${toolCall.function.name} tidak tersedia` });
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
            this.logger.error(`Tool ${toolCall.function.name} error: ${err?.message}`);
            toolContent = JSON.stringify({ error: err?.message ?? 'Tool error' });
          }
        }

        const toolMessage: ChatMessage = {
          role: 'tool',
          content: toolContent,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        };
        working.push(toolMessage);
        newMessages.push(toolMessage);
      }
    }

    this.logger.warn(`runToolLoop mencapai maxIterations (${maxIterations})`);
    return newMessages;
  }
}
