/**
 * balance.check.ts — self-check untuk aturan baseline saldo (E01-S3)
 * Jalankan dengan: npx ts-node src/modules/balance/balance.check.ts
 *
 * Semua assert berbasis strict equality — tidak ada test framework.
 */
import * as assert from 'assert';
import { shouldAdjustBalance } from './balance.service';

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

console.log('\n── shouldAdjustBalance ──');

check('belum pernah dikoreksi manual (null) → selalu adjust', () => {
  assert.strictEqual(shouldAdjustBalance(new Date('2020-01-01'), null), true);
});

check('transaksi setelah koreksi manual → adjust', () => {
  const lastAdjustmentAt = new Date('2026-09-22T03:20:00.000Z');
  const occurredAt = new Date('2026-09-23T07:01:00.000Z');
  assert.strictEqual(shouldAdjustBalance(occurredAt, lastAdjustmentAt), true);
});

check('transaksi sebelum koreksi manual → skip (sudah tercakup baseline)', () => {
  const lastAdjustmentAt = new Date('2026-09-22T03:20:00.000Z');
  const occurredAt = new Date('2026-09-20T14:15:00.000Z');
  assert.strictEqual(shouldAdjustBalance(occurredAt, lastAdjustmentAt), false);
});

check('transaksi tepat di waktu koreksi manual (>=) → adjust', () => {
  const lastAdjustmentAt = new Date('2026-09-22T03:20:00.000Z');
  assert.strictEqual(shouldAdjustBalance(lastAdjustmentAt, lastAdjustmentAt), true);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
