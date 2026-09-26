/**
 * ai-chat.check.ts — self-check untuk extractFinalReply (E04-S1)
 * Jalankan dengan: npx ts-node src/modules/ai/ai-chat.check.ts
 */
import * as assert from 'assert';
import { extractFinalReply } from './ai-chat.service';
import { ChatMessage } from './ai.service';

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ ${label}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

console.log('\n── extractFinalReply ──');

check('balasan langsung tanpa tool call', () => {
  const messages: ChatMessage[] = [{ role: 'assistant', content: 'Sisa budget Rp50.000' }];
  assert.strictEqual(extractFinalReply(messages), 'Sisa budget Rp50.000');
});

check('satu putaran tool call: stub tool_calls diabaikan, ambil balasan akhir', () => {
  const messages: ChatMessage[] = [
    { role: 'assistant', content: null, tool_calls: [{ id: '1', type: 'function', function: { name: 'getTodaySummary', arguments: '{}' } }] },
    { role: 'tool', content: '{"remaining":50000}', tool_call_id: '1', name: 'getTodaySummary' },
    { role: 'assistant', content: 'Sisa budget hari ini Rp50.000' },
  ];
  assert.strictEqual(extractFinalReply(messages), 'Sisa budget hari ini Rp50.000');
});

check('dua putaran tool call berantai: tetap ambil assistant paling akhir yang ada content', () => {
  const messages: ChatMessage[] = [
    { role: 'assistant', content: null, tool_calls: [{ id: '1', type: 'function', function: { name: 'logExpense', arguments: '{}' } }] },
    { role: 'tool', content: '{"ok":true}', tool_call_id: '1', name: 'logExpense' },
    { role: 'assistant', content: null, tool_calls: [{ id: '2', type: 'function', function: { name: 'getTodaySummary', arguments: '{}' } }] },
    { role: 'tool', content: '{"remaining":25000}', tool_call_id: '2', name: 'getTodaySummary' },
    { role: 'assistant', content: 'Sudah kucatat, sisa Rp25.000' },
  ];
  assert.strictEqual(extractFinalReply(messages), 'Sudah kucatat, sisa Rp25.000');
});

check('tidak ada assistant message sama sekali → undefined', () => {
  assert.strictEqual(extractFinalReply([]), undefined);
});

check('model gagal balas (maxIterations habis, cuma stub tool_calls) → undefined', () => {
  const messages: ChatMessage[] = [
    { role: 'assistant', content: null, tool_calls: [{ id: '1', type: 'function', function: { name: 'x', arguments: '{}' } }] },
    { role: 'tool', content: '{}', tool_call_id: '1', name: 'x' },
  ];
  assert.strictEqual(extractFinalReply(messages), undefined);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
