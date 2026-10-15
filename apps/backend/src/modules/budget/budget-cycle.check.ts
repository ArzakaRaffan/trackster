/**
 * budget-cycle.check.ts — self-check engine siklus gajian (docs/siklus-gajian.md).
 * Jalankan dengan: npx ts-node src/modules/budget/budget-cycle.check.ts
 */
import * as assert from 'assert';
import { wibDateKey } from '../../common/wib';
import { cycleBounds, computeCycleAllowance, computeBalanceAllowance, normalizeWeights, CycleAllowanceInput } from './budget-cycle';

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

const at = (d: string) => new Date(`${d}T10:00:00+07:00`);
const bounds = (b: { start: Date; end: Date }) => `${wibDateKey(b.start)}..${wibDateKey(b.end)}`;
const weekly = { cadence: 'WEEKLY' as const, payDayOfWeek: 5 }; // Jumat
const monthly = (payDayOfMonth: number) => ({ cadence: 'MONTHLY' as const, payDayOfMonth });

console.log('cycleBounds');
check('mingguan, hari biasa', () => assert.strictEqual(bounds(cycleBounds(weekly, at('2026-10-14'))), '2026-10-09..2026-10-16'));
check('mingguan, tepat payday', () => assert.strictEqual(bounds(cycleBounds(weekly, at('2026-10-16'))), '2026-10-16..2026-10-23'));
check('bulanan tgl 25', () => assert.strictEqual(bounds(cycleBounds(monthly(25), at('2026-10-15'))), '2026-09-25..2026-10-25'));
check('bulanan tgl 31 di Februari (clamp)', () => assert.strictEqual(bounds(cycleBounds(monthly(31), at('2026-02-10'))), '2026-01-31..2026-02-28'));
check('bulanan tgl 31 setelah Februari', () => assert.strictEqual(bounds(cycleBounds(monthly(31), at('2026-03-05'))), '2026-02-28..2026-03-31'));
check('bulanan lintas tahun', () => assert.strictEqual(bounds(cycleBounds(monthly(25), at('2027-01-03'))), '2026-12-25..2027-01-25'));
check('gaji masuk lebih awal → siklus baru mulai hari itu', () =>
  assert.strictEqual(bounds(cycleBounds(monthly(25), at('2026-10-24'), at('2026-10-23'))), '2026-10-23..2026-11-25'));
check('gaji awal tetap terbaca setelah payday lewat', () =>
  assert.strictEqual(bounds(cycleBounds(monthly(25), at('2026-10-27'), at('2026-10-23'))), '2026-10-23..2026-11-25'));
check('gaji tepat waktu tidak menggeser siklus', () =>
  assert.strictEqual(bounds(cycleBounds(monthly(25), at('2026-10-15'), at('2026-09-25'))), '2026-09-25..2026-10-25'));

console.log('computeCycleAllowance');
const flat = normalizeWeights([]);
const base: CycleAllowanceInput = {
  now: at('2026-10-14'), // Rabu; sisa hari: Rabu, Kamis
  cycleStart: at('2026-10-09'),
  cycleEnd: new Date('2026-10-16T00:00:00+07:00'),
  anchorExpected: 700_000,
  anchorReceived: null,
  otherIncome: 0,
  carry: 0,
  commitments: 0,
  reservePct: 0,
  spentBeforeToday: 500_000,
  weights: flat,
};
check('sisa dibagi rata ke sisa hari', () => {
  const r = computeCycleAllowance(base);
  assert.deepStrictEqual([r.remaining, r.daysLeft, r.allowance, r.deficit], [200_000, 2, 100_000, false]);
});
check('nominal aktual menggantikan forecast', () => assert.strictEqual(computeCycleAllowance({ ...base, anchorReceived: 800_000 }).allowance, 150_000));
check('bobot hari: Kamis 2x Rabu → Rabu dapat 1/3', () => {
  const weights = normalizeWeights([1, 1, 1, 1, 2, 1, 1]);
  assert.strictEqual(computeCycleAllowance({ ...base, anchorReceived: 800_000, weights }).allowance, 100_000);
});
check('cadangan dari pemasukan, komitmen & carry ikut', () => {
  const r = computeCycleAllowance({ ...base, anchorExpected: 900_000, otherIncome: 100_000, reservePct: 10, commitments: 200_000, carry: 50_000, spentBeforeToday: 0 });
  assert.strictEqual(r.remaining, 750_000);
});
check('defisit → jatah 0', () => {
  const r = computeCycleAllowance({ ...base, spentBeforeToday: 900_000 });
  assert.deepStrictEqual([r.allowance, r.remaining, r.deficit], [0, -200_000, true]);
});
check('bobot kosong → rata', () => assert.ok(normalizeWeights([0, 0, 0, 0, 0, 0, 0]).every((w) => w === 1 / 7)));

console.log('computeBalanceAllowance');
const bal = { now: at('2026-10-14'), balance: 900_000, spentToday: 100_000, commitments: 0, horizonDays: 30, burnRatePerDay: 50_000, weights: flat };
check('saldo + belanja hari ini dibagi horizon', () => {
  const r = computeBalanceAllowance(bal);
  assert.deepStrictEqual([r.remaining, r.allowance, r.runwayDays], [1_000_000, 33_500, 20]);
});
check('tanpa burn rate → runway null', () => assert.strictEqual(computeBalanceAllowance({ ...bal, burnRatePerDay: 0 }).runwayDays, null));
check('komitmen melebihi saldo → defisit', () => {
  const r = computeBalanceAllowance({ ...bal, commitments: 2_000_000 });
  assert.deepStrictEqual([r.allowance, r.deficit, r.runwayDays], [0, true, 0]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
