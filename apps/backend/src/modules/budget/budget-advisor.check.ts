/**
 * budget-advisor.check.ts — self-check engine advisor (E05-S1) + applyDayOverrides (E05-S2).
 * Jalankan dengan: npx ts-node src/modules/budget/budget-advisor.check.ts
 */
import * as assert from 'assert';
import { computeOption, computeDailyWeights, applyDayOverrides, round500, BudgetSuggestionInput } from './budget-advisor';

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

const input: BudgetSuggestionInput = {
  expectedIncome: 1_300_000,
  conservativeIncome: 1_200_000,
  commitments: 10_000,
  medianRoutineByDow: [166_478, 138_923, 97_598, 110_384, 129_023, 89_403, 165_897],
  avgRoutinePerDay: 128_244,
};

console.log('\n── applyDayOverrides ──');

check('tanpa override -> hasil sama persis dengan base', () => {
  const base = computeOption('seimbang', input);
  const weights = computeDailyWeights(input.medianRoutineByDow);
  const result = applyDayOverrides(base, weights, []);
  assert.deepStrictEqual(result, base);
});

check('override 1 hari -> total mingguan tetap sama dengan base', () => {
  const base = computeOption('seimbang', input);
  const weights = computeDailyWeights(input.medianRoutineByDow);
  const result = applyDayOverrides(base, weights, [{ dayOfWeek: 6, amount: 300_000 }]);
  assert.strictEqual(result.dailyAmounts[6], 300_000);
  const total = result.dailyAmounts.reduce((a, b) => a + b, 0);
  assert.strictEqual(total, result.totalWeekly);
});

check('hari lain diredistribusi proporsional (bukan rata sama rata) sesuai bobot asli', () => {
  const base = computeOption('seimbang', input);
  const weights = computeDailyWeights(input.medianRoutineByDow);
  const result = applyDayOverrides(base, weights, [{ dayOfWeek: 6, amount: 0 }]);
  // Senin (weight lebih besar dari Sabtu asli) harus tetap dapat jatah lebih besar dari Selasa
  assert.ok(result.dailyAmounts[1] > result.dailyAmounts[2]);
});

check('override semua hari -> totalWeekly = jumlah override, tidak ada sisa diredistribusi', () => {
  const base = computeOption('seimbang', input);
  const weights = computeDailyWeights(input.medianRoutineByDow);
  const overrides = [0, 1, 2, 3, 4, 5, 6].map(d => ({ dayOfWeek: d, amount: 50_000 }));
  const result = applyDayOverrides(base, weights, overrides);
  assert.strictEqual(result.totalWeekly, 350_000);
  assert.deepStrictEqual(result.dailyAmounts, [50_000, 50_000, 50_000, 50_000, 50_000, 50_000, 50_000]);
});

check('round500 dipakai untuk hari yang diredistribusi (kelipatan 500)', () => {
  const base = computeOption('seimbang', input);
  const weights = computeDailyWeights(input.medianRoutineByDow);
  const result = applyDayOverrides(base, weights, [{ dayOfWeek: 6, amount: 111_111 }]);
  for (let d = 0; d < 6; d++) {
    assert.strictEqual(result.dailyAmounts[d], round500(result.dailyAmounts[d]));
  }
});

console.log(`\n${passed} lulus, ${failed} gagal.\n`);
if (failed > 0) process.exit(1);
