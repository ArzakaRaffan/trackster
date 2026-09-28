import { Injectable, Logger } from '@nestjs/common';
import { ReportPeriod } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AnalyticsService, PeriodStats } from '../analytics/analytics.service';
import { AiService } from '../ai/ai.service';
import { startOfWibDay, wibRange, wibDateKey, wibParts, startOfWibMonth } from '../../common/wib';

const NARRATIVE_PROMPT = `Kamu adalah Trackster AI - financial buddy personal Arzaka.
Tugas: Tulis ringkasan laporan periode (minggu atau bulan) keuangan Arzaka dalam Bahasa Indonesia santai, 3-5 kalimat.
Pakai HANYA angka dari data JSON yang diberikan (jangan mengarang angka). Sebut:
1. Satu hal yang bagus di periode ini
2. Satu hal yang perlu diperbaiki
3. Satu saran konkret buat periode berikutnya
Tidak perlu salam pembuka/penutup formal.`;

export interface ReportResult {
  period: 'week' | 'month';
  start: string;
  end: string;
  closed: boolean;
  stats: PeriodStats;
  narrative: string | null;
  generatedAt: string | null;
}

export interface MonthAggregate {
  month: string; // 'YYYY-MM'
  spend: number;
  spendRoutine: number;
  income: number;
  net: number;
  savingsRate: number | null;
  txCount: number;
  isLive: boolean; // true = bulan berjalan (tidak dari snapshot)
  narrative: string | null;
}

export interface AggregateReport {
  period: '6m' | 'all';
  months: MonthAggregate[];
  totals: {
    spend: number;
    income: number;
    net: number;
    avgMonthlySpend: number;
    avgMonthlyIncome: number;
  };
  dataStartsAt: string | null; // YYYY-MM-DD
  bestMonth: MonthAggregate | null; // lowest spend
  worstMonth: MonthAggregate | null; // highest spend
}

export interface RecordsResult {
  biggestTransaction: { id: number; amount: number; description: string; date: string; category: string } | null;
  mostVisitedMerchant: { merchantKey: string; displayName: string; count: number; total: number } | null;
  bestSavingsRateMonth: { month: string; savingsRate: number } | null;
  longestUnderBudgetStreak: number; // days
  totalTransactions: number;
  totalSpend: number;
  dataStartsAt: string | null;
}

