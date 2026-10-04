import type { OpenAiToolCall } from './ai.service';

export interface StreamedMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
}

/** Baca respons SSE OpenAI-compatible (`data: {choices:[{delta}]}`), panggil `onToken` tiap potongan
 * teks, dan rakit pesan akhir (teks + tool_calls yang datang bertahap per `index`) — bentuknya
 * sama dengan `choices[0].message` dari respons non-stream, jadi `runToolLoop` tidak perlu tahu bedanya. */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onToken: (text: string) => void,
): Promise<StreamedMessage | null> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  let content = '';
  const toolCalls: OpenAiToolCall[] = [];

  const handleLine = (line: string) => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let delta: any;
    try {
      delta = JSON.parse(payload).choices?.[0]?.delta;
    } catch {
      return; // baris rusak/terpotong dari proxy — abaikan, jangan gagalkan seluruh balasan
    }
    if (!delta) return;
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      onToken(delta.content);
    }
    for (const tc of delta.tool_calls ?? []) {
      const slot = (toolCalls[tc.index ?? 0] ??= { id: '', type: 'function', function: { name: '', arguments: '' } });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      handleLine(buffer.slice(0, nl).replace(/\r$/, ''));
      buffer = buffer.slice(nl + 1);
    }
  }
  handleLine(buffer.replace(/\r$/, ''));

  const calls = toolCalls.filter(Boolean);
  if (!content && calls.length === 0) return null;
  return { role: 'assistant', content: content || null, ...(calls.length ? { tool_calls: calls } : {}) };
}
