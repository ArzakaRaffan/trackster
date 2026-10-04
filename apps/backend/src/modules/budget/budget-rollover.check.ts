/** Self-check: `npx ts-node src/modules/budget/budget-rollover.check.ts` */
import * as assert from 'assert';
import { calcRollover } from './budget-rollover';

assert.strictEqual(calcRollover([]), 0, 'Senin: tidak ada hari sebelumnya');
assert.strictEqual(calcRollover([{ budget: 100_000, spent: 60_000 }]), 40_000, 'sisa kemarin terbawa');
assert.strictEqual(
  calcRollover([{ budget: 100_000, spent: 60_000 }, { budget: 100_000, spent: 100_000 }]),
  40_000,
  'sisa berantai: hari kedua pas-pasan, sisa hari pertama tetap terbawa',
);
assert.strictEqual(
  calcRollover([{ budget: 100_000, spent: 60_000 }, { budget: 100_000, spent: 190_000 }]),
  0,
  'overspend menghabiskan sisa, tapi tidak jadi utang negatif',
);
assert.strictEqual(
  calcRollover([{ budget: 100_000, spent: 190_000 }, { budget: 100_000, spent: 50_000 }]),
  50_000,
  'overspend kemarin tidak menghukum hari ini (carry tidak negatif)',
);
console.log('budget-rollover.check: 5 skenario lulus');
