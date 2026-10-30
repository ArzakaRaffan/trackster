/** Engine kebiasaan mingguan — pure functions, tanpa DB (habit-engine.check.ts). Desain: docs/budget-kebiasaan.md.
 * Membandingkan minggu ini dengan kebiasaan user (median/rata-rata minggu-minggu penuh sebelumnya) supaya Trackster bisa
 * bilang "Kopi 4× minggu ini, biasanya 2×" — deterministik, tanpa AI. Teks dua bahasa dibuat di sini. */
import { addWibDays, startOfWibDay, wibDateKey, wibDayOfWeek } from '../../common/wib';
import { median, timeBucket, TimeBucket } from '../analytics/period-stats.util';

const DAY_MS = 86_400_000;
/** Minggu penuh minimal sebelum Trackster berani bilang "biasanya". */
export const HABIT_MIN_WEEKS = 3;
const BASELINE_WEEKS = 8;
const MAX_INSIGHTS = 5;

export interface HabitTx {
  amount: number; // net (setelah reimburse)
  occurredAt: Date;
  key: string; // merchantKey
  merchant: string; // nama tampil (alias)
  category: string;
  big: boolean; // pembelian besar → bukan kebiasaan rutin
}

export interface HabitIncome {
  amount: number;
  receivedAt: Date;
  pasti: boolean;
}

export interface Range {
  start: Date;
  end: Date;
}

export interface HabitInsight {
  id: string;
  tone: 'warn' | 'good' | 'info';
  score: number;
  textId: string;
  textEn: string;
}

const DAY_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BUCKET_ID: Record<TimeBucket, string> = { pagi: 'pagi', siang: 'siang', sore: 'sore', malam: 'malam', larut: 'larut malam' };
const BUCKET_EN: Record<TimeBucket, string> = { pagi: 'in the morning', siang: 'at midday', sore: 'in the afternoon', malam: 'in the evening', larut: 'late at night' };
const CATEGORY: Record<string, [string, string]> = {
  MAKANAN: ['Makanan', 'Food'], TRANSPORT: ['Transport', 'Transport'], BELANJA: ['Belanja', 'Shopping'], TAGIHAN: ['Tagihan', 'Bills'],
  HIBURAN: ['Hiburan', 'Entertainment'], KESEHATAN: ['Kesehatan', 'Health'], PENDIDIKAN: ['Pendidikan', 'Education'],
  PERAWATAN: ['Perawatan', 'Self-care'], ROKOK: ['Rokok', 'Cigarettes'],
}; // TRANSFER/TOPUP/INVESTASI/LAINNYA bukan kebiasaan belanja yang bermakna

export const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const times = (n: number) => (Math.round(n * 10) / 10).toLocaleString('id-ID', { maximumFractionDigits: 1 });
const timesEn = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
const dayIndex = (weekStart: Date, d: Date) => Math.floor((startOfWibDay(d).getTime() - weekStart.getTime()) / DAY_MS);
const hourWib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).getUTCHours();

export interface SpendBaseline {
  weeksObserved: number; // minggu penuh (maks 8) sebelum `weekStart` sejak data mulai
  weeklyRoutine: number[]; // belanja rutin per minggu penuh, lama → baru
  usualWeekly: number | null; // median; null kalau weeksObserved < HABIT_MIN_WEEKS
  avgByDow: number[]; // rata-rata belanja rutin per hari-dalam-minggu (0=Min)
}

/** Kebiasaan belanja rutin dari minggu-minggu penuh sebelum `weekStart` (Senin 00:00 WIB). Minggu yang dimulai sebelum
 * `dataStartsAt` (user belum memakai Trackster) tidak dihitung — supaya tidak ada "biasanya Rp0" palsu. */
