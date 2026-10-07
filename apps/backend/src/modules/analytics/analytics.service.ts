import { BadRequestException, Injectable } from '@nestjs/common';
import { Category, IncomeStatus, ParseStatus, Transaction } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { addWibDays, startOfWibDay, wibDateKey, wibDayOfWeek } from '../../common/wib';
import { merchantKey as computeMerchantKey } from '../../common/merchant-key';
import {
  computeBudgetAdherence,
  isAnomaly,
  isBigPurchase,
  median,
  percentile,
  previousPeriod,
  savingsRate,
  timeBucket,
  TimeBucket,
} from './period-stats.util';
import { toNet } from '../../common/spend';

export interface PeriodTotals {
  spend: number;
  spendRoutine: number;
  spendBig: number;
  txCount: number;
  avgRoutinePerDay: number;
  income: number;
  net: number;
  savingsRate: number | null;
}

export interface PeriodStats {
  range: { start: string; end: string; days: number; dataStartsAt: string | null };
  totals: PeriodTotals;
  previous?: PeriodTotals & { start: string; end: string };
  byCategory: { category: Category; total: number; count: number; prevTotal?: number }[];
  byMerchant: {
    merchantKey: string;
    displayName: string;
    total: number;
    count: number;
    avgTicket: number;
    prevTotal?: number;
    perWeek: number;
  }[];
  byDay: { date: string; spend: number; spendRoutine: number; budget: number; income: number }[];
  byWeekday: { dayOfWeek: number; avgRoutine: number }[];
  timeHeatmap: { dayOfWeek: number; bucket: TimeBucket; count: number; total: number }[];
  bigPurchases: Transaction[];
  anomalies: { tx: Transaction; reason: string }[];
  habits: { merchantKey: string; displayName: string; count: number; total: number; perWeek: number; annualized: number }[];
  budget: { daysWithBudget: number; daysOver: number; adherencePct: number | null; streakUnder: number; worstWeekday: number | null };
  dataQuality: { lainnyaPct: number; pendingIncomeCount: number; unparsedEmailCount: number };
}

