/**
 * habit-engine.check.ts — self-check engine kebiasaan mingguan (docs/budget-kebiasaan.md).
 * Jalankan dengan: npx ts-node src/modules/habit/habit-engine.check.ts
 */
import * as assert from 'assert';
import { addWibDays } from '../../common/wib';
import { buildWeeklyHabits, HabitIncome, HabitTx, incomeBaseline, spendBaseline, WeeklyHabitsInput } from './habit-engine';

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

const day = (d: string) => new Date(`${d}T00:00:00+07:00`);
const WEEK = day('2026-10-26'); // Senin
const tx = (at: Date, amount: number, key = 'warung', category = 'MAKANAN', hour = 12, big = false): HabitTx => ({
  amount, occurredAt: new Date(at.getTime() + hour * 3600_000), key, merchant: key === 'kopi' ? 'Kopi Kenangan' : key, category, big,
});

/** 8 minggu riwayat: tiap hari 50rb di warung (siang), Sabtu +100rb, kopi 2×/minggu (Selasa & Kamis, malam). */
function history(weeks = 8): HabitTx[] {
  const out: HabitTx[] = [];
  for (let w = weeks; w >= 1; w--) {
    const ws = addWibDays(WEEK, -7 * w);
    for (let d = 0; d < 7; d++) out.push(tx(addWibDays(ws, d), d === 5 ? 150_000 : 50_000));
    out.push(tx(addWibDays(ws, 1), 30_000, 'kopi', 'MAKANAN', 19), tx(addWibDays(ws, 3), 30_000, 'kopi', 'MAKANAN', 19));
  }
  return out;
}

const base: WeeklyHabitsInput = {
  now: new Date('2026-10-30T20:00:00+07:00'), // Jumat malam → 5 hari berjalan
  weekStart: WEEK, txs: history(), dataStartsAt: day('2026-08-01'), income: null,
  periodLabel: { id: 'minggu ini', en: 'this week' }, pastiLate: [], streakUnder: 0,
};

console.log('spendBaseline');
check('8 minggu penuh → median mingguan rutin', () => {
  const b = spendBaseline(history(), WEEK, day('2026-08-01'));
  assert.strictEqual(b.weeksObserved, 8);
  assert.strictEqual(b.usualWeekly, 6 * 50_000 + 150_000 + 60_000);
  assert.strictEqual(b.avgByDow[6], 150_000); // Sabtu
});
check('minggu sebelum user mulai tidak dihitung', () => {
  const b = spendBaseline(history(), WEEK, day('2026-10-12'));
  assert.deepStrictEqual([b.weeksObserved, b.usualWeekly], [2, null]);
});
check('pembelian besar bukan kebiasaan', () => {
  const b = spendBaseline([...history(), tx(addWibDays(WEEK, -3), 5_000_000, 'laptop', 'BELANJA', 12, true)], WEEK, null);
  assert.strictEqual(b.usualWeekly, 510_000);
});

