/**
 * budget-period.check.ts — self-check engine budget periode (docs/budget-kebiasaan.md).
 * Jalankan dengan: npx ts-node src/modules/budget/budget-period.check.ts
 */
import * as assert from 'assert';
import { wibDateKey } from '../../common/wib';
import {
  activeStyle, bigPurchaseImpact, computePeriodAllowance, cycleBounds, incomeImpact, learnedWeights, normalizeWeights, pastiPart,
  paydaysIn, periodSchedule, PeriodAllowanceInput, stylePreviews, usualAmount,
} from './budget-period';

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
const day = (d: string) => new Date(`${d}T00:00:00+07:00`);
const bounds = (b: { start: Date; end: Date }) => `${wibDateKey(b.start)}..${wibDateKey(b.end)}`;
const weekly = { cadence: 'WEEKLY' as const, payDayOfWeek: 5 }; // Jumat
const monthly = (payDayOfMonth: number) => ({ cadence: 'MONTHLY' as const, payDayOfMonth });

console.log('cycleBounds / periodSchedule');
check('mingguan, hari biasa', () => assert.strictEqual(bounds(cycleBounds(weekly, at('2026-10-14'))), '2026-10-09..2026-10-16'));
check('mingguan, tepat hari mulai', () => assert.strictEqual(bounds(cycleBounds(weekly, at('2026-10-16'))), '2026-10-16..2026-10-23'));
check('periode Senin', () => assert.strictEqual(bounds(cycleBounds(periodSchedule('WEEKLY', 1), at('2026-10-30'))), '2026-10-26..2026-11-02'));
check('bulanan tgl 25', () => assert.strictEqual(bounds(cycleBounds(monthly(25), at('2026-10-15'))), '2026-09-25..2026-10-25'));
check('bulanan tgl 31 di Februari (clamp)', () => assert.strictEqual(bounds(cycleBounds(monthly(31), at('2026-02-10'))), '2026-01-31..2026-02-28'));
check('bulanan lintas tahun', () => assert.strictEqual(bounds(cycleBounds(monthly(25), at('2027-01-03'))), '2026-12-25..2027-01-25'));
check('gaji masuk lebih awal → periode baru mulai hari itu', () =>
  assert.strictEqual(bounds(cycleBounds(monthly(25), at('2026-10-24'), at('2026-10-23'))), '2026-10-23..2026-11-25'));
check('gaji tepat waktu tidak menggeser periode', () =>
  assert.strictEqual(bounds(cycleBounds(monthly(25), at('2026-10-15'), at('2026-09-25'))), '2026-09-25..2026-10-25'));

console.log('paydaysIn');
check('mingguan di periode mingguan = 1', () => assert.strictEqual(paydaysIn(periodSchedule('WEEKLY', 1), day('2026-10-26'), day('2026-11-02')), 1));
check('mingguan di periode bulanan Okt = 5 Jumat', () => assert.strictEqual(paydaysIn(weekly, day('2026-10-01'), day('2026-11-01')), 5));
check('bulanan tgl 25 di minggu yang memuatnya = 1', () => assert.strictEqual(paydaysIn(monthly(25), day('2026-10-19'), day('2026-10-26')), 1));
check('bulanan tgl 25 di minggu lain = 0', () => assert.strictEqual(paydaysIn(monthly(25), day('2026-10-26'), day('2026-11-02')), 0));

console.log('usualAmount / pastiPart');
check('riwayat < 3 → angka yang diisi', () => assert.deepStrictEqual(usualAmount([550_000, 560_000], 600_000), { amount: 600_000, learned: false }));
check('riwayat ≥ 3 → median kebiasaan', () => assert.deepStrictEqual(usualAmount([550_000, 700_000, 540_000, 560_000], 600_000), { amount: 555_000, learned: true }));
check('hanya 6 pembayaran terakhir, nol diabaikan', () =>
  assert.strictEqual(usualAmount([100, 100, 0, 100, 100, 100, 100, 9_000, 9_000], 0).amount, 100));
check('belum masuk → perkiraan penuh', () => assert.deepStrictEqual(pastiPart({ usual: 600_000, paydays: 1, received: 0, receivedCount: 0 }), { received: 0, expected: 600_000 }));
check('sudah masuk → angka asli, perkiraan 0', () => assert.deepStrictEqual(pastiPart({ usual: 600_000, paydays: 1, received: 550_000, receivedCount: 1 }), { received: 550_000, expected: 0 }));
check('bulanan: 2 dari 5 payday masuk', () => assert.deepStrictEqual(pastiPart({ usual: 100, paydays: 5, received: 220, receivedCount: 2 }), { received: 220, expected: 300 }));
check('masuk lebih awal tanpa payday di periode', () => assert.deepStrictEqual(pastiPart({ usual: 100, paydays: 0, received: 100, receivedCount: 1 }), { received: 100, expected: 0 }));

