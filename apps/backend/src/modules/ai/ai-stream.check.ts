/** Self-check: `npx ts-node src/modules/ai/ai-stream.check.ts` */
import * as assert from 'assert';
import { readChatStream } from './ai-stream';

const enc = new TextEncoder();
/** Stream sintetis dengan potongan byte yang SENGAJA memotong di tengah baris/event. */
const streamOf = (text: string, chunk = 17) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < text.length; i += chunk) c.enqueue(enc.encode(text.slice(i, i + chunk)));
      c.close();
    },
  });
const ev = (delta: object) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;

async function main() {
  // 1. teks biasa, terpotong sembarang, berakhir [DONE]
  const tokens: string[] = [];
  const m1 = await readChatStream(
    streamOf(ev({ content: 'Halo ' }) + ev({ content: 'Arzaka' }) + 'data: [DONE]\n\n'),
    (t) => tokens.push(t),
  );
  assert.strictEqual(m1?.content, 'Halo Arzaka');
  assert.deepStrictEqual(tokens, ['Halo ', 'Arzaka']);
  assert.strictEqual(m1?.tool_calls, undefined);

  // 2. tool_calls bertahap per index (id+name di chunk pertama, arguments dipotong-potong)
  const m2 = await readChatStream(
    streamOf(
      ev({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'getWeeklySummary', arguments: '{"a"' } }] }) +
        ev({ tool_calls: [{ index: 0, function: { arguments: ':1}' } }] }) +
        ev({ tool_calls: [{ index: 1, id: 'c2', function: { name: 'getGoals', arguments: '{}' } }] }) +
        'data: [DONE]\n\n',
    ),
    () => assert.fail('tool call tidak boleh memicu onToken'),
  );
  assert.strictEqual(m2?.content, null);
  assert.strictEqual(m2?.tool_calls?.length, 2);
  assert.strictEqual(m2?.tool_calls?.[0].function.arguments, '{"a":1}');
  assert.strictEqual(m2?.tool_calls?.[0].function.name, 'getWeeklySummary');
  assert.strictEqual(m2?.tool_calls?.[1].id, 'c2');

  // 3. baris rusak diabaikan, CRLF aman, event terakhir tanpa newline penutup tetap terbaca
  const m3 = await readChatStream(
    streamOf('data: {rusak\r\n\r\n' + ev({ content: 'ok' }).replace(/\n/g, '\r\n') + 'data: ' + JSON.stringify({ choices: [{ delta: { content: '!' } }] })),
    () => {},
  );
  assert.strictEqual(m3?.content, 'ok!');

  // 4. stream kosong -> null (caller memperlakukan seperti respons kosong)
  assert.strictEqual(await readChatStream(streamOf('data: [DONE]\n\n'), () => {}), null);

  console.log('ai-stream.check: 4 skenario lulus');
}
main();
