/** Engine budget periode — pure functions, tanpa DB. Desain: docs/budget-kebiasaan.md.
 * Periode mingguan (mulai hari X) / bulanan (mulai tanggal X). Budget periode = pemasukan pasti (kebiasaan) + tambahan yang
 * sudah masuk − disisihkan (basis INCOME), atau angka yang ditentukan user (basis TARGET). Jatah hari ini = sisa ÷ sisa hari,
 * berbobot hari-dalam-minggu, beku terhadap belanja hari ini. */
import { addWibDays, startOfWibDay, startOfWibMonth, wibDayOfWeek, wibParts } from '../../common/wib';

const DAY_MS = 86_400_000;

export type BudgetOption = 'hemat' | 'seimbang' | 'longgar';
export const BUDGET_OPTIONS: BudgetOption[] = ['hemat', 'seimbang', 'longgar'];
/** Basis INCOME: bagian pemasukan yang disisihkan (%) per gaya. */
export const RESERVE_PCT: Record<BudgetOption, number> = { hemat: 15, seimbang: 10, longgar: 5 };
/** Basis TARGET: target = belanja rutin biasanya × faktor. */
export const TARGET_FACTOR: Record<BudgetOption, number> = { hemat: 0.85, seimbang: 1, longgar: 1.1 };

export function round500(n: number): number {
  return Math.round(n / 500) * 500;
}

export interface AnchorSchedule {
  cadence: 'WEEKLY' | 'MONTHLY';
  payDayOfWeek?: number | null; // WEEKLY: 0=Min..6=Sab
  payDayOfMonth?: number | null; // MONTHLY: 1..31 (di-clamp ke akhir bulan)
}

/** Gaji boleh masuk sedini ini sebelum payday dan tetap dianggap membuka periode baru. */
const EARLY_PAY_DAYS = { WEEKLY: 2, MONTHLY: 7 } as const;

function paydayInMonth(year: number, month: number, day: number): Date {
  const start = startOfWibMonth(year, month);
  const next = month === 12 ? startOfWibMonth(year + 1, 1) : startOfWibMonth(year, month + 1);
  const daysInMonth = Math.round((next.getTime() - start.getTime()) / DAY_MS);
  return addWibDays(start, Math.min(day, daysInMonth) - 1);
}

/** Payday terjadwal pertama yang > `after` (instant 00:00 WIB). */
function nextPayday(anchor: AnchorSchedule, after: Date): Date {
  if (anchor.cadence === 'WEEKLY') {
    const diff = ((anchor.payDayOfWeek ?? 1) - wibDayOfWeek(after) + 7) % 7 || 7;
    return addWibDays(startOfWibDay(after), diff);
  }
  const { year, month } = wibParts(after);
  const day = anchor.payDayOfMonth ?? 1;
  const thisMonth = paydayInMonth(year, month, day);
  if (thisMonth.getTime() > after.getTime()) return thisMonth;
  return month === 12 ? paydayInMonth(year + 1, 1, day) : paydayInMonth(year, month + 1, day);
}

/** Payday terjadwal terakhir yang <= hari ini. */
function lastPayday(anchor: AnchorSchedule, now: Date): Date {
  const today = startOfWibDay(now);
  if (anchor.cadence === 'WEEKLY') {
    return addWibDays(today, -((wibDayOfWeek(today) - (anchor.payDayOfWeek ?? 1) + 7) % 7));
  }
  const { year, month } = wibParts(today);
  const day = anchor.payDayOfMonth ?? 1;
  const thisMonth = paydayInMonth(year, month, day);
  if (thisMonth.getTime() <= today.getTime()) return thisMonth;
  return month === 1 ? paydayInMonth(year - 1, 12, day) : paydayInMonth(year, month - 1, day);
}

/** Batas periode berjalan [start, end). `lastAnchorReceivedAt` = kapan pemasukan pasti utama terakhir diterima;
 * kalau masuk ≤ EARLY_PAY_DAYS sebelum payday berikutnya, periode baru dimulai hari itu. */