console.log('computePeriodAllowance');
const flat = normalizeWeights([]);
// Periode Senin 26 Okt – Senin 2 Nov; hari ini Jumat 30 Okt → sisa Jum, Sab, Min = 3 hari.
const base: PeriodAllowanceInput = {
  now: at('2026-10-30'), start: day('2026-10-26'), end: day('2026-11-02'), basis: 'INCOME',
  pastiReceived: 0, pastiExpected: 700_000, tambahan: 0, target: 0, reservePct: 0,
  carry: 0, commitments: 0, spentBeforeToday: 400_000, weights: flat,
};
check('INCOME: sisa dibagi rata ke sisa hari', () => {
  const r = computePeriodAllowance(base);
  assert.deepStrictEqual([r.periodBudget, r.remaining, r.daysLeft, r.allowance, r.deficit], [700_000, 300_000, 3, 100_000, false]);
});
check('pemasukan tambahan langsung menaikkan jatah', () => assert.strictEqual(computePeriodAllowance({ ...base, tambahan: 300_000 }).allowance, 200_000));
check('disisihkan dari pemasukan', () => {
  const r = computePeriodAllowance({ ...base, pastiExpected: 1_000_000, reservePct: 10, spentBeforeToday: 0 });
  assert.deepStrictEqual([r.reserve, r.periodBudget, r.remaining], [100_000, 900_000, 900_000]);
});
check('langganan mendatang & carry', () => {
  const r = computePeriodAllowance({ ...base, commitments: 100_000, carry: 50_000 });
  assert.deepStrictEqual([r.periodBudget, r.remaining], [750_000, 250_000]);
});
check('TARGET: pemasukan tidak berpengaruh', () => {
  const r = computePeriodAllowance({ ...base, basis: 'TARGET', target: 1_000_000, tambahan: 5_000_000 });
  assert.deepStrictEqual([r.periodBudget, r.allowance], [1_000_000, 200_000]);
});
check('defisit → jatah 0', () => {
  const r = computePeriodAllowance({ ...base, spentBeforeToday: 900_000 });
  assert.deepStrictEqual([r.allowance, r.remaining, r.deficit], [0, -200_000, true]);
});
check('bobot: Sabtu 2× hari lain → Jumat dapat 1/4', () => {
  const r = computePeriodAllowance({ ...base, weights: normalizeWeights([1, 1, 1, 1, 1, 1, 2]) });
  assert.strictEqual(r.allowance, 75_000);
});
check('hari terakhir periode dapat semua sisa', () => assert.strictEqual(computePeriodAllowance({ ...base, now: at('2026-11-01') }).allowance, 300_000));

console.log('periode pertama (daftar di tengah periode)');
check('daftar Kamis, 600rb/minggu, sisihkan 10% → ≈ 600rb×90%÷7 per hari', () => {
  const r = computePeriodAllowance({ ...base, now: at('2026-10-29'), activeFrom: at('2026-10-29'), pastiExpected: 600_000, reservePct: 10, spentBeforeToday: 0 });
  assert.ok(Math.abs(r.prorate - 4 / 7) < 1e-9);
  assert.strictEqual(r.allowance, 77_000); // 540rb × 4/7 ÷ 4 hari = 77.142 → 77.000
});
check('yang sudah masuk setelah daftar tidak diprorata', () => {
  const r = computePeriodAllowance({ ...base, now: at('2026-10-29'), activeFrom: at('2026-10-29'), pastiExpected: 0, tambahan: 400_000, spentBeforeToday: 0 });
  assert.strictEqual(r.periodBudget, 400_000);
});
check('TARGET diprorata', () =>
  assert.strictEqual(computePeriodAllowance({ ...base, basis: 'TARGET', target: 700_000, now: at('2026-10-29'), activeFrom: at('2026-10-29'), spentBeforeToday: 0 }).periodBudget, 400_000));
check('daftar sebelum periode → tidak diprorata', () => assert.strictEqual(computePeriodAllowance({ ...base, activeFrom: day('2026-10-01') }).prorate, 1));

console.log('gaya (hemat/seimbang/longgar)');
check('INCOME: pratinjau 3 gaya, hemat paling kecil', () => {
  const s = stylePreviews({ ...base, pastiExpected: 1_000_000, spentBeforeToday: 0 }, null);
  assert.deepStrictEqual(s.map((x) => [x.option, x.reservePct, x.periodBudget]), [['hemat', 15, 850_000], ['seimbang', 10, 900_000], ['longgar', 5, 950_000]]);
});
check('TARGET tanpa kebiasaan belanja → tidak ada pratinjau', () => assert.deepStrictEqual(stylePreviews({ ...base, basis: 'TARGET' }, null), []));
check('TARGET: 85/100/110% belanja biasanya', () =>
  assert.deepStrictEqual(stylePreviews({ ...base, basis: 'TARGET' }, 600_000).map((x) => x.target), [510_000, 600_000, 660_000]));
check('gaya aktif terbaca', () => {
  assert.strictEqual(activeStyle('INCOME', 15, 0, null), 'hemat');
  assert.strictEqual(activeStyle('INCOME', 12, 0, null), null);
  assert.strictEqual(activeStyle('TARGET', 0, 660_000, 600_000), 'longgar');
});

console.log('bobot belajar');
check('riwayat < 4 minggu → null', () => assert.strictEqual(learnedWeights([1, 1, 1, 1, 1, 1, 1], 3), null));
check('Sabtu boros → bobot Sabtu terbesar, hari sepi tetap ≥ 40% rata-rata', () => {
  const w = learnedWeights([0, 50, 50, 50, 50, 50, 200], 8)!;
  assert.ok(w[6] > w[1]);
  assert.ok(w[0] > 0);
  assert.ok(Math.abs(w.reduce((s, v) => s + v, 0) - 1) < 1e-9);
});

console.log('dampak');
check('pembelian besar: jatah hari berikutnya turun', () => {
  const r = bigPurchaseImpact({ cycle: { remaining: 600_000, daysLeft: 3 }, totalSpent: 400_000, bigThreshold: 300_000 }, 400_000);
  assert.deepStrictEqual(r, { before: 300_000, after: 100_000, days: 2 });
});
check('pemasukan: jatah naik', () => assert.deepStrictEqual(incomeImpact(200_000, 500_000, 3), { before: 66_500, after: 166_500, days: 3 }));
check('pemasukan tanpa perubahan → null', () => assert.strictEqual(incomeImpact(200_000, 200_000, 3), null));

console.log(`\n${passed} lulus, ${failed} gagal`);
if (failed) process.exit(1);
