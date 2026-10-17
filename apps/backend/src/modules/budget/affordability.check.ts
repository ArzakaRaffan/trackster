/**
 * affordability.check.ts — "bisa beli ini?" (Telegram /bisa).
 * Jalankan: npx ts-node --transpile-only src/modules/budget/affordability.check.ts
 */
import * as assert from 'assert';
import { affordability } from './affordability';

// Masuk jatah hari ini (semua mode).
assert.deepStrictEqual(affordability({ budget: 100000, remaining: 60000, totalSpent: 40000, cycle: null }, 50000), { verdict: 'TODAY', leftToday: 10000 });
assert.deepStrictEqual(affordability({ budget: 100000, remaining: 60000, totalSpent: 40000, cycle: null }, 60000), { verdict: 'TODAY', leftToday: 0 });

// FIXED: lewat jatah hari ini.
assert.deepStrictEqual(affordability({ budget: 100000, remaining: 60000, totalSpent: 40000, cycle: null }, 250000), { verdict: 'OVER_TODAY', overBy: 190000 });
assert.deepStrictEqual(affordability({ budget: 100000, remaining: -20000, totalSpent: 120000, cycle: null }, 30000), { verdict: 'OVER_TODAY', overBy: 30000 }, 'sudah lewat: kelebihan = nominal');

// Dinamis: sisa siklus 3.040.000 setelah belanja 40rb hari ini, 10 hari lagi (9 hari setelah hari ini).
const dyn = { budget: 300000, remaining: 260000, totalSpent: 40000, cycle: { mode: 'CYCLE', remaining: 3080000, daysLeft: 10 } };
assert.deepStrictEqual(affordability(dyn, 900000), { verdict: 'SPREAD', perDayBefore: 338000, perDayAfter: 238000, days: 9 });
assert.deepStrictEqual(affordability(dyn, 5000000), { verdict: 'SHORT', shortBy: 1960000, days: 9 });
// Hari terakhir siklus: dibagi minimal 1 hari.
assert.deepStrictEqual(affordability({ ...dyn, cycle: { mode: 'CYCLE', remaining: 540000, daysLeft: 1 } }, 400000), { verdict: 'SPREAD', perDayBefore: 500000, perDayAfter: 100000, days: 1 });

console.log('affordability.check: OK');
