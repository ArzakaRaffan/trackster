/**
 * ai-memory.check.ts — self-check parseMemoryOps (E04-S2), input untrusted (output model ekstraksi).
 * Jalankan dengan: npx ts-node src/modules/ai/ai-memory.check.ts
 */
import * as assert from 'assert';
import { parseMemoryOps } from './ai-memory.service';

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

console.log('\n── parseMemoryOps ──');

check('add valid → satu op, importance default 2', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'add', kind: 'GOAL', content: 'Mau beli laptop 12jt sebelum Juni' }]));
  assert.strictEqual(ops.length, 1);
  assert.deepStrictEqual(ops[0], { op: 'add', kind: 'GOAL', content: 'Mau beli laptop 12jt sebelum Juni', importance: 2 });
});

check('add dengan importance & validUntil dipertahankan', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'add', kind: 'EVENT', content: 'Wisuda 20 Des', importance: 3, validUntil: '2026-12-21' }]));
  assert.strictEqual((ops[0] as any).importance, 3);
  assert.strictEqual((ops[0] as any).validUntil, '2026-12-21');
});

check('importance di luar range 1-3 di-clamp', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'add', kind: 'PLAN', content: 'x', importance: 99 }]));
  assert.strictEqual((ops[0] as any).importance, 3);
  const ops2 = parseMemoryOps(JSON.stringify([{ op: 'add', kind: 'PLAN', content: 'x', importance: -5 }]));
  assert.strictEqual((ops2[0] as any).importance, 1);
});

check('kind tidak valid → entry di-skip, bukan gagal semua', () => {
  const ops = parseMemoryOps(
    JSON.stringify([{ op: 'add', kind: 'BUKAN_KIND', content: 'x' }, { op: 'add', kind: 'PROFILE', content: 'valid' }]),
  );
  assert.strictEqual(ops.length, 1);
  assert.strictEqual((ops[0] as any).kind, 'PROFILE');
});

check('content kosong/whitespace → entry di-skip', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'add', kind: 'PROFILE', content: '   ' }]));
  assert.strictEqual(ops.length, 0);
});

check('update: cuma field yang dikirim yang masuk op', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'update', id: 5, content: 'Update konten' }]));
  assert.deepStrictEqual(ops[0], { op: 'update', id: 5, content: 'Update konten' });
});

check('update tanpa id numerik → di-skip', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'update', content: 'x' }]));
  assert.strictEqual(ops.length, 0);
});

check('archive: cuma id yang dipakai', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'archive', id: 7, alasan: 'sudah tidak relevan' }]));
  assert.deepStrictEqual(ops[0], { op: 'archive', id: 7 });
});

check('op tidak dikenal → di-skip', () => {
  const ops = parseMemoryOps(JSON.stringify([{ op: 'delete_everything', id: 1 }]));
  assert.strictEqual(ops.length, 0);
});

check('maksimal 3 operasi per giliran, sisanya dipotong', () => {
  const raw = JSON.stringify(
    Array.from({ length: 5 }, (_, i) => ({ op: 'add', kind: 'PROFILE', content: `fakta ${i}` })),
  );
  const ops = parseMemoryOps(raw);
  assert.strictEqual(ops.length, 3);
});

check('bukan JSON → array kosong, tidak throw', () => {
  const ops = parseMemoryOps('halo ini bukan json {{{');
  assert.deepStrictEqual(ops, []);
});

check('JSON valid tapi bukan array → array kosong', () => {
  const ops = parseMemoryOps(JSON.stringify({ op: 'add', kind: 'PROFILE', content: 'x' }));
  assert.deepStrictEqual(ops, []);
});

check('array kosong → array kosong', () => {
  assert.deepStrictEqual(parseMemoryOps('[]'), []);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