console.log('buildWeeklyHabits');
check('masih kenalan kalau < 3 minggu', () => {
  const h = buildWeeklyHabits({ ...base, dataStartsAt: day('2026-10-19') });
  assert.deepStrictEqual(h.learning, { weeksObserved: 1, needed: 3 });
  assert.ok(!h.insights.some((x) => x.id.startsWith('habit-') || x.id.startsWith('spend-')));
});
check('kopi 5× minggu ini vs biasanya 2× → warn', () => {
  const now = [...history()];
  for (let d = 0; d < 5; d++) now.push(tx(addWibDays(WEEK, d), 30_000, 'kopi', 'MAKANAN', 19));
  const h = buildWeeklyHabits({ ...base, txs: now });
  const k = h.insights.find((x) => x.id === 'habit-up:kopi');
  assert.ok(k, JSON.stringify(h.insights));
  assert.strictEqual(k!.tone, 'warn');
  assert.ok(k!.textId.includes('Kopi Kenangan 5×') && k!.textId.includes('biasanya 2×'), k!.textId);
});
check('belanja minggu ini jauh di atas pace → spend-up', () => {
  const now = [...history(), tx(addWibDays(WEEK, 0), 400_000, 'resto'), tx(addWibDays(WEEK, 1), 300_000, 'resto')];
  const h = buildWeeklyHabits({ ...base, txs: now });
  assert.ok(h.insights.some((x) => x.id === 'spend-up'), JSON.stringify(h.insights));
});
check('belanja hemat (5 hari, cuma 50rb) → spend-down good', () => {
  const h = buildWeeklyHabits({ ...base, txs: [...history(), tx(addWibDays(WEEK, 0), 50_000)] });
  const s = h.insights.find((x) => x.id === 'spend-down');
  assert.ok(s && s.tone === 'good', JSON.stringify(h.insights));
});
check('kebiasaan baru: merchant 3× padahal belum pernah', () => {
  const now = [...history()];
  for (let d = 0; d < 3; d++) now.push(tx(addWibDays(WEEK, d), 25_000, 'boba', 'MAKANAN', 15));
  assert.ok(buildWeeklyHabits({ ...base, txs: now }).insights.some((x) => x.id === 'habit-new:boba'));
});
check('hari paling boros = Sabtu; di hari Sabtu jadi pengingat', () => {
  const h = buildWeeklyHabits(base);
  assert.deepStrictEqual(h.spending.peakDow?.dow, 6);
  const sat = buildWeeklyHabits({ ...base, now: new Date('2026-10-31T09:00:00+07:00') });
  const p = sat.insights.find((x) => x.id === 'peak-dow')!;
  assert.ok(p.textId.startsWith('Hari ini Sabtu'), p.textId);
});
check('pemasukan pasti telat → warn paling atas', () => {
  const h = buildWeeklyHabits({ ...base, pastiLate: [{ name: 'Uang mingguan', dueDate: WEEK }] });
  assert.strictEqual(h.insights[0].id, 'pasti-late:Uang mingguan');
  assert.ok(h.insights[0].textId.includes('hari Senin'));
});
check('streak di bawah jatah → good', () => assert.ok(buildWeeklyHabits({ ...base, streakUnder: 5 }).insights.some((x) => x.id === 'streak' && x.textId.startsWith('5 hari'))));
check('maks 5 insight, warn dulu', () => {
  const now = [...history(), tx(addWibDays(WEEK, 0), 400_000, 'resto'), tx(addWibDays(WEEK, 1), 300_000, 'resto')];
  for (let d = 0; d < 5; d++) now.push(tx(addWibDays(WEEK, d), 30_000, 'kopi', 'MAKANAN', 19));
  const h = buildWeeklyHabits({ ...base, txs: now, streakUnder: 4, pastiLate: [{ name: 'Gaji', dueDate: WEEK }] });
  assert.ok(h.insights.length <= 5);
  const ranks = h.insights.map((x) => ({ warn: 0, good: 1, info: 2 })[x.tone]);
  assert.deepStrictEqual(ranks, [...ranks].sort((a, b) => a - b));
});
check('teks EN tersedia', () => assert.ok(buildWeeklyHabits({ ...base, streakUnder: 3 }).insights.every((x) => x.textEn.length > 0)));

console.log('incomeBaseline');
const periods = [3, 2, 1].map((w) => ({ start: addWibDays(WEEK, -7 * w), end: addWibDays(WEEK, -7 * (w - 1)) }));
const current = { start: WEEK, end: addWibDays(WEEK, 7) };
const inc = (d: Date, amount: number, pasti = true): HabitIncome => ({ amount, receivedAt: new Date(d.getTime() + 9 * 3600_000), pasti });
check('median pasti & tambahan per periode, hari biasa masuk', () => {
  const rows = [
    inc(periods[0].start, 600_000), inc(periods[1].start, 550_000), inc(periods[2].start, 600_000),
    inc(addWibDays(periods[1].start, 3), 200_000, false), inc(WEEK, 600_000), inc(addWibDays(WEEK, 2), 300_000, false),
  ];
  const b = incomeBaseline(rows, periods, current, null);
  assert.deepStrictEqual([b.periodsObserved, b.usualPasti, b.usualTambahan, b.usualTotal, b.typicalDow], [3, 600_000, 0, 600_000, 1]);
  assert.deepStrictEqual(b.thisPeriod, { total: 900_000, pasti: 600_000, tambahan: 300_000 });
});
check('riwayat < 3 periode → belum ada "biasanya"', () => assert.strictEqual(incomeBaseline([], periods, current, periods[1].start).usualTotal, null));
check('pemasukan di atas biasanya → good insight', () => {
  const rows = periods.map((p) => inc(p.start, 600_000)).concat([inc(WEEK, 600_000), inc(addWibDays(WEEK, 2), 300_000, false)]);
  const h = buildWeeklyHabits({ ...base, income: incomeBaseline(rows, periods, current, null) });
  assert.ok(h.insights.some((x) => x.id === 'income-up'), JSON.stringify(h.insights));
});

console.log(`\n${passed} lulus, ${failed} gagal`);
if (failed) process.exit(1);
