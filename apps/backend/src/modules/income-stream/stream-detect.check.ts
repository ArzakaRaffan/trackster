/**
 * stream-detect.check.ts — saran sumber pemasukan dari uang masuk rutin.
 * Jalankan: npx ts-node --transpile-only src/modules/income-stream/stream-detect.check.ts
 */
import * as assert from 'assert';
import { detectIncomeStreams, DetectIncome } from './stream-detect';

const TODAY = '2026-10-16';
const inc = (description: string, amount: number, k: string, source: any = 'BCA'): DetectIncome => ({
  description, amount, receivedAt: new Date(`${k}T09:00:00+07:00`), source,
});

const list: DetectIncome[] = [
  // Gaji bulanan tgl 25 (sekali maju ke 24 karena akhir pekan) → FIXED, tgl 25.
  inc('PT MAJU JAYA', 5000000, '2026-06-25'), inc('PT MAJU JAYA', 5000000, '2026-07-24'), inc('PT MAJU JAYA', 5000000, '2026-08-25'), inc('PT MAJU JAYA', 5000000, '2026-09-25'),
  // Uang saku mingguan tiap Senin dari ortu → FIXED, mingguan Senin (1).
  ...['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'].map((d) => inc('BUDI SANTOSO', 500000, d, 'JAGO')),
  // Ruangguru bulanan, nominal beda-beda → VARIABLE, median.
  inc('RUANGGURU', 1200000, '2026-07-10'), inc('RUANGGURU', 1800000, '2026-08-11'), inc('RUANGGURU', 1500000, '2026-09-10'), inc('RUANGGURU', 900000, '2026-10-10'),
  // Transfer sesekali → tidak rutin.
  inc('ANDI PRATAMA', 750000, '2026-08-02'), inc('ANDI PRATAMA', 150000, '2026-09-29'),
  // Sudah ada sumbernya (matchKeywords) → tidak disarankan.
  ...['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].map((d) => inc('LES PRIVAT IBU RINA', 300000, d)),
  // Berhenti (terakhir > 45 hari) → tidak.
  inc('PT LAMA', 4000000, '2026-04-25'), inc('PT LAMA', 4000000, '2026-05-25'), inc('PT LAMA', 4000000, '2026-06-25'),
];

const got = detectIncomeStreams(list, [{ name: 'Les privat', matchKeywords: ['IBU RINA'] }], TODAY);
assert.deepStrictEqual(got.map((g) => g.name), ['PT MAJU JAYA', 'RUANGGURU', 'BUDI SANTOSO'], JSON.stringify(got, null, 1));

const gaji = got[0];
assert.strictEqual(gaji.cadence, 'MONTHLY');
assert.strictEqual(gaji.kind, 'FIXED');
assert.strictEqual(gaji.payDayOfMonth, 25);
assert.strictEqual(gaji.payDayOfWeek, null);
assert.strictEqual(gaji.amount, 5000000);
assert.strictEqual(gaji.count, 4);
assert.strictEqual(gaji.keyword, 'PT MAJU JAYA');

const rg = got[1];
assert.strictEqual(rg.kind, 'VARIABLE');
assert.strictEqual(rg.amount, 1350000, 'median 900rb/1,2jt/1,5jt/1,8jt');
assert.strictEqual(rg.payDayOfMonth, 10);

const saku = got[2];
assert.strictEqual(saku.cadence, 'WEEKLY');
assert.strictEqual(saku.payDayOfWeek, 1, 'Senin');
assert.strictEqual(saku.source, 'JAGO');

// Nama sumber yang mirip juga menyaring.
assert.ok(!detectIncomeStreams(list, [{ name: 'PT Maju Jaya', matchKeywords: [] }], TODAY).some((g) => g.name === 'PT MAJU JAYA'));
// Sumber lain berawalan sama ("PT") tidak ikut menyaring.
assert.ok(detectIncomeStreams(list, [{ name: 'PT Lain', matchKeywords: [] }], TODAY).some((g) => g.name === 'PT MAJU JAYA'));
assert.deepStrictEqual(detectIncomeStreams([], [], TODAY), []);

console.log('stream-detect.check: OK');