export function cycleBounds(
  anchor: AnchorSchedule,
  now: Date,
  lastAnchorReceivedAt?: Date | null,
): { start: Date; end: Date } {
  const start = lastPayday(anchor, now);
  const end = nextPayday(anchor, start);
  const r = lastAnchorReceivedAt?.getTime();
  if (r === undefined || r > now.getTime()) return { start, end };
  const early = EARLY_PAY_DAYS[anchor.cadence];
  // Gaji periode berikutnya sudah masuk lebih awal → periode baru mulai hari itu.
  if (r >= addWibDays(end, -early).getTime()) return { start: startOfWibDay(lastAnchorReceivedAt!), end: nextPayday(anchor, end) };
  // Gaji periode ini dulu masuk lebih awal → periode ini mulai dari hari diterima, bukan dari payday.
  if (r < start.getTime() && r >= addWibDays(start, -early).getTime()) return { start: startOfWibDay(lastAnchorReceivedAt!), end };
  return { start, end };
}

/** `n` periode terjadwal sebelum `start`, lama → baru (tanpa koreksi gaji lebih awal). */
export function previousPeriods(schedule: AnchorSchedule, start: Date, n: number): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  let end = startOfWibDay(start);
  for (let k = 0; k < n; k++) {
    const b = cycleBounds(schedule, new Date(end.getTime() - 1));
    out.unshift({ start: b.start, end });
    end = b.start;
  }
  return out;
}

/** Periode budget (`BudgetSetting.period`/`periodDay`) sebagai jadwal: mingguan = hari mulai, bulanan = tanggal mulai. */
export function periodSchedule(period: 'WEEKLY' | 'MONTHLY', day: number): AnchorSchedule {
  return period === 'WEEKLY' ? { cadence: 'WEEKLY', payDayOfWeek: day } : { cadence: 'MONTHLY', payDayOfMonth: day };
}

/** Tanggal-tanggal payday `schedule` di [start, end). */
export function paydayDates(schedule: AnchorSchedule, start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let d = nextPayday(schedule, addWibDays(startOfWibDay(start), -1)); d.getTime() < end.getTime(); d = nextPayday(schedule, d)) out.push(d);
  return out;
}

/** Berapa kali payday `schedule` jatuh di [start, end). */
export const paydaysIn = (schedule: AnchorSchedule, start: Date, end: Date) => paydayDates(schedule, start, end).length;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Minimal pembayaran sebelum nominal "biasanya" dipelajari dari riwayat (keputusan Arzaka 2026-10-30). */
export const USUAL_MIN_SAMPLES = 3;

/** Nominal biasa satu pemasukan pasti: median ≤6 pembayaran terakhir (terbaru dulu) kalau sudah ≥3, selain itu angka
 * yang diisi user. `learned` = dari kebiasaan. */
export function usualAmount(recentPayments: number[], declared: number): { amount: number; learned: boolean } {
  const xs = recentPayments.filter((x) => x > 0).slice(0, 6);
  if (xs.length >= USUAL_MIN_SAMPLES) return { amount: Math.round(median(xs)), learned: true };
  return { amount: Math.max(0, Math.round(declared)), learned: false };
}

export interface PastiStream {
  usual: number;
  paydays: number; // payday dalam periode
  received: number; // Σ yang sudah masuk di periode
  receivedCount: number;
}

/** Bagian satu pemasukan pasti di periode: yang sudah masuk + perkiraan untuk payday yang belum masuk.
 * ponytail: pembayaran lebih awal yang jatuh di periode sebelumnya hanya ditangani untuk pemasukan utama (cycleBounds);
 * stream pasti lain yang dibayar sebelum periode dimulai dihitung lagi sebagai perkiraan. */
export function pastiPart(s: PastiStream): { received: number; expected: number } {
  return { received: s.received, expected: s.usual * Math.max(0, s.paydays - s.receivedCount) };
}

/** Bobot 0=Min..6=Sab dari nominal per hari. Kosong / semua 0 → rata. */
export function normalizeWeights(amounts: number[]): number[] {
  const w = [0, 1, 2, 3, 4, 5, 6].map((d) => Math.max(0, amounts[d] ?? 0));
  const total = w.reduce((s, v) => s + v, 0);
  return total > 0 ? w.map((v) => v / total) : w.map(() => 1 / 7);
}

/** Minggu riwayat minimal sebelum bobot hari dipelajari dari kebiasaan belanja. */
export const WEIGHT_MIN_WEEKS = 4;

