import { BillingCycle } from '@prisma/client';

// `nextDueDate` itu kolom @db.Date (tengah malam UTC untuk tanggal kalendernya), jadi semua hitungan di sini
// memakai kunci tanggal 'YYYY-MM-DD' — bukan instant WIB (lihat gotcha @db.Date di CLAUDE.md).
const key = (d: Date) => d.toISOString().slice(0, 10);
const nextKey = (k: string) => key(new Date(Date.parse(`${k}T00:00:00Z`) + 86_400_000));

/** Jatuh tempo pertama ≥ `fromKey` untuk langganan berulang yang tanggal tersimpannya `due`.
 *  Bulan pendek di-clamp ke hari terakhir (tgl 31 → 28/29/30 Feb dst).
 *  ponytail: hari jangkar = hari dari `due` yang tersimpan; setelah tersimpan sebagai 28 Feb, jangkar ikut jadi 28. */
export function rollDueDate(due: Date, cycle: BillingCycle, fromKey: string): Date {
  const [y, m, d] = key(due).split('-').map(Number);
  const step = cycle === BillingCycle.YEARLY ? 12 : 1;
  for (let n = 0; ; n += step) {
    const mm = m - 1 + n;
    const yy = y + Math.floor(mm / 12);
    const mo = mm % 12;
    const last = new Date(Date.UTC(yy, mo + 1, 0)).getUTCDate();
    const cand = new Date(Date.UTC(yy, mo, Math.min(d, last)));
    if (key(cand) >= fromKey) return cand;
  }
}

/** Semua tanggal jatuh tempo di [fromKey, toKey). */
export function dueDatesBetween(due: Date, cycle: BillingCycle, fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let d = key(rollDueDate(due, cycle, fromKey)); d < toKey; d = key(rollDueDate(due, cycle, nextKey(d)))) out.push(d);
  return out;
}

/** Total tagihan langganan yang jatuh tempo di [fromKey, toKey) — tiap kemunculan dihitung (rentang > 1 bulan = bisa 2×). */
export function commitmentsBetween(
  subs: { amount: unknown; cycle: BillingCycle; nextDueDate: Date }[],
  fromKey: string,
  toKey: string,
): number {
  return subs.reduce((s, x) => s + Number(x.amount) * dueDatesBetween(x.nextDueDate, x.cycle, fromKey, toKey).length, 0);
}
