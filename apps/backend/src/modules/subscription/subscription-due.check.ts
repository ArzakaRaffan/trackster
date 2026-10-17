/**
 * subscription-due.check.ts — jatuh tempo langganan bergulir.
 * Jalankan: npx ts-node --transpile-only src/modules/subscription/subscription-due.check.ts
 */
import * as assert from 'assert';
import { BillingCycle } from '@prisma/client';
import { commitmentsBetween, dueDatesBetween, rollDueDate } from './subscription-due';

const D = (k: string) => new Date(`${k}T00:00:00Z`);
const k = (d: Date) => d.toISOString().slice(0, 10);
const { MONTHLY, YEARLY } = BillingCycle;

// Belum lewat → tetap.
assert.strictEqual(k(rollDueDate(D('2026-10-20'), MONTHLY, '2026-10-16')), '2026-10-20');
assert.strictEqual(k(rollDueDate(D('2026-10-16'), MONTHLY, '2026-10-16')), '2026-10-16', 'jatuh tempo hari ini tidak digulir');
// Lewat → bulan berikutnya, lewat jauh → beberapa bulan sekaligus.
assert.strictEqual(k(rollDueDate(D('2026-10-05'), MONTHLY, '2026-10-16')), '2026-11-05');
assert.strictEqual(k(rollDueDate(D('2026-06-05'), MONTHLY, '2026-10-16')), '2026-11-05');
// Tutup tahun.
assert.strictEqual(k(rollDueDate(D('2026-12-10'), MONTHLY, '2026-12-11')), '2027-01-10');
// Tanggal 31 di-clamp, dan dihitung dari jangkar asli (Mar tetap 31, bukan 28).
assert.strictEqual(k(rollDueDate(D('2027-01-31'), MONTHLY, '2027-02-01')), '2027-02-28');
assert.strictEqual(k(rollDueDate(D('2027-01-31'), MONTHLY, '2027-03-01')), '2027-03-31');
assert.strictEqual(k(rollDueDate(D('2028-01-31'), MONTHLY, '2028-02-01')), '2028-02-29', 'kabisat');
// Tahunan.
assert.strictEqual(k(rollDueDate(D('2025-03-01'), YEARLY, '2026-10-16')), '2027-03-01');
assert.strictEqual(k(rollDueDate(D('2024-02-29'), YEARLY, '2025-01-01')), '2025-02-28');

// Rentang.
assert.deepStrictEqual(dueDatesBetween(D('2026-09-25'), MONTHLY, '2026-10-16', '2026-11-15'), ['2026-10-25']);
assert.deepStrictEqual(dueDatesBetween(D('2026-09-25'), MONTHLY, '2026-10-16', '2026-12-26'), ['2026-10-25', '2026-11-25', '2026-12-25']);
assert.deepStrictEqual(dueDatesBetween(D('2026-10-25'), MONTHLY, '2026-10-16', '2026-10-25'), [], 'batas akhir eksklusif');
assert.deepStrictEqual(dueDatesBetween(D('2026-12-01'), MONTHLY, '2026-10-16', '2026-11-15'), [], 'tanggal tersimpan di masa depan dihormati');
assert.deepStrictEqual(dueDatesBetween(D('2026-03-01'), YEARLY, '2026-10-16', '2026-11-15'), []);

const subs = [
  { amount: '54000', cycle: MONTHLY, nextDueDate: D('2026-08-20') }, // basi 2 bulan → 20 Okt
  { amount: 120000, cycle: YEARLY, nextDueDate: D('2026-11-01') },
  { amount: 30000, cycle: MONTHLY, nextDueDate: D('2026-10-10') }, // sudah lewat bulan ini → 10 Nov, di luar rentang
];
assert.strictEqual(commitmentsBetween(subs, '2026-10-16', '2026-11-05'), 174000);
assert.strictEqual(commitmentsBetween(subs, '2026-10-16', '2026-11-16'), 204000);
assert.strictEqual(commitmentsBetween([], '2026-10-16', '2026-11-16'), 0);

console.log('subscription-due.check: OK');
