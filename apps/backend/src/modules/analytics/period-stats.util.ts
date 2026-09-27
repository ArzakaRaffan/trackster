/** Fungsi murni dipakai PeriodStatsService — dipisah biar bisa dites tanpa DB (period-stats.check.ts). */

export type TimeBucket = 'pagi' | 'siang' | 'sore' | 'malam' | 'larut';

export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** p-th percentile (0-100), interpolasi linear sederhana. */
export function percentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Ambang pembelian besar: max(300rb, 5x median nominal transaksi 90 hari). `override` (kolom
 * `Transaction.isBig`) menang kalau diisi user lewat tombol "Tandai rutin/besar". */
export function isBigPurchase(amount: number, medianAmount90d: number, override: boolean | null): boolean {
  if (override != null) return override;
  return amount >= Math.max(300_000, 5 * medianAmount90d);
}

/** Bucket waktu WIB: pagi 05-11, siang 11-15, sore 15-18, malam 18-22, larut 22-05. */
export function timeBucket(hourWib: number): TimeBucket {
  if (hourWib >= 5 && hourWib < 11) return 'pagi';
  if (hourWib >= 11 && hourWib < 15) return 'siang';
  if (hourWib >= 15 && hourWib < 18) return 'sore';
  if (hourWib >= 18 && hourWib < 22) return 'malam';
  return 'larut';
}

export function savingsRate(income: number, net: number): number | null {
  if (income <= 0) return null;
  return (net / income) * 100;
}

/** Anomali: transaksi rutin (bukan besar) yang nominalnya > 3x median kategorinya (90 hari),
 * atau merchant yang belum pernah muncul sebelumnya dengan nominal > p90 semua transaksi. */
export function isAnomaly(params: {
  amount: number;
  categoryMedian: number;
  isNewMerchant: boolean;
  p90AllTransactions: number;
}): { anomaly: boolean; reason: string | null } {
  const { amount, categoryMedian, isNewMerchant, p90AllTransactions } = params;
  if (categoryMedian > 0 && amount > 3 * categoryMedian) {
    return { anomaly: true, reason: `${Math.round(amount / categoryMedian)}x median kategori ini` };
  }
  if (isNewMerchant && amount > p90AllTransactions) {
    return { anomaly: true, reason: 'merchant baru dengan nominal besar' };
  }
  return { anomaly: false, reason: null };
}

export interface DayBudgetPoint {
  spend: number;
  budget: number;
}

/** Kepatuhan budget: cuma hitung hari dengan budget > 0. Streak = jalan hari berturut-turut
 * (dari yang terakhir mundur) yang under budget, berhenti begitu ketemu hari over ATAU tanpa budget. */
export function computeBudgetAdherence(daysChronological: DayBudgetPoint[]): {
  daysWithBudget: number;
  daysOver: number;
  adherencePct: number | null;
  streakUnder: number;
} {
  const withBudget = daysChronological.filter((d) => d.budget > 0);
  const daysOver = withBudget.filter((d) => d.spend > d.budget).length;
  const adherencePct = withBudget.length > 0 ? ((withBudget.length - daysOver) / withBudget.length) * 100 : null;

  let streakUnder = 0;
  for (let i = daysChronological.length - 1; i >= 0; i--) {
    const d = daysChronological[i];
    if (d.budget <= 0) break;
    if (d.spend > d.budget) break;
    streakUnder++;
  }

  return { daysWithBudget: withBudget.length, daysOver, adherencePct, streakUnder };
}

/** Periode pembanding: sama panjang, langsung sebelum `start`. Kalau bagian mana pun dari periode
 * itu jatuh sebelum `dataStartsAt`, dianggap tidak ada pembanding (hindari lonjakan "+100%" palsu). */
export function previousPeriod(start: Date, end: Date, dataStartsAt: Date | null): { start: Date; end: Date } | null {
  const lengthMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - lengthMs);
  const prevEnd = start;
  if (dataStartsAt && prevStart.getTime() < dataStartsAt.getTime()) return null;
  return { start: prevStart, end: prevEnd };
}
