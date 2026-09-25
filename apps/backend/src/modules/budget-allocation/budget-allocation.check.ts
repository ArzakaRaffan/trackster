/**
 * budget-allocation.check.ts — self-check formula alokasi 50/30/20.
 * Jalankan dengan: npx ts-node src/modules/budget-allocation/budget-allocation.check.ts
 */
import * as assert from 'assert';
import { calcWeeklyAllocation } from './budget-allocation.service';

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

console.log('\n── calcWeeklyAllocation ──');

check('Contoh dari Arzaka: 900.000 -> needs 450.000 / wants 270.000 / savings 180.000', () => {
  const alloc = calcWeeklyAllocation(900_000);
  assert.strictEqual(alloc.needs, 450_000);
  assert.strictEqual(alloc.wants, 270_000);
  assert.strictEqual(alloc.savings, 180_000);
});

check('dailyAmounts (7 hari) jumlahnya persis needs+wants', () => {
  const alloc = calcWeeklyAllocation(900_000);
  const total = alloc.dailyAmounts.reduce((a, b) => a + b, 0);
  assert.strictEqual(total, alloc.needs + alloc.wants);
  assert.strictEqual(total, 720_000);
});

check('Total needs+wants+savings selalu persis totalIncome (tanpa hilang karena pembulatan)', () => {
  const alloc = calcWeeklyAllocation(900_000);
  assert.strictEqual(alloc.needs + alloc.wants + alloc.savings, 900_000);
});

check('Pembagian tidak bulat (1.000.000): dailyAmounts tetap jumlah persis, sisa masuk hari terakhir', () => {
  const alloc = calcWeeklyAllocation(1_000_000);
  const total = alloc.dailyAmounts.reduce((a, b) => a + b, 0);
  assert.strictEqual(total, alloc.needs + alloc.wants);
  assert.strictEqual(alloc.needs + alloc.wants + alloc.savings, 1_000_000);
  const base = Math.min(...alloc.dailyAmounts.slice(0, 6));
  assert.ok(alloc.dailyAmounts[6] >= base, 'sisa pembagian masuk ke hari terakhir (Sabtu)');
});

check('totalIncome = 0 -> semua nol, tidak error', () => {
  const alloc = calcWeeklyAllocation(0);
  assert.strictEqual(alloc.needs, 0);
  assert.strictEqual(alloc.wants, 0);
  assert.strictEqual(alloc.savings, 0);
  assert.deepStrictEqual(alloc.dailyAmounts, [0, 0, 0, 0, 0, 0, 0]);
});

console.log(`\n${passed} lulus, ${failed} gagal.\n`);
if (failed > 0) process.exit(1);