/** Bobot hari dari rata-rata belanja rutin per hari (index 0=Min). Lantai 40% dari rata-rata supaya hari sepi tidak 0.
 * null = riwayat belum cukup. */
export function learnedWeights(avgRoutineByDow: number[], weeksObserved: number): number[] | null {
  if (weeksObserved < WEIGHT_MIN_WEEKS) return null;
  const avg = avgRoutineByDow.reduce((s, v) => s + v, 0) / 7;
  if (avg <= 0) return null;
  return normalizeWeights(avgRoutineByDow.map((v) => Math.max(v, avg * 0.4)));
}

function weightSum(from: Date, days: number, weights: number[]): number {
  const startDow = wibDayOfWeek(from);
  let sum = 0;
  for (let i = 0; i < days; i++) sum += weights[(startDow + i) % 7];
  return sum;
}

const daysBetween = (a: Date, b: Date) => Math.max(0, Math.round((startOfWibDay(b).getTime() - startOfWibDay(a).getTime()) / DAY_MS));

export interface PeriodAllowanceInput {
  now: Date;
  start: Date;
  end: Date;
  basis: 'INCOME' | 'TARGET';
  pastiReceived: number; // pemasukan pasti yang sudah masuk di periode
  pastiExpected: number; // perkiraan pemasukan pasti yang belum masuk (kebiasaan)
  tambahan: number; // pemasukan tidak pasti yang sudah masuk di periode
  target: number; // basis TARGET
  reservePct: number; // basis INCOME: 0..100
  carry: number; // sisa periode lalu (0 kalau dimatikan)
  commitments: number; // langganan yang jatuh tempo [hari ini, akhir periode)
  spentBeforeToday: number; // belanja [awal periode efektif, awal hari ini)
  weights: number[];
  /** Hari pertama memakai Trackster kalau jatuh di dalam periode → perkiraan & target diprorata. */
  activeFrom?: Date | null;
}

export interface PeriodAllowance {
  allowance: number; // jatah hari ini (beku terhadap belanja hari ini)
  periodBudget: number; // budget periode (setelah prorata, sebelum langganan)
  income: number; // pemasukan periode yang dihitung (basis INCOME)
  reserve: number; // disisihkan
  prorate: number; // 1 = periode penuh
  remaining: number; // sisa yang dibagi mulai hari ini (bisa negatif)
  daysLeft: number; // termasuk hari ini
  deficit: boolean;
}

export function computePeriodAllowance(i: PeriodAllowanceInput): PeriodAllowance {
  const today = startOfWibDay(i.now);
  const start = startOfWibDay(i.start);
  const totalDays = Math.max(1, daysBetween(start, i.end));
  const from = i.activeFrom && startOfWibDay(i.activeFrom).getTime() > start.getTime() ? startOfWibDay(i.activeFrom) : start;
  const fullW = weightSum(start, totalDays, i.weights);
  const prorate = from === start || fullW <= 0 ? 1 : weightSum(from, daysBetween(from, i.end), i.weights) / fullW;

  // Yang sudah benar-benar masuk tidak diprorata — hanya perkiraan & target.
  const income = i.pastiReceived + i.pastiExpected * prorate + i.tambahan;
  const reserve = i.basis === 'INCOME' ? income * (i.reservePct / 100) : 0;
  const base = i.basis === 'INCOME' ? income - reserve : i.target * prorate;
  const periodBudget = Math.round(base + i.carry);
  const remaining = Math.round(periodBudget - i.commitments - i.spentBeforeToday);
  const daysLeft = Math.max(1, daysBetween(today, i.end));
  const sum = weightSum(today, daysLeft, i.weights);
  const allowance = sum > 0 ? round500(Math.max(0, remaining) * (i.weights[wibDayOfWeek(today)] / sum)) : 0;
  return {
    allowance, periodBudget, income: Math.round(income), reserve: Math.round(reserve), prorate,
    remaining, daysLeft, deficit: remaining < 0,
  };
}

export interface StylePreview {
  option: BudgetOption;
  reservePct: number | null; // basis INCOME
  target: number | null; // basis TARGET
  allowance: number;
  periodBudget: number;
}

/** Pratinjau 3 gaya untuk input yang sama. Basis TARGET butuh `usualSpend` (belanja rutin biasanya per periode);
 * tanpa itu → []. */