function emptyAggregate(period: '6m' | 'all'): AggregateReport {
  return { period, months: [], totals: { spend: 0, income: 0, net: 0, avgMonthlySpend: 0, avgMonthlyIncome: 0 }, dataStartsAt: null, bestMonth: null, worstMonth: null };
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
    private aiService: AiService,
  ) {}

  /** `period`: 'week'|'month', `anchorDate` jatuh di dalam periode yang diminta.
   * Periode yang sudah tutup (end <= sekarang) dibaca/dibuat dari snapshot `PeriodReport`
   * (konsisten walau data berubah kemudian); periode berjalan selalu live dari PeriodStats. */
  async getReport(period: 'week' | 'month', anchorDate: Date): Promise<ReportResult> {
    const { start, end } = wibRange(period, anchorDate);
    const dbPeriod = period === 'week' ? ReportPeriod.WEEK : ReportPeriod.MONTH;

    if (end.getTime() <= Date.now()) {
      const saved = await this.getOrGenerate(dbPeriod, start, end);
      return {
        period,
        start: start.toISOString(),
        end: end.toISOString(),
        closed: true,
        stats: saved.stats as unknown as PeriodStats,
        narrative: saved.narrative,
        generatedAt: saved.generatedAt.toISOString(),
      };
    }

    const stats = await this.analyticsService.getPeriodStats(start, end);
    return { period, start: start.toISOString(), end: end.toISOString(), closed: false, stats, narrative: null, generatedAt: null };
  }

  private async getOrGenerate(period: ReportPeriod, start: Date, end: Date) {
    const existing = await this.prisma.periodReport.findUnique({
      where: { period_periodStart: { period, periodStart: start } },
    });
    if (existing) return existing;
    return this.closePeriod(period, start, end);
  }

  /** Hitung PeriodStats + narasi AI, simpan snapshot. Dipanggil cron tutup periode ATAU
   * lazy on-demand kalau ada yang buka laporan lama yang belum pernah di-tutup (backfill implisit). */
  async closePeriod(period: ReportPeriod, start: Date, end: Date) {
    const stats = await this.analyticsService.getPeriodStats(start, end);

    let narrative: string | null = null;
    try {
      const res = await this.aiService.chat({
        system: NARRATIVE_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(stats) }],
        maxTokens: 400,
      });
      narrative = res?.content?.trim() || null;
    } catch (err: any) {
      this.logger.error(`closePeriod narrative gagal (${period} ${start.toISOString()}): ${err?.message}`);
    }

    return this.prisma.periodReport.upsert({
      where: { period_periodStart: { period, periodStart: start } },
      update: { stats: stats as any, narrative },
      create: { period, periodStart: start, stats: stats as any, narrative },
    });
  }

  /** anchor = hari apapun di minggu/bulan LALU (relatif ke `now`), dipakai cron tutup periode. */
  lastClosedWeekAnchor(now: Date): Date {
    return startOfWibDay(new Date(now.getTime() - 86_400_000));
  }

  lastClosedMonthAnchor(now: Date): Date {
    return startOfWibDay(new Date(wibRange('month', now).start.getTime() - 86_400_000));
  }

  /** 6 Bulan: agregat dari 6 PeriodReport bulanan terakhir + bulan berjalan (live).
   * `anchorDate` = tanggal apapun di bulan terakhir yang mau ditampilkan (biasanya sekarang).
   * Return: byMonth[], totals (aggregate), dataStartsAt. */
  async getAggregate(period: '6m' | 'all', anchorDate: Date): Promise<AggregateReport> {
    const { year: anchorYear, month: anchorMonth } = wibParts(anchorDate);
    let months: { year: number; month: number }[] = [];

    if (period === '6m') {
      for (let i = 5; i >= 0; i--) {
        let m = anchorMonth - i;
        let y = anchorYear;
        while (m <= 0) { m += 12; y--; }
        months.push({ year: y, month: m });
      }
    } else {
      const first = await this.prisma.transaction.aggregate({ _min: { occurredAt: true } });
      if (!first._min.occurredAt) return emptyAggregate(period);
      const { year: fy, month: fm } = wibParts(first._min.occurredAt);
      let y = fy, m = fm;
      while (y < anchorYear || (y === anchorYear && m <= anchorMonth)) {
        months.push({ year: y, month: m });
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    const now = new Date();
    const { year: nowY, month: nowM } = wibParts(now);
    const monthAggregates: MonthAggregate[] = [];

    for (const { year, month } of months) {
      const start = startOfWibMonth(year, month);
      const end = month === 12 ? startOfWibMonth(year + 1, 1) : startOfWibMonth(year, month + 1);
      const isCurrentMonth = year === nowY && month === nowM;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      if (!isCurrentMonth) {
        const report = await this.getOrGenerate(ReportPeriod.MONTH, start, end);
        const stats = report.stats as unknown as PeriodStats;
        monthAggregates.push({
          month: monthKey,
          spend: stats.totals.spend,
          spendRoutine: stats.totals.spendRoutine,
          income: stats.totals.income,
          net: stats.totals.net,
          savingsRate: stats.totals.savingsRate,
          txCount: stats.totals.txCount,
          isLive: false,
          narrative: report.narrative,
        });
      } else {
        const stats = await this.analyticsService.getPeriodStats(start, end);
        monthAggregates.push({
          month: monthKey,
          spend: stats.totals.spend,
          spendRoutine: stats.totals.spendRoutine,
          income: stats.totals.income,
          net: stats.totals.net,
          savingsRate: stats.totals.savingsRate,
          txCount: stats.totals.txCount,
          isLive: true,
          narrative: null,
        });
      }
    }

    const withData = monthAggregates.filter(m => m.txCount > 0 || m.income > 0);

    const totals = {
      spend: withData.reduce((s, m) => s + m.spend, 0),
      income: withData.reduce((s, m) => s + m.income, 0),
      net: withData.reduce((s, m) => s + m.net, 0),
      avgMonthlySpend: withData.length ? withData.reduce((s, m) => s + m.spend, 0) / withData.length : 0,
      avgMonthlyIncome: withData.length ? withData.reduce((s, m) => s + m.income, 0) / withData.length : 0,
    };

    const first = await this.prisma.transaction.aggregate({ _min: { occurredAt: true } });
    const dataStartsAt = first._min.occurredAt ? wibDateKey(first._min.occurredAt) : null;

    const best = withData.length ? withData.reduce((a, b) => a.spend <= b.spend ? a : b) : null;
    const worst = withData.length ? withData.reduce((a, b) => a.spend >= b.spend ? a : b) : null;

    return { period, months: monthAggregates, totals, dataStartsAt, bestMonth: best, worstMonth: worst };
  }

  /** Rekor & milestone sepanjang waktu dari data PeriodReport + transaksi. */
  async getRecords(): Promise<RecordsResult> {
    const [biggestTx, totalAgg, first] = await Promise.all([
      this.prisma.transaction.findFirst({ orderBy: { amount: 'desc' }, select: { id: true, amount: true, description: true, occurredAt: true, category: true } }),
      this.prisma.transaction.aggregate({ _count: true, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ _min: { occurredAt: true } }),
    ]);

    const txAll = await this.prisma.transaction.findMany({ select: { merchantKey: true, description: true, amount: true } });
    const merchantGroups = new Map<string, { count: number; total: number; description: string }>();
    for (const t of txAll) {
      const key = t.merchantKey || t.description;
      const e = merchantGroups.get(key) ?? { count: 0, total: 0, description: t.description };
      e.count++;
      e.total += Number(t.amount);
      merchantGroups.set(key, e);
    }
    const topMerchantEntry = [...merchantGroups.entries()].sort((a, b) => b[1].count - a[1].count)[0];

    const closedMonths = await this.prisma.periodReport.findMany({ where: { period: ReportPeriod.MONTH }, orderBy: { periodStart: 'asc' } });
    let bestSavingsMonth: { month: string; savingsRate: number } | null = null;
    for (const r of closedMonths) {
      const stats = r.stats as any;
      if (stats?.totals?.savingsRate != null && stats.totals.savingsRate > (bestSavingsMonth?.savingsRate ?? -Infinity)) {
        const { year, month } = wibParts(r.periodStart);
        bestSavingsMonth = { month: `${year}-${String(month).padStart(2,'0')}`, savingsRate: stats.totals.savingsRate };
      }
    }

    return {
      biggestTransaction: biggestTx ? {
        id: biggestTx.id,
        amount: Number(biggestTx.amount),
        description: biggestTx.description,
        date: wibDateKey(biggestTx.occurredAt),
        category: biggestTx.category,
      } : null,
      mostVisitedMerchant: topMerchantEntry ? {
        merchantKey: topMerchantEntry[0],
        displayName: topMerchantEntry[1].description,
        count: topMerchantEntry[1].count,
        total: topMerchantEntry[1].total,
      } : null,
      bestSavingsRateMonth: bestSavingsMonth,
      longestUnderBudgetStreak: 0, // simplified for now
      totalTransactions: totalAgg._count,
      totalSpend: Number(totalAgg._sum.amount ?? 0),
      dataStartsAt: first._min.occurredAt ? wibDateKey(first._min.occurredAt) : null,
    };
  }

  async getDataExportRows(from: Date, to: Date) {
    return this.prisma.transaction.findMany({
      where: { occurredAt: { gte: from, lt: to } },
      orderBy: { occurredAt: 'desc' },
      select: { id: true, occurredAt: true, description: true, amount: true, category: true, source: true, note: true },
    });
  }
}