type AmountBigRow = Pick<Transaction, 'amount' | 'isBig'>;

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private merchantAliasService: MerchantAliasService,
  ) {}

  /** `?range=7d|30d|90d|all` ATAU `from`&`to` (WIB, inklusif) → `{start,end}` instant UTC, `end` eksklusif.
   * Dipakai `AnalyticsController` & `AiInsightCardService` biar parsing range cuma sekali. */
  async resolvePeriod(userId: number, range?: string, from?: string, to?: string): Promise<{ start: Date; end: Date }> {
    if (from && to) {
      return { start: startOfWibDay(from), end: addWibDays(startOfWibDay(to), 1) };
    }

    const now = new Date();
    const end = addWibDays(startOfWibDay(now), 1);

    if (range === 'all') {
      const first = await this.getPeriodStats(userId, new Date(0), end, false);
      const start = first.range.dataStartsAt ? startOfWibDay(new Date(first.range.dataStartsAt)) : startOfWibDay(now);
      return { start, end };
    }

    const days = { '7d': 7, '30d': 30, '90d': 90 }[range ?? '30d'];
    if (!days) throw new BadRequestException('range harus 7d|30d|90d|all, atau pakai from & to');
    return { start: addWibDays(end, -days), end };
  }

  /** `end` eksklusif. Semua kunci hari pakai `wibDateKey`, batas hari/minggu dari `wib.ts`. */
  async getPeriodStats(userId: number, start: Date, end: Date, compare = true): Promise<PeriodStats> {
    const [dataStartsAtRow, budgetRows, transactionsRaw, window90dRaw, historyBeforeStart] = await Promise.all([
      this.prisma.transaction.aggregate({ where: { userId }, _min: { occurredAt: true } }),
      this.prisma.dailyBudget.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({ where: { userId, occurredAt: { gte: start, lt: end } }, orderBy: { occurredAt: 'asc' } }),
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: addWibDays(end, -90), lt: end } },
        select: { amount: true, reimbursedAmount: true, category: true, merchantKey: true, description: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { lt: start } },
        select: { merchantKey: true, description: true },
      }),
    ]);

    // Pengeluaran efektif (dikurangi patungan yang sudah diterima) — semua statistik di bawah baca `amount` ini.
    const transactions = transactionsRaw.map(toNet);
    const window90d = window90dRaw.map(toNet);

    const dataStartsAt = dataStartsAtRow._min.occurredAt;
    const budgetByDow = new Map(budgetRows.map((b) => [b.dayOfWeek, Number(b.amount)]));
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

    const medianAmount90d = median(window90d.map((t) => Number(t.amount)));
    const p90Amount90d = percentile(window90d.map((t) => Number(t.amount)), 90);
    const categoryMedians = new Map<Category, number>();
    for (const cat of Object.values(Category)) {
      categoryMedians.set(cat, median(window90d.filter((t) => t.category === cat).map((t) => Number(t.amount))));
    }
    const knownMerchantsBeforeStart = new Set(
      historyBeforeStart.map((t) => t.merchantKey || computeMerchantKey(t.description)),
    );

    const incomeRows = await this.prisma.income.findMany({
      where: { userId, receivedAt: { gte: start, lt: end }, status: IncomeStatus.CONFIRMED },
      select: { amount: true, receivedAt: true },
    });
    const totalIncome = incomeRows.reduce((sum, i) => sum + Number(i.amount), 0);

    const totals = this.computeTotals(transactions, medianAmount90d, totalIncome, days);

    let previous: (PeriodTotals & { start: string; end: string }) | undefined;
    let prevByCategory: Map<Category, number> | undefined;
    let prevByMerchant: Map<string, number> | undefined;
    if (compare) {
      const prevRange = previousPeriod(start, end, dataStartsAt);
      if (prevRange) {
        const [prevTxRaw, prevIncome] = await Promise.all([
          this.prisma.transaction.findMany({
            where: { userId, occurredAt: { gte: prevRange.start, lt: prevRange.end } },
            select: { amount: true, reimbursedAmount: true, category: true, merchantKey: true, description: true, isBig: true },
          }),
          this.prisma.income.aggregate({
            _sum: { amount: true },
            where: { userId, receivedAt: { gte: prevRange.start, lt: prevRange.end }, status: IncomeStatus.CONFIRMED },
          }),
        ]);
        const prevTx = prevTxRaw.map(toNet);
        const prevTotals = this.computeTotals(prevTx, medianAmount90d, Number(prevIncome._sum.amount ?? 0), days);
        previous = { ...prevTotals, start: prevRange.start.toISOString(), end: prevRange.end.toISOString() };

        prevByCategory = new Map();
        for (const t of prevTx) prevByCategory.set(t.category, (prevByCategory.get(t.category) ?? 0) + Number(t.amount));

        prevByMerchant = new Map();
        for (const t of prevTx) {
          const key = t.merchantKey || computeMerchantKey(t.description);
          prevByMerchant.set(key, (prevByMerchant.get(key) ?? 0) + Number(t.amount));
        }
      }
    }

    const byCategory = this.buildByCategory(transactions, prevByCategory);
    const byMerchant = await this.buildByMerchant(userId, transactions, prevByMerchant, days);
    const byDay = this.buildByDay(transactions, incomeRows, start, end, budgetByDow, medianAmount90d);
    const byWeekday = this.buildByWeekday(byDay);
    const timeHeatmap = this.buildTimeHeatmap(transactions);
    const bigPurchases = transactions
      .filter((t) => isBigPurchase(Number(t.amount), medianAmount90d, t.isBig))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    const anomalies = this.buildAnomalies(transactions, medianAmount90d, categoryMedians, p90Amount90d, knownMerchantsBeforeStart);
    const habits = await this.buildHabits(userId, transactions, medianAmount90d, days);
    const budget = { ...computeBudgetAdherence(byDay.map((d) => ({ spend: d.spendRoutine, budget: d.budget }))), worstWeekday: this.worstWeekday(byDay) };
    const dataQuality = await this.buildDataQuality(userId, transactions);

    return {
      range: { start: start.toISOString(), end: end.toISOString(), days, dataStartsAt: dataStartsAt?.toISOString() ?? null },
      totals,
      ...(previous ? { previous } : {}),
      byCategory,
      byMerchant,
      byDay,
      byWeekday,
      timeHeatmap,
      bigPurchases,
      anomalies,
      habits,
      budget,
      dataQuality,
    };
  }

  private computeTotals(transactions: AmountBigRow[], medianAmount90d: number, income: number, days: number): PeriodTotals {
    let spend = 0;
    let spendBig = 0;
    for (const t of transactions) {
      const amount = Number(t.amount);
      spend += amount;
      if (isBigPurchase(amount, medianAmount90d, t.isBig)) spendBig += amount;
    }
    const spendRoutine = spend - spendBig;
    const net = income - spend;
    return {
      spend,
      spendRoutine,
      spendBig,
      txCount: transactions.length,
      avgRoutinePerDay: spendRoutine / days,
      income,
      net,
      savingsRate: savingsRate(income, net),
    };
  }

  private buildByCategory(transactions: Transaction[], prevByCategory?: Map<Category, number>) {
    const totals = new Map<Category, { total: number; count: number }>();
    for (const t of transactions) {
      const entry = totals.get(t.category) ?? { total: 0, count: 0 };
      entry.total += Number(t.amount);
      entry.count++;
      totals.set(t.category, entry);
    }
    return Array.from(totals.entries())
      .map(([category, { total, count }]) => ({
        category,
        total,
        count,
        ...(prevByCategory ? { prevTotal: prevByCategory.get(category) ?? 0 } : {}),
      }))
      .sort((a, b) => b.total - a.total);
  }

  private async buildByMerchant(userId: number, transactions: Transaction[], prevByMerchant: Map<string, number> | undefined, days: number) {
    const groups = new Map<string, { total: number; count: number; description: string }>();
    for (const t of transactions) {
      const key = t.merchantKey || computeMerchantKey(t.description);
      const entry = groups.get(key) ?? { total: 0, count: 0, description: t.description };
      entry.total += Number(t.amount);
      entry.count++;
      groups.set(key, entry);
    }

    const representatives = Array.from(groups.values()).map((g) => ({ description: g.description }));
    const withDisplay = await this.merchantAliasService.attachDisplayNames(userId, representatives);
    const displayByDescription = new Map(withDisplay.map((r) => [r.description, r.displayDescription]));

    return Array.from(groups.entries())
      .map(([key, g]) => ({
        merchantKey: key,
        displayName: displayByDescription.get(g.description) ?? g.description,
        total: g.total,
        count: g.count,
        avgTicket: g.total / g.count,
        perWeek: (g.count / days) * 7,
        ...(prevByMerchant ? { prevTotal: prevByMerchant.get(key) ?? 0 } : {}),
      }))
      .sort((a, b) => b.total - a.total);
  }

  private buildByDay(
    transactions: Transaction[],
    incomeRows: { amount: Transaction['amount']; receivedAt: Date }[],
    start: Date,
    end: Date,
    budgetByDow: Map<number, number>,
    medianAmount90d: number,
  ) {
    const byDate = new Map<string, { spend: number; spendRoutine: number }>();
    for (const t of transactions) {
      const key = wibDateKey(t.occurredAt);
      const entry = byDate.get(key) ?? { spend: 0, spendRoutine: 0 };
      const amount = Number(t.amount);
      entry.spend += amount;
      if (!isBigPurchase(amount, medianAmount90d, t.isBig)) entry.spendRoutine += amount;
      byDate.set(key, entry);
    }
    const incomeByDate = new Map<string, number>();
    for (const i of incomeRows) {
      const key = wibDateKey(i.receivedAt);
      incomeByDate.set(key, (incomeByDate.get(key) ?? 0) + Number(i.amount));
    }

    const numDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    const result: PeriodStats['byDay'] = [];
    for (let i = 0; i < numDays; i++) {
      const date = addWibDays(start, i);
      const key = wibDateKey(date);
      const entry = byDate.get(key) ?? { spend: 0, spendRoutine: 0 };
      result.push({
        date: key,
        spend: entry.spend,
        spendRoutine: entry.spendRoutine,
        budget: budgetByDow.get(wibDayOfWeek(date)) ?? 0,
        income: incomeByDate.get(key) ?? 0,
      });
    }
    return result;
  }

  private buildByWeekday(byDay: PeriodStats['byDay']) {
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const d of byDay) {
      const dow = wibDayOfWeek(startOfWibDay(d.date));
      sums[dow] += d.spendRoutine;
      counts[dow]++;
    }
    return sums.map((sum, dayOfWeek) => ({ dayOfWeek, avgRoutine: counts[dayOfWeek] > 0 ? sum / counts[dayOfWeek] : 0 }));
  }

  private buildTimeHeatmap(transactions: Transaction[]) {
    const buckets = new Map<string, { dayOfWeek: number; bucket: TimeBucket; count: number; total: number }>();
    for (const t of transactions) {
      const dayOfWeek = wibDayOfWeek(t.occurredAt);
      const hourWib = new Date(t.occurredAt.getTime() + 7 * 3600_000).getUTCHours();
      const bucket = timeBucket(hourWib);
      const key = `${dayOfWeek}-${bucket}`;
      const entry = buckets.get(key) ?? { dayOfWeek, bucket, count: 0, total: 0 };
      entry.count++;
      entry.total += Number(t.amount);
      buckets.set(key, entry);
    }
    return Array.from(buckets.values());
  }

  private buildAnomalies(
    transactions: Transaction[],
    medianAmount90d: number,
    categoryMedians: Map<Category, number>,
    p90Amount90d: number,
    knownMerchantsBeforeStart: Set<string>,
  ) {
    const anomalies: PeriodStats['anomalies'] = [];
    const seenInPeriod = new Set<string>();
    for (const t of transactions) {
      const amount = Number(t.amount);
      if (isBigPurchase(amount, medianAmount90d, t.isBig)) continue; // besar sudah punya section sendiri
      const key = t.merchantKey || computeMerchantKey(t.description);
      const isNewMerchant = !knownMerchantsBeforeStart.has(key) && !seenInPeriod.has(key);
      const { anomaly, reason } = isAnomaly({
        amount,
        categoryMedian: categoryMedians.get(t.category) ?? 0,
        isNewMerchant,
        p90AllTransactions: p90Amount90d,
      });
      seenInPeriod.add(key);
      if (anomaly && reason) anomalies.push({ tx: t, reason });
    }
    return anomalies;
  }

  private async buildHabits(userId: number, transactions: Transaction[], medianAmount90d: number, days: number) {
    const groups = new Map<string, { total: number; count: number; description: string }>();
    for (const t of transactions) {
      if (isBigPurchase(Number(t.amount), medianAmount90d, t.isBig)) continue;
      const key = t.merchantKey || computeMerchantKey(t.description);
      const entry = groups.get(key) ?? { total: 0, count: 0, description: t.description };
      entry.total += Number(t.amount);
      entry.count++;
      groups.set(key, entry);
    }

    const weeks = days / 7;
    const candidates = Array.from(groups.entries())
      .map(([key, g]) => ({ merchantKey: key, ...g, perWeek: g.count / weeks }))
      .filter((g) => g.count >= 3 && g.perWeek >= 1);

    const withDisplay = await this.merchantAliasService.attachDisplayNames(userId, candidates.map((c) => ({ description: c.description })));
    const displayByDescription = new Map(withDisplay.map((r) => [r.description, r.displayDescription]));

    return candidates
      .map((c) => ({
        merchantKey: c.merchantKey,
        displayName: displayByDescription.get(c.description) ?? c.description,
        count: c.count,
        total: c.total,
        perWeek: c.perWeek,
        annualized: (c.total / days) * 365,
      }))
      .sort((a, b) => b.annualized - a.annualized);
  }

  private worstWeekday(byDay: PeriodStats['byDay']): number | null {
    const overCountByDow = Array(7).fill(0);
    for (const d of byDay) {
      if (d.budget > 0 && d.spendRoutine > d.budget) overCountByDow[wibDayOfWeek(startOfWibDay(d.date))]++;
    }
    const max = Math.max(...overCountByDow);
    return max > 0 ? overCountByDow.indexOf(max) : null;
  }

  private async buildDataQuality(userId: number, transactions: Transaction[]) {
    const spend = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const lainnyaTotal = transactions.filter((t) => t.category === Category.LAINNYA).reduce((sum, t) => sum + Number(t.amount), 0);
    const [pendingIncomeCount, unparsedEmailCount] = await Promise.all([
      this.prisma.income.count({ where: { userId, status: IncomeStatus.PENDING } }),
      this.prisma.emailParseLog.count({ where: { userId, status: ParseStatus.UNPARSED } }),
    ]);
    return { lainnyaPct: spend > 0 ? (lainnyaTotal / spend) * 100 : 0, pendingIncomeCount, unparsedEmailCount };
  }
}
