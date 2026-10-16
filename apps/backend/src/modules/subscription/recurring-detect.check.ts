/**
 * recurring-detect.check.ts — saran langganan dari tagihan berulang.
 * Jalankan: npx ts-node --transpile-only src/modules/subscription/recurring-detect.check.ts
 */
import * as assert from 'assert';
import { detectRecurring, RecurringTx } from './recurring-detect';

const TODAY = '2026-10-16';
// 10:00 WIB pada tanggal itu.
const at = (k: string) => new Date(`${k}T10:00:00+07:00`);
const tx = (description: string, amount: number, k: string, extra: Partial<RecurringTx> = {}): RecurringTx => ({
  description, displayName: description, merchantKey: null, amount, occurredAt: at(k), source: 'BCA', ...extra,
});

const txs: RecurringTx[] = [
  // Netflix: 4× bulanan, nominal sama → disarankan.
  tx('NETFLIX.COM', 186000, '2026-07-05'), tx('NETFLIX.COM', 186000, '2026-08-05'), tx('NETFLIX.COM', 186000, '2026-09-05'), tx('NETFLIX.COM', 186000, '2026-10-05'),
  // Kos: transfer bulanan, tanggal bergeser (gajian telat) → tetap bulanan.
  tx('IBU SITI KOS', 1500000, '2026-08-01'), tx('IBU SITI KOS', 1500000, '2026-08-30'), tx('IBU SITI KOS', 1500000, '2026-10-02'),
  // Kopi: sering tapi tidak bulanan → bukan langganan.
  ...['2026-09-01', '2026-09-03', '2026-09-10', '2026-09-20', '2026-10-01', '2026-10-12'].map((d) => tx('KOPI KENANGAN 1320', 25000, d)),
  // Indomaret bulanan tapi nominal liar → bukan.
  tx('INDOMARET', 120000, '2026-08-10'), tx('INDOMARET', 310000, '2026-09-10'), tx('INDOMARET', 95000, '2026-10-10'),
  // Spotify sudah berhenti (terakhir > 40 hari) → bukan.
  tx('SPOTIFY', 54990, '2026-05-20'), tx('SPOTIFY', 54990, '2026-06-20'), tx('SPOTIFY', 54990, '2026-07-20'),
  // Hanya 2 tagihan → belum cukup bukti.
  tx('YOUTUBE PREMIUM', 59000, '2026-09-08'), tx('YOUTUBE PREMIUM', 59000, '2026-10-08'),
  // Sudah ada di daftar langganan (nama cocok) → tidak disarankan lagi.
  tx('GOOGLE ONE', 26900, '2026-08-12'), tx('GOOGLE ONE', 26900, '2026-09-12'), tx('GOOGLE ONE', 26900, '2026-10-12'),
  // Lama tidak teratur, lalu 3 bulan terakhir rutin → yang dipakai rangkaian terbaru. Pakai alias + merchantKey.
  tx('BIZNET 1', 350000, '2026-01-03', { merchantKey: 'biznet', displayName: 'Internet rumah' }),
  tx('BIZNET 2', 380000, '2026-07-15', { merchantKey: 'biznet', displayName: 'Internet rumah' }),
  tx('BIZNET 3', 380000, '2026-08-15', { merchantKey: 'biznet', displayName: 'Internet rumah' }),
  tx('BIZNET 4', 380000, '2026-09-15', { merchantKey: 'biznet', displayName: 'Internet rumah', source: 'JAGO' }),
  tx('BIZNET 5', 0, '2026-10-01', { merchantKey: 'biznet' }), // nominal 0 diabaikan
];

const got = detectRecurring(txs, [{ name: 'Google One', amount: 26900 }], TODAY);
const names = got.map((g) => g.name);
assert.deepStrictEqual(names, ['IBU SITI KOS', 'Internet rumah', 'NETFLIX.COM'], JSON.stringify(got, null, 1));

const kos = got[0];
assert.strictEqual(kos.amount, 1500000);
assert.strictEqual(kos.count, 3);
assert.strictEqual(kos.lastDate, '2026-10-02');
assert.strictEqual(kos.nextDueDate, '2026-11-02');

const net = got.find((g) => g.name === 'Internet rumah')!;
assert.strictEqual(net.count, 3, 'rangkaian terbaru saja (Jan tidak ikut)');
assert.strictEqual(net.nextDueDate, '2026-11-15', 'sebulan setelah 15 Sep = 15 Okt, sudah lewat → digulir ke 15 Nov');
assert.strictEqual(net.source, 'JAGO');

const nf = got.find((g) => g.name === 'NETFLIX.COM')!;
assert.strictEqual(nf.nextDueDate, '2026-11-05');
assert.strictEqual(nf.count, 4);

// Duplikat lewat nominal (nama beda) juga disaring.
assert.ok(!detectRecurring(txs, [{ name: 'Langganan film', amount: 186000 }], TODAY).some((g) => g.name === 'NETFLIX.COM'));
assert.deepStrictEqual(detectRecurring([], [], TODAY), []);

console.log('recurring-detect.check: OK');
