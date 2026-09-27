/**
 * period-stats.check.ts — self-check fungsi murni PeriodStats (E06-S1), data sintetis (tanpa DB).
 * Jalankan: npx ts-node src/modules/analytics/period-stats.check.ts
 */
import * as assert from 'assert';
import {
  computeBudgetAdherence,
  isAnomaly,
  isBigPurchase,
  median,
  percentile,
  previousPeriod,
  savingsRate,
  timeBucket,
} from './period-stats.util';

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

console.log('\n── median & percentile ──');

check('median ganjil', () => assert.strictEqual(median([10, 5, 20]), 10));
check('median genap = rata-rata dua tengah', () => assert.strictEqual(median([10, 20, 30, 40]), 25));
check('median array kosong = 0', () => assert.strictEqual(median([]), 0));
check('percentile 90 dari 10 angka', () => assert.strictEqual(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9.1));

console.log('\n── isBigPurchase: pembelian besar terpisah dari rutin ──');

check('amount >= max(300rb, 5x median) → besar', () => {
  assert.strictEqual(isBigPurchase(1_600_000, 50_000, null), true); // 5x50rb=250rb tapi floor 300rb, 1.6jt > keduanya
});
check('amount pas di bawah ambang → rutin', () => {
  assert.strictEqual(isBigPurchase(299_000, 10_000, null), false);
});
check('median tinggi: 1jt < 5x300rb(1.5jt) → rutin', () => {
  assert.strictEqual(isBigPurchase(1_000_000, 300_000, null), false);
});
check('override eksplisit menang atas aturan otomatis', () => {
  assert.strictEqual(isBigPurchase(10_000, 10_000, true), true);
  assert.strictEqual(isBigPurchase(10_000_000, 10_000, false), false);
});

console.log('\n── timeBucket (WIB) ──');

check('05-10 → pagi, 11-14 → siang, 15-17 → sore, 18-21 → malam, 22-04 → larut', () => {
  assert.strictEqual(timeBucket(6), 'pagi');
  assert.strictEqual(timeBucket(12), 'siang');
  assert.strictEqual(timeBucket(16), 'sore');
  assert.strictEqual(timeBucket(20), 'malam');
  assert.strictEqual(timeBucket(23), 'larut');
  assert.strictEqual(timeBucket(2), 'larut');
});

console.log('\n── savingsRate ──');

check('income 0 → null (bukan divide by zero)', () => assert.strictEqual(savingsRate(0, -50_000), null));
check('savings rate positif', () => assert.strictEqual(savingsRate(1_000_000, 300_000), 30));

console.log('\n── isAnomaly ──');

check('rutin 3x median kategori → anomali', () => {
  const r = isAnomaly({ amount: 350_000, categoryMedian: 100_000, isNewMerchant: false, p90AllTransactions: 500_000 });
  assert.strictEqual(r.anomaly, true);
});
check('merchant baru dengan nominal > p90 → anomali', () => {
  const r = isAnomaly({ amount: 600_000, categoryMedian: 0, isNewMerchant: true, p90AllTransactions: 500_000 });
  assert.strictEqual(r.anomaly, true);
});
check('merchant lama, nominal wajar → bukan anomali', () => {
  const r = isAnomaly({ amount: 150_000, categoryMedian: 100_000, isNewMerchant: false, p90AllTransactions: 500_000 });
  assert.strictEqual(r.anomaly, false);
  assert.strictEqual(r.reason, null);
});

console.log('\n── computeBudgetAdherence ──');

check('hari tanpa budget (0) tidak ikut dihitung', () => {
  const r = computeBudgetAdherence([
    { spend: 100_000, budget: 0 }, // weekend, tidak dihitung
    { spend: 30_000, budget: 50_000 }, // under
    { spend: 60_000, budget: 50_000 }, // over
  ]);
  assert.strictEqual(r.daysWithBudget, 2);
  assert.strictEqual(r.daysOver, 1);
  assert.strictEqual(r.adherencePct, 50);
});
check('streakUnder berhenti begitu ketemu hari over budget (mundur dari akhir)', () => {
  const r = computeBudgetAdherence([
    { spend: 60_000, budget: 50_000 }, // over (lama)
    { spend: 30_000, budget: 50_000 }, // under
    { spend: 20_000, budget: 50_000 }, // under (terbaru)
  ]);
  assert.strictEqual(r.streakUnder, 2);
});
check('streak berhenti di hari tanpa budget', () => {
  const r = computeBudgetAdherence([
    { spend: 20_000, budget: 50_000 },
    { spend: 10_000, budget: 0 },
  ]);
  assert.strictEqual(r.streakUnder, 0);
});
check('tidak ada hari berbudget sama sekali → adherencePct null', () => {
  const r = computeBudgetAdherence([{ spend: 100_000, budget: 0 }]);
  assert.strictEqual(r.adherencePct, null);
});

console.log('\n── previousPeriod: pembanding periode sama panjang ──');

check('periode 7 hari → pembanding 7 hari sebelumnya', () => {
  const start = new Date('2026-09-21T00:00:00+07:00');
  const end = new Date('2026-09-28T00:00:00+07:00');
  const prev = previousPeriod(start, end, new Date('2026-01-01T00:00:00+07:00'));
  assert.ok(prev);
  assert.strictEqual(prev!.start.toISOString(), new Date('2026-09-14T00:00:00+07:00').toISOString());
  assert.strictEqual(prev!.end.toISOString(), start.toISOString());
});
check('pembanding yang jatuh sebelum dataStartsAt → null (jangan tampilkan +100% palsu)', () => {
  const start = new Date('2026-09-21T00:00:00+07:00');
  const end = new Date('2026-09-28T00:00:00+07:00');
  const prev = previousPeriod(start, end, new Date('2026-09-15T00:00:00+07:00'));
  assert.strictEqual(prev, null);
});
check('dataStartsAt null (belum ada transaksi) → tetap ada pembanding', () => {
  const start = new Date('2026-09-21T00:00:00+07:00');
  const end = new Date('2026-09-28T00:00:00+07:00');
  assert.ok(previousPeriod(start, end, null));
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