export function spendBaseline(txs: HabitTx[], weekStart: Date, dataStartsAt: Date | null, weeks = BASELINE_WEEKS): SpendBaseline {
  const from = dataStartsAt ? startOfWibDay(dataStartsAt).getTime() : -Infinity;
  const weekStarts: Date[] = [];
  for (let i = weeks; i >= 1; i--) {
    const ws = addWibDays(weekStart, -7 * i);
    if (ws.getTime() >= from) weekStarts.push(ws);
  }
  const byDow = [0, 0, 0, 0, 0, 0, 0];
  const weeklyRoutine = weekStarts.map((ws) => {
    const we = addWibDays(ws, 7).getTime();
    let sum = 0;
    for (const t of txs) {
      const at = t.occurredAt.getTime();
      if (t.big || at < ws.getTime() || at >= we) continue;
      sum += t.amount;
      byDow[wibDayOfWeek(t.occurredAt)] += t.amount;
    }
    return sum;
  });
  const n = weekStarts.length;
  return {
    weeksObserved: n,
    weeklyRoutine,
    usualWeekly: n >= HABIT_MIN_WEEKS ? Math.round(median(weeklyRoutine)) : null,
    avgByDow: byDow.map((v) => (n ? v / n : 0)),
  };
}

export interface IncomeBaseline {
  periodsObserved: number;
  usualTotal: number | null;
  usualPasti: number | null;
  usualTambahan: number | null;
  thisPeriod: { total: number; pasti: number; tambahan: number };
  typicalDow: number | null; // hari pemasukan pasti biasanya masuk (modus)
}

/** Kebiasaan pemasukan per periode budget. `past` = periode-periode sebelumnya (lama → baru); periode yang dimulai
 * sebelum `dataStartsAt` diabaikan. */