export function stylePreviews(i: PeriodAllowanceInput, usualSpend: number | null): StylePreview[] {
  if (i.basis === 'TARGET' && !usualSpend) return [];
  return BUDGET_OPTIONS.map((option) => {
    const reservePct = i.basis === 'INCOME' ? RESERVE_PCT[option] : null;
    const target = i.basis === 'TARGET' ? round500(usualSpend! * TARGET_FACTOR[option]) : null;
    const r = computePeriodAllowance({ ...i, reservePct: reservePct ?? i.reservePct, target: target ?? i.target });
    return { option, reservePct, target, allowance: r.allowance, periodBudget: r.periodBudget };
  });
}

/** Gaya yang sedang aktif (null = angka custom). */
export function activeStyle(basis: 'INCOME' | 'TARGET', reservePct: number, target: number, usualSpend: number | null): BudgetOption | null {
  if (basis === 'INCOME') return BUDGET_OPTIONS.find((o) => RESERVE_PCT[o] === reservePct) ?? null;
  if (!usualSpend) return null;
  return BUDGET_OPTIONS.find((o) => round500(usualSpend * TARGET_FACTOR[o]) === round500(target)) ?? null;
}

const DAY_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

/** "minggu ini" / "bulan ini" dan "sampai Senin" / "sampai 25 Nov" untuk teks Telegram & AI. */
export function periodWords(c: { period: 'WEEKLY' | 'MONTHLY'; end: string }): { label: string; until: string } {
  const end = new Date(`${c.end}T00:00:00+07:00`);
  if (c.period === 'WEEKLY') return { label: 'minggu ini', until: `sampai ${DAY_ID[wibDayOfWeek(end)]}` };
  const { day, month } = wibParts(end);
  return { label: 'bulan ini', until: `sampai ${day} ${MONTH_ID[month - 1]}` };
}

/** Satu baris ringkasan periode untuk Telegram: "Sisa budget minggu ini Rp300.000 · 3 hari lagi (sampai Senin)". */
export function periodSummaryText(
  c: { period: 'WEEKLY' | 'MONTHLY'; end: string; remaining: number; daysLeft: number; pastiPending: { name: string }[] },
  spentToday: number,
): string {
  const w = periodWords(c);
  const left = c.remaining - spentToday;
  const head = left >= 0 ? `Sisa budget ${w.label} ${rupiah(left)}` : `Budget ${w.label} lewat ${rupiah(-left)}`;
  const pending = c.pastiPending.length ? ` · ${c.pastiPending.map((p) => p.name).join(', ')} belum masuk` : '';
  return `${head} · ${c.daysLeft} hari lagi (${w.until})${pending}`;
}

export interface BigPurchaseImpact {
  before: number; // jatah per hari ke depan tanpa transaksi ini
  after: number;
  days: number; // hari tersisa setelah hari ini
}

/** Dampak pembelian besar ke jatah hari-hari berikutnya (notifikasi pengganti alert over-budget).
 * null = bukan pembelian besar atau tidak ada hari tersisa. */
export function bigPurchaseImpact(
  summary: { cycle: { remaining: number; daysLeft: number } | null; totalSpent: number; bigThreshold: number | null },
  amount: number,
): BigPurchaseImpact | null {
  const { cycle, bigThreshold } = summary;
  if (!cycle || bigThreshold == null || amount < bigThreshold) return null;
  const days = cycle.daysLeft - 1;
  if (days <= 0) return null;
  const leftAfter = cycle.remaining - summary.totalSpent;
  return {
    before: round500(Math.max(0, leftAfter + amount) / days),
    after: round500(Math.max(0, leftAfter) / days),
    days,
  };
}

/** Dampak pemasukan baru ke jatah harian hari-hari berikutnya: `remainingBefore/After` = sisa periode (setelah belanja
 * hari ini) sebelum/sesudah pemasukan dihitung. null = tidak ada hari tersisa atau tidak berubah. */
export function incomeImpact(remainingBefore: number, remainingAfter: number, daysLeft: number): { before: number; after: number; days: number } | null {
  if (daysLeft <= 0) return null;
  const before = round500(Math.max(0, remainingBefore) / daysLeft);
  const after = round500(Math.max(0, remainingAfter) / daysLeft);
  return after === before ? null : { before, after, days: daysLeft };
}
