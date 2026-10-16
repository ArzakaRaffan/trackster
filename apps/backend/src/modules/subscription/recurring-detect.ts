import { BillingCycle } from '@prisma/client';
import { merchantKey } from '../../common/merchant-key';
import { rollDueDate } from './subscription-due';

// Deteksi tagihan berulang dari riwayat transaksi → saran langganan (user yang memutuskan; tidak dibuat otomatis).
// Pola: ≥3 tagihan berturut-turut di merchant yang sama, jarak tiap tagihan 25–35 hari, nominal stabil (±10%),
// dan tagihan terakhir masih baru (≤ 40 hari). ponytail: hanya bulanan; tambah tahunan/mingguan kalau ada kasusnya.

export type RecurringTx = { description: string; displayName: string; merchantKey: string | null; amount: number; occurredAt: Date; source: string };
export type RecurringSuggestion = {
  key: string;
  name: string;
  amount: number;
  cycle: BillingCycle;
  nextDueDate: string;
  lastDate: string;
  count: number;
  source: string;
};

const DAY = 86_400_000;
const GAP_MIN = 25;
const GAP_MAX = 35;
const STALE_DAYS = 40;
const AMOUNT_TOL = 0.1;
// Kunci tanggal kalender WIB (transaksi disimpan sebagai instant).
const wibKey = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const keyDate = (k: string) => new Date(`${k}T00:00:00Z`);

/** Panjang rangkaian berturut-turut di ujung terbaru `days` (kunci tanggal terurut) yang jaraknya [gapMin, gapMax] hari.
 *  Dipakai juga deteksi pemasukan rutin (income-stream/stream-detect.ts). */
export function recentRun(days: string[], gapMin: number, gapMax: number): number {
  let run = days.length ? 1 : 0;
  for (let i = days.length - 1; i > 0; i--) {
    const gap = (keyDate(days[i]).getTime() - keyDate(days[i - 1]).getTime()) / DAY;
    if (gap < gapMin || gap > gapMax) break;
    run++;
  }
  return run;
}

export function detectRecurring(
  txs: RecurringTx[],
  existing: { name: string; amount: unknown }[],
  todayKey: string,
): RecurringSuggestion[] {
  const groups = new Map<string, RecurringTx[]>();
  for (const t of txs) {
    if (t.amount <= 0) continue;
    const k = t.merchantKey || merchantKey(t.description);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const taken = existing.map((s) => ({ key: merchantKey(s.name), amount: Number(s.amount) }));
  const out: RecurringSuggestion[] = [];

  for (const [key, list] of groups) {
    // Satu tagihan per hari (dobel debit / pecahan di hari sama dijumlah).
    const byDay = new Map<string, number>();
    for (const t of list) byDay.set(wibKey(t.occurredAt), (byDay.get(wibKey(t.occurredAt)) ?? 0) + t.amount);
    const days = [...byDay.keys()].sort();
    if (days.length < 3) continue;

    const run = recentRun(days, GAP_MIN, GAP_MAX);
    if (run < 3) continue;
    const runDays = days.slice(-run);
    const amounts = runDays.map((d) => byDay.get(d)!);
    if (Math.max(...amounts) > Math.min(...amounts) * (1 + AMOUNT_TOL)) continue;

    const lastDate = runDays[runDays.length - 1];
    if ((keyDate(todayKey).getTime() - keyDate(lastDate).getTime()) / DAY > STALE_DAYS) continue;

    const amount = Math.round(amounts[amounts.length - 1]);
    const first = key.split(' ')[0];
    const dup = taken.some((s) => (s.key && s.key.split(' ')[0] === first) || Math.abs(s.amount - amount) <= amount * 0.02);
    if (dup) continue;

    const latest = list.filter((t) => wibKey(t.occurredAt) === lastDate).pop()!;
    // Jatuh tempo berikutnya = sebulan setelah tagihan terakhir, digulir ke ≥ hari ini kalau sudah lewat.
    const next = rollDueDate(rollDueDate(keyDate(lastDate), BillingCycle.MONTHLY, wibKey(new Date(keyDate(lastDate).getTime() + DAY))), BillingCycle.MONTHLY, todayKey);
    out.push({
      key,
      name: latest.displayName || latest.description,
      amount,
      cycle: BillingCycle.MONTHLY,
      nextDueDate: next.toISOString().slice(0, 10),
      lastDate,
      count: run,
      source: latest.source,
    });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 5);
}