export function incomeBaseline(incomes: HabitIncome[], past: Range[], current: Range, dataStartsAt: Date | null): IncomeBaseline {
  const from = dataStartsAt ? startOfWibDay(dataStartsAt).getTime() : -Infinity;
  const sumIn = (r: Range, pick: (i: HabitIncome) => boolean) =>
    incomes.filter((i) => pick(i) && i.receivedAt >= r.start && i.receivedAt < r.end).reduce((s, i) => s + i.amount, 0);
  const observed = past.filter((r) => r.start.getTime() >= from);
  const ok = observed.length >= HABIT_MIN_WEEKS;
  const med = (pick: (i: HabitIncome) => boolean) => (ok ? Math.round(median(observed.map((r) => sumIn(r, pick)))) : null);
  const dows = incomes.filter((i) => i.pasti).map((i) => wibDayOfWeek(i.receivedAt));
  const counts = new Map<number, number>();
  for (const d of dows) counts.set(d, (counts.get(d) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    periodsObserved: observed.length,
    usualTotal: med(() => true),
    usualPasti: med((i) => i.pasti),
    usualTambahan: med((i) => !i.pasti),
    thisPeriod: { total: sumIn(current, () => true), pasti: sumIn(current, (i) => i.pasti), tambahan: sumIn(current, (i) => !i.pasti) },
    typicalDow: top && top[1] >= 2 ? top[0] : null,
  };
}

export interface WeeklyHabitsInput {
  now: Date;
  weekStart: Date; // Senin 00:00 WIB minggu yang dianalisis
  txs: HabitTx[]; // minimal 8 minggu sebelum weekStart + minggu itu
  dataStartsAt: Date | null;
  income: IncomeBaseline | null;
  periodLabel: { id: string; en: string }; // "minggu ini" / "bulan ini"
  pastiLate: { name: string; dueDate: Date }[]; // pemasukan pasti yang lewat jadwal & belum tercatat
  streakUnder: number; // hari berturut-turut di bawah jatah
}

export interface WeeklyHabits {
  weekStart: string;
  closed: boolean;
  learning: { weeksObserved: number; needed: number } | null;
  spending: {
    usualWeekly: number | null;
    thisWeek: number;
    expectedSoFar: number | null;
    peakDow: { dow: number; ratio: number } | null;
    peakBucket: { bucket: TimeBucket; share: number } | null;
    habits: { key: string; merchant: string; thisWeek: number; usualPerWeek: number }[];
  };
  income: IncomeBaseline | null;
  insights: HabitInsight[];
}

export function buildWeeklyHabits(i: WeeklyHabitsInput): WeeklyHabits {
  const weekStart = startOfWibDay(i.weekStart);
  const weekEnd = addWibDays(weekStart, 7);
  const closed = i.now.getTime() >= weekEnd.getTime();
  const elapsedDays = closed ? 7 : Math.min(7, dayIndex(weekStart, i.now) + 1);
  const base = spendBaseline(i.txs, weekStart, i.dataStartsAt);
  const n = base.weeksObserved;
  const known = n >= HABIT_MIN_WEEKS;
  const thisWeekTx = i.txs.filter((t) => t.occurredAt >= weekStart && t.occurredAt < weekEnd && t.occurredAt <= i.now);
  const routine = thisWeekTx.filter((t) => !t.big);
  const thisWeek = routine.reduce((s, t) => s + t.amount, 0);
  const label = closed ? { id: 'minggu itu', en: 'that week' } : { id: 'minggu ini', en: 'this week' };

  // Porsi minggu yang sudah lewat menurut pola harian user (Sabtu boros → Sabtu porsinya besar).
  const totalDow = base.avgByDow.reduce((s, v) => s + v, 0);
  let elapsedShare = elapsedDays / 7;
  if (totalDow > 0 && !closed) {
    let acc = 0;
    for (let d = 0; d < elapsedDays; d++) acc += base.avgByDow[wibDayOfWeek(addWibDays(weekStart, d))];
    elapsedShare = acc / totalDow;
  }
  const expectedSoFar = base.usualWeekly != null ? Math.round(base.usualWeekly * elapsedShare) : null;

  const out: HabitInsight[] = [];
  const push = (x: HabitInsight) => out.push(x);

  for (const p of i.pastiLate) {
    const d = wibDayOfWeek(p.dueDate);
    push({
      id: `pasti-late:${p.name}`, tone: 'warn', score: 100,
      textId: `${p.name} biasanya masuk hari ${DAY_ID[d]} — belum tercatat. Sudah masuk? Ketik +${p.name.toLowerCase()} <nominal> di Telegram.`,
      textEn: `${p.name} usually arrives on ${DAY_EN[d]} — not recorded yet. Got it? Send +${p.name.toLowerCase()} <amount> on Telegram.`,
    });
  }

  if (expectedSoFar != null && (closed || elapsedDays >= 2)) {
    const ratio = expectedSoFar > 0 ? thisWeek / expectedSoFar : 0;
    const diff = thisWeek - expectedSoFar;
    if (ratio >= 1.2 && diff >= 25_000) {
      const pct = Math.round((ratio - 1) * 100);
      push({
        id: 'spend-up', tone: 'warn', score: 80 + Math.min(pct, 100) / 10,
        textId: closed
          ? `Belanja rutin minggu itu ${rp(thisWeek)}, ${pct}% di atas biasanya (${rp(base.usualWeekly!)}).`
          : `Belanja rutin minggu ini sudah ${rp(thisWeek)} — biasanya baru ${rp(expectedSoFar)} di titik ini (+${pct}%).`,
        textEn: closed
          ? `Routine spending that week was ${rp(thisWeek)}, ${pct}% above your usual (${rp(base.usualWeekly!)}).`
          : `Routine spending this week is already ${rp(thisWeek)} — you're usually at ${rp(expectedSoFar)} by now (+${pct}%).`,
      });
    } else if (ratio <= 0.85 && elapsedDays >= 3 && expectedSoFar - thisWeek >= 25_000) {
      push({
        id: 'spend-down', tone: 'good', score: 70,
        textId: `Belanja rutin ${label.id} ${rp(thisWeek)}, lebih hemat dari biasanya (${rp(expectedSoFar)}${closed ? '' : ' di titik ini'}).`,
        textEn: `Routine spending ${label.en}: ${rp(thisWeek)}, below your usual (${rp(expectedSoFar)}${closed ? '' : ' by now'}).`,
      });
    }
  }

  // Merchant: frekuensi minggu ini vs rata-rata per minggu penuh sebelumnya.
  const habits: WeeklyHabits['spending']['habits'] = [];
  if (known) {
    const pastFrom = addWibDays(weekStart, -7 * n).getTime();
    const pastCount = new Map<string, number>();
    for (const t of i.txs) {
      if (t.big || !t.key) continue;
      const at = t.occurredAt.getTime();
      if (at >= pastFrom && at < weekStart.getTime()) pastCount.set(t.key, (pastCount.get(t.key) ?? 0) + 1);
    }
    const nowCount = new Map<string, { n: number; merchant: string }>();
    for (const t of routine) {
      if (!t.key) continue;
      const e = nowCount.get(t.key) ?? { n: 0, merchant: t.merchant };
      e.n++;
      nowCount.set(t.key, e);
    }
    const keys = new Set([...pastCount.keys(), ...nowCount.keys()]);
    let merchantInsights = 0;
    const ranked = [...keys]
      .map((key) => ({ key, merchant: nowCount.get(key)?.merchant ?? i.txs.find((t) => t.key === key)!.merchant, thisWeek: nowCount.get(key)?.n ?? 0, usualPerWeek: (pastCount.get(key) ?? 0) / n }))
      .sort((a, b) => b.thisWeek - b.usualPerWeek - (a.thisWeek - a.usualPerWeek));
    for (const m of ranked) {
      if (m.usualPerWeek >= 1 || m.thisWeek >= 3) habits.push(m);
      if (merchantInsights >= 2) continue;
      const u = Math.round(m.usualPerWeek * 10) / 10;
      if (m.thisWeek >= 3 && m.usualPerWeek < 0.5) {
        merchantInsights++;
        push({
          id: `habit-new:${m.key}`, tone: 'info', score: 50 + m.thisWeek,
          textId: `Kebiasaan baru? ${m.merchant} ${m.thisWeek}× ${label.id}, sebelumnya jarang.`,
          textEn: `New habit? ${m.merchant} ${m.thisWeek}× ${label.en}, rarely before.`,
        });
      } else if (m.thisWeek >= 3 && m.thisWeek >= m.usualPerWeek * 1.5 && m.thisWeek - m.usualPerWeek >= 2) {
        merchantInsights++;
        push({
          id: `habit-up:${m.key}`, tone: 'warn', score: 60 + m.thisWeek - m.usualPerWeek,
          textId: `${m.merchant} ${m.thisWeek}× ${label.id}, biasanya ${times(u)}× per minggu.`,
          textEn: `${m.merchant} ${m.thisWeek}× ${label.en}, usually ${timesEn(u)}× a week.`,
        });
      }
    }
    for (const m of [...ranked].reverse()) {
      if (merchantInsights >= 2 || elapsedDays < 5) break;
      const pace = m.usualPerWeek * (elapsedDays / 7);
      if (m.usualPerWeek >= 3 && m.thisWeek <= pace * 0.5) {
        merchantInsights++;
        push({
          id: `habit-down:${m.key}`, tone: 'good', score: 55,
          textId: `${m.merchant} cuma ${m.thisWeek}× ${label.id}, biasanya ${times(Math.round(m.usualPerWeek * 10) / 10)}× per minggu. Mantap.`,
          textEn: `${m.merchant} only ${m.thisWeek}× ${label.en}, usually ${timesEn(Math.round(m.usualPerWeek * 10) / 10)}× a week. Nice.`,
        });
      }
    }

    // Kategori naik dibanding rata-rata mingguan.
    const pastCat = new Map<string, number>();
    const nowCat = new Map<string, number>();
    for (const t of i.txs) {
      if (t.big || !CATEGORY[t.category]) continue;
      const at = t.occurredAt.getTime();
      if (at >= pastFrom && at < weekStart.getTime()) pastCat.set(t.category, (pastCat.get(t.category) ?? 0) + t.amount);
    }
    for (const t of routine) if (CATEGORY[t.category]) nowCat.set(t.category, (nowCat.get(t.category) ?? 0) + t.amount);
    const catUp = [...nowCat.entries()]
      .map(([c, v]) => ({ c, v, u: ((pastCat.get(c) ?? 0) / n) * elapsedShare }))
      .filter((x) => x.u > 0 && x.v >= x.u * 1.5 && x.v - x.u >= 50_000)
      .sort((a, b) => b.v - b.u - (a.v - a.u))[0];
    if (catUp) {
      const [cid, cen] = CATEGORY[catUp.c];
      push({
        id: `cat-up:${catUp.c}`, tone: 'warn', score: 65,
        textId: `${cid} ${label.id} ${rp(catUp.v)}, biasanya ${rp(catUp.u)}${closed ? ' per minggu' : ' di titik ini'}.`,
        textEn: `${cen} ${label.en}: ${rp(catUp.v)}, usually ${rp(catUp.u)}${closed ? ' a week' : ' by now'}.`,
      });
    }
  }

  if (i.streakUnder >= 3) {
    push({
      id: 'streak', tone: 'good', score: 60 + i.streakUnder,
      textId: `${i.streakUnder} hari berturut-turut belanja di bawah jatah.`,
      textEn: `${i.streakUnder} days in a row under your daily budget.`,
    });
  }

  const inc = i.income;
  if (inc && inc.usualTotal != null && inc.usualTotal > 0) {
    const cur = inc.thisPeriod.total;
    if (cur >= inc.usualTotal * 1.15) {
      push({
        id: 'income-up', tone: 'good', score: 58,
        textId: `Pemasukan ${i.periodLabel.id} ${rp(cur)}, di atas biasanya (${rp(inc.usualTotal)}). Budget-mu ikut naik.`,
        textEn: `Income ${i.periodLabel.en}: ${rp(cur)}, above your usual (${rp(inc.usualTotal)}). Your budget went up too.`,
      });
    } else if (closed && cur <= inc.usualTotal * 0.85) {
      push({
        id: 'income-down', tone: 'warn', score: 70,
        textId: `Pemasukan ${i.periodLabel.id} ${rp(cur)}, di bawah biasanya (${rp(inc.usualTotal)}).`,
        textEn: `Income ${i.periodLabel.en}: ${rp(cur)}, below your usual (${rp(inc.usualTotal)}).`,
      });
    }
  }

  // Hari paling boros (dari rata-rata per hari-dalam-minggu).
  let peakDow: WeeklyHabits['spending']['peakDow'] = null;
  if (n >= 4 && totalDow > 0) {
    const mean = totalDow / 7;
    const dow = base.avgByDow.indexOf(Math.max(...base.avgByDow));
    const ratio = base.avgByDow[dow] / mean;
    if (ratio >= 1.4) {
      peakDow = { dow, ratio: Math.round(ratio * 10) / 10 };
      const today = !closed && wibDayOfWeek(i.now) === dow;
      push({
        id: 'peak-dow', tone: 'info', score: today ? 75 : 40,
        textId: today
          ? `Hari ini ${DAY_ID[dow]} — biasanya hari belanjamu paling banyak (${times(ratio)}× rata-rata). Jatah hari ini sudah memperhitungkannya.`
          : `Kamu biasanya paling banyak belanja di hari ${DAY_ID[dow]} (${times(ratio)}× rata-rata harian).`,
        textEn: today
          ? `It's ${DAY_EN[dow]} — usually your biggest spending day (${timesEn(ratio)}× average). Today's budget already accounts for it.`
          : `You usually spend the most on ${DAY_EN[dow]}s (${timesEn(ratio)}× your daily average).`,
      });
    }
  }

  // Jam paling sering (8 minggu + minggu ini).
  let peakBucket: WeeklyHabits['spending']['peakBucket'] = null;
  const windowTx = i.txs.filter((t) => !t.big && t.occurredAt.getTime() >= addWibDays(weekStart, -7 * BASELINE_WEEKS).getTime() && t.occurredAt < weekEnd);
  if (known && windowTx.length >= 10) {
    const counts = new Map<TimeBucket, number>();
    for (const t of windowTx) counts.set(timeBucket(hourWib(t.occurredAt)), (counts.get(timeBucket(hourWib(t.occurredAt))) ?? 0) + 1);
    const [bucket, c] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = c / windowTx.length;
    if (share >= 0.35) {
      peakBucket = { bucket, share: Math.round(share * 100) / 100 };
      push({
        id: 'peak-time', tone: 'info', score: 35,
        textId: `Kamu paling sering belanja ${BUCKET_ID[bucket]} (${Math.round(share * 100)}% transaksi).`,
        textEn: `You shop most often ${BUCKET_EN[bucket]} (${Math.round(share * 100)}% of transactions).`,
      });
    }
  }

  const toneRank = { warn: 0, good: 1, info: 2 };
  const insights = out.sort((a, b) => toneRank[a.tone] - toneRank[b.tone] || b.score - a.score).slice(0, MAX_INSIGHTS);

  return {
    weekStart: wibDateKey(weekStart),
    closed,
    learning: known ? null : { weeksObserved: n, needed: HABIT_MIN_WEEKS },
    spending: { usualWeekly: base.usualWeekly, thisWeek: Math.round(thisWeek), expectedSoFar, peakDow, peakBucket, habits: habits.sort((a, b) => b.thisWeek - a.thisWeek).slice(0, 5) },
    income: inc,
    insights,
  };
}
