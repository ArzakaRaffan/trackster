import { Injectable } from '@nestjs/common';
import { IncomeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BudgetService, isPastiStream } from '../budget/budget.service';
import { cycleBounds, periodSchedule, previousPeriods } from '../budget/budget-period';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { bigPurchaseThreshold, computeBudgetAdherence, isBigPurchase, median } from '../analytics/period-stats.util';
import { merchantKey } from '../../common/merchant-key';
import { addWibDays, startOfWibDay, startOfWibWeek, wibDateKey } from '../../common/wib';
import { spend } from '../../common/spend';
import { buildWeeklyHabits, HabitIncome, HabitTx, incomeBaseline, WeeklyHabits } from './habit-engine';

/** Periode budget yang dipakai untuk "biasanya" pemasukan (≥3 periode lalu, maks 6). */
const INCOME_PERIODS = 6;

@Injectable()
export class HabitService {
  constructor(
    private prisma: PrismaService,
    private budgetService: BudgetService,
    private merchantAliasService: MerchantAliasService,
  ) {}

  /** Kebiasaan minggu (Senin–Minggu) yang memuat `weekKey` ('YYYY-MM-DD', default hari ini). Minggu berjalan memakai
   * ringkasan budget hari ini (pemasukan pasti yang telat, periode berjalan); minggu lalu dianalisis apa adanya. */
  async getWeekly(userId: number, weekKey?: string): Promise<WeeklyHabits & { periodLabel: { id: string; en: string } }> {
    const now = new Date();
    const anchor = weekKey ? new Date(`${weekKey}T12:00:00+07:00`) : now;
    const weekStart = startOfWibWeek(anchor);
    const weekEnd = addWibDays(weekStart, 7);
    const current = now.getTime() < weekEnd.getTime();
    const asOf = current ? now : new Date(weekEnd.getTime() - 1);

    const [settings, user, firstTx, txRows, streams, allowances] = await Promise.all([
      this.budgetService.getSettings(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      this.prisma.transaction.findFirst({ where: { userId }, orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } }),
      // 90 hari sebelum akhir minggu: median "pembelian besar" (sama dengan analytics) + 8 minggu kebiasaan.
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: addWibDays(weekEnd, -90), lt: weekEnd } },
        select: { amount: true, reimbursedAmount: true, occurredAt: true, isBig: true, merchantKey: true, description: true, category: true },
      }),
      this.prisma.incomeStream.findMany({ where: { userId } }),
      this.prisma.dailyAllowance.findMany({
        where: { userId, date: { gte: new Date(`${wibDateKey(addWibDays(asOf, -30))}T00:00:00Z`), lte: new Date(`${wibDateKey(asOf)}T00:00:00Z`) } },
      }),
    ]);

    const created = user?.createdAt ?? now;
    const dataStartsAt = firstTx && firstTx.occurredAt < created ? firstTx.occurredAt : created;
    const median90 = median(txRows.map(spend));
    const named = await this.merchantAliasService.attachDisplayNames(userId, txRows);
    const txs: HabitTx[] = named.map((t) => ({
      amount: spend(t),
      occurredAt: t.occurredAt,
      key: t.merchantKey || merchantKey(t.description),
      merchant: t.displayDescription,
      category: t.category,
      big: isBigPurchase(spend(t), median90, t.isBig),
    }));

    // Periode budget (pemasukan) yang memuat minggu ini + periode-periode sebelumnya.
    const schedule = periodSchedule(settings.period, settings.periodDay);
    const summary = current ? await this.budgetService.getTodaySummary(userId) : null;
    const period = summary
      ? { start: new Date(`${summary.cycle.start}T00:00:00+07:00`), end: new Date(`${summary.cycle.end}T00:00:00+07:00`) }
      : cycleBounds(schedule, asOf);
    const past = previousPeriods(schedule, period.start, INCOME_PERIODS);
    const pastiIds = new Set(streams.filter(isPastiStream).map((s) => s.id));
    const incomeRows = await this.prisma.income.findMany({
      where: { userId, status: IncomeStatus.CONFIRMED, amount: { gt: 0 }, receivedAt: { gte: past[0].start, lt: period.end } },
      select: { amount: true, receivedAt: true, streamId: true },
    });
    const incomes: HabitIncome[] = incomeRows.map((i) => ({ amount: Number(i.amount), receivedAt: i.receivedAt, pasti: i.streamId != null && pastiIds.has(i.streamId) }));

    // Streak di bawah jatah: hari-hari yang sudah selesai (sampai kemarin untuk minggu berjalan).
    const allowanceBy = new Map(allowances.map((a) => [a.date.toISOString().slice(0, 10), Number(a.amount)]));
    const days: { spend: number; budget: number }[] = [];
    const lastDay = current ? startOfWibDay(now) : weekEnd;
    for (let d = addWibDays(lastDay, -30); d < lastDay; d = addWibDays(d, 1)) {
      const key = wibDateKey(d);
      const routine = txs.filter((t) => !t.big && wibDateKey(t.occurredAt) === key).reduce((s, t) => s + t.amount, 0);
      days.push({ spend: routine, budget: allowanceBy.get(key) ?? 0 });
    }

    const monthly = settings.period === 'MONTHLY';
    const periodLabel = current
      ? { id: monthly ? 'bulan ini' : 'minggu ini', en: monthly ? 'this month' : 'this week' }
      : { id: monthly ? 'bulan itu' : 'minggu itu', en: monthly ? 'that month' : 'that week' };
    const habits = buildWeeklyHabits({
      now: asOf,
      weekStart,
      txs,
      dataStartsAt,
      income: incomeBaseline(incomes, past, period, dataStartsAt),
      periodLabel,
      pastiLate: (summary?.cycle.pastiPending ?? []).map((p) => ({ name: p.name, dueDate: new Date(`${p.dueDate}T00:00:00+07:00`) })),
      streakUnder: computeBudgetAdherence(days).streakUnder,
    });
    return { ...habits, periodLabel, bigThreshold: bigPurchaseThreshold(median90) } as WeeklyHabits & { periodLabel: { id: string; en: string } };
  }

  /** Pemasukan biasanya per minggu (untuk simulasi rencana): median per periode dikonversi ke mingguan; belum ada
   * riwayat → pemasukan periode berjalan yang dihitung budget. `pasti` = tanpa pemasukan tambahan. */
  async getUsualWeeklyIncome(userId: number): Promise<{ pasti: number; total: number }> {
    const h = await this.getWeekly(userId);
    const s = await this.budgetService.getTodaySummary(userId);
    const perWeek = (n: number) => Math.round((n / Math.max(1, s.cycle.daysTotal)) * 7);
    const pastiNow = s.cycle.pasti.reduce((t, p) => t + p.usual * Math.max(1, p.paydays), 0);
    return {
      pasti: perWeek(h.income?.usualPasti ?? pastiNow),
      total: perWeek(h.income?.usualTotal ?? s.cycle.income),
    };
  }

  /** Teks pendek (maks `n` baris) untuk Telegram/AI. */
  static bullets(h: WeeklyHabits, n = 3, lang: 'id' | 'en' = 'id'): string[] {
    if (h.learning && !h.insights.length) {
      return [lang === 'id'
        ? `Trackster masih kenalan sama kebiasaanmu (minggu ${h.learning.weeksObserved + 1} dari ${h.learning.needed}).`
        : `Trackster is still getting to know your habits (week ${h.learning.weeksObserved + 1} of ${h.learning.needed}).`];
    }
    return h.insights.slice(0, n).map((x) => `${x.tone === 'warn' ? '⚠️' : x.tone === 'good' ? '✅' : '💡'} ${lang === 'id' ? x.textId : x.textEn}`);
  }
}
