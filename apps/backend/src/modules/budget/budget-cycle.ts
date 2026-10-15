/** Engine siklus gajian — pure functions, tanpa DB. Desain: docs/siklus-gajian.md.
 * Mode SIKLUS: jatah hari ini = sisa uang siklus (payday → payday) ÷ sisa hari, berbobot hari-dalam-minggu.
 * Mode SALDO: jatah hari ini = saldo tersedia ÷ horizon hari, berbobot. */
import { addWibDays, startOfWibDay, startOfWibMonth, wibDayOfWeek, wibParts } from '../../common/wib';
import { round500 } from './budget-advisor';

const DAY_MS = 86_400_000;

export interface AnchorSchedule {
  cadence: 'WEEKLY' | 'MONTHLY';
  payDayOfWeek?: number | null; // WEEKLY: 0=Min..6=Sab
  payDayOfMonth?: number | null; // MONTHLY: 1..31 (di-clamp ke akhir bulan)
}

/** Gaji boleh masuk sedini ini sebelum payday dan tetap dianggap membuka siklus baru. */
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

/** Batas siklus berjalan [start, end). `lastAnchorReceivedAt` = kapan income anchor terakhir diterima;
 * kalau masuk ≤ EARLY_PAY_DAYS sebelum payday berikutnya, siklus baru dimulai hari itu. */
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
  // Gaji siklus berikutnya sudah masuk lebih awal → siklus baru mulai hari itu.
  if (r >= addWibDays(end, -early).getTime()) return { start: startOfWibDay(lastAnchorReceivedAt!), end: nextPayday(anchor, end) };
  // Gaji siklus ini dulu masuk lebih awal → siklus ini mulai dari hari diterima, bukan dari payday.
  if (r < start.getTime() && r >= addWibDays(start, -early).getTime()) return { start: startOfWibDay(lastAnchorReceivedAt!), end };
  return { start, end };
}

/** Bobot 0=Min..6=Sab dari nominal `DailyBudget` lama. Kosong / semua 0 → rata. */
export function normalizeWeights(amounts: number[]): number[] {
  const w = [0, 1, 2, 3, 4, 5, 6].map((d) => Math.max(0, amounts[d] ?? 0));
  const total = w.reduce((s, v) => s + v, 0);
  return total > 0 ? w.map((v) => v / total) : w.map(() => 1 / 7);
}

/** Bagian hari ini dari `pool` yang dibagi ke `days` hari mulai `today`, berbobot. */
function shareForToday(pool: number, today: Date, days: number, weights: number[]): number {
  const startDow = wibDayOfWeek(today);
  let sum = 0;
  for (let i = 0; i < days; i++) sum += weights[(startDow + i) % 7];
  return sum > 0 ? round500(Math.max(0, pool) * (weights[startDow] / sum)) : 0;
}

export interface CycleAllowanceInput {
  now: Date;
  cycleStart: Date;
  cycleEnd: Date;
  anchorExpected: number; // forecast anchor; 0 kalau ditandai MISSED
  anchorReceived: number | null; // null = belum masuk di siklus ini
  otherIncome: number; // income non-anchor CONFIRMED yang diterima di siklus ini
  carry: number; // sisa siklus lalu (0 kalau rollover mati)
  commitments: number; // langganan + kontribusi goal di [cycleStart, cycleEnd)
  reservePct: number; // 0..100, dipotong dari pemasukan siklus (bukan dari carry)
  spentBeforeToday: number; // pengeluaran di [cycleStart, awal hari ini)
  weights: number[]; // dari normalizeWeights
}

export interface AllowanceResult {
  allowance: number; // jatah hari ini (beku terhadap pengeluaran hari ini)
  remaining: number; // sisa uang yang dibagi mulai hari ini (bisa negatif)
  daysLeft: number; // termasuk hari ini
  deficit: boolean;
}

export function computeCycleAllowance(i: CycleAllowanceInput): AllowanceResult {
  const income = (i.anchorReceived ?? i.anchorExpected) + i.otherIncome;
  const spendable = income + i.carry - i.commitments - income * (i.reservePct / 100);
  const remaining = Math.round(spendable - i.spentBeforeToday);
  const today = startOfWibDay(i.now);
  const daysLeft = Math.max(1, Math.round((i.cycleEnd.getTime() - today.getTime()) / DAY_MS));
  return { allowance: shareForToday(remaining, today, daysLeft, i.weights), remaining, daysLeft, deficit: remaining < 0 };
}

export interface BalanceAllowanceInput {
  now: Date;
  balance: number; // Σ BankBalance sekarang
  spentToday: number; // dikembalikan ke saldo supaya jatah beku per hari
  commitments: number; // komitmen horizonDays ke depan
  horizonDays: number;
  burnRatePerDay: number;
  weights: number[];
}

export interface BalanceAllowanceResult extends AllowanceResult {
  runwayDays: number | null; // null = belum ada burn rate
}

export function computeBalanceAllowance(i: BalanceAllowanceInput): BalanceAllowanceResult {
  const remaining = Math.round(i.balance + i.spentToday - i.commitments);
  const daysLeft = Math.max(1, i.horizonDays);
  return {
    allowance: shareForToday(remaining, startOfWibDay(i.now), daysLeft, i.weights),
    remaining,
    daysLeft,
    deficit: remaining < 0,
    runwayDays: i.burnRatePerDay > 0 ? Math.max(0, Math.floor(remaining / i.burnRatePerDay)) : null,
  };
}
