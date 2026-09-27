import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BalanceService } from '../balance/balance.service';
import { BudgetService } from '../budget/budget.service';
import { GoalService } from '../goal/goal.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { IncomeForecastService } from '../income-forecast/income-forecast.service';
import { wibDateKey, wibRange } from '../../common/wib';

const CACHE_MS = 5 * 60_000;
// Sama semangatnya dengan threshold di ai-anomaly.service.ts: heuristik sederhana, bukan model
// statistik proper — angka tetap di atas rata-rata pengeluaran harian Arzaka.
const BIG_PURCHASE_THRESHOLD = 500_000;

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function fmtRp(n: number): string {
  return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

function fmtDateShort(d: Date): string {
  const { year, month, day } = (() => {
    const key = wibDateKey(d);
    const [y, m, dd] = key.split('-').map(Number);
    return { year: y, month: m, day: dd };
  })();
  return `${day} ${MONTH_LABELS[month - 1]}`;
}

function fmtDayLong(d: Date): string {
  const key = wibDateKey(d);
  const [y, m, dd] = key.split('-').map(Number);
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay();
  return `${DAY_LABELS[dow]}, ${dd} ${MONTH_LABELS[m - 1]} ${y}`;
}

/**
 * Teks ringkas kondisi keuangan Arzaka HARI INI — disuntik ke system prompt tiap chat (blok [2]).
 * Deterministik penuh, nggak ada panggilan AI di sini; cache 5 menit karena dipanggil tiap pesan.
 */
@Injectable()
export class FinancialSnapshotService {
  private cache: { text: string; expiresAt: number } | null = null;

  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private budgetService: BudgetService,
    private goalService: GoalService,
    private subscriptionService: SubscriptionService,
    private incomeForecastService: IncomeForecastService,
  ) {}

  async getSnapshot(force = false): Promise<string> {
    if (!force && this.cache && this.cache.expiresAt > Date.now()) return this.cache.text;
    const text = await this.buildSnapshot();
    this.cache = { text, expiresAt: Date.now() + CACHE_MS };
    return text;
  }

  private async buildSnapshot(): Promise<string> {
    const now = new Date();
    const { start: weekStart, end: weekEnd } = wibRange('week', now);
    const { start: dayStart, end: dayEnd } = wibRange('day', now);

    const [
      balances,
      todaySummary,
      dailyBudgets,
      weekSpentAgg,
      bigPurchases,
      goals,
      upcomingSubs,
      weekForecast,
      pendingIncomeCount,
    ] = await Promise.all([
      this.balanceService.getAll(),
      this.budgetService.getTodaySummary(),
      this.prisma.dailyBudget.findMany(),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { occurredAt: { gte: weekStart, lt: weekEnd } },
      }),
      this.prisma.transaction.findMany({
        where: { occurredAt: { gte: new Date(now.getTime() - 30 * 86_400_000) }, amount: { gte: BIG_PURCHASE_THRESHOLD } },
        orderBy: { amount: 'desc' },
        take: 3,
      }),
      this.goalService.findAll(),
      this.subscriptionService.getUpcomingReminders(14),
      this.incomeForecastService.getWeekForecast(),
      this.prisma.income.count({ where: { status: 'PENDING' } }),
    ]);

    const lines: string[] = [];

    lines.push(`Hari ini: ${fmtDayLong(now)} (WIB). Minggu berjalan: ${fmtDateShort(weekStart)}–${fmtDateShort(new Date(weekEnd.getTime() - 86_400_000))}.`);

    const balanceParts = await Promise.all(
      balances.map(async (b) => {
        const adjustments = await this.balanceService.getAdjustments(b.source);
        const lastAdj = adjustments[0];
        return `${b.source} ${fmtRp(Number(b.balance))}${lastAdj ? ` (koreksi manual terakhir ${fmtDateShort(lastAdj.createdAt)})` : ''}`;
      }),
    );
    lines.push(`Saldo: ${balanceParts.join(' · ')}.`);

    const weekBudgetTarget = dailyBudgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const weekSpent = Number(weekSpentAgg._sum.amount ?? 0);
    const weekPct = weekBudgetTarget > 0 ? Math.round((weekSpent / weekBudgetTarget) * 100) : 0;
    lines.push(
      `Minggu ini: keluar ${fmtRp(weekSpent)} dari budget ${fmtRp(weekBudgetTarget)} (${weekPct}%). ` +
        `Hari ini ${fmtRp(todaySummary.totalSpent)} / ${fmtRp(todaySummary.budget)}.`,
    );

    if (bigPurchases.length > 0) {
      const parts = bigPurchases.map((t) => `${t.description} ${fmtRp(Number(t.amount))} (${fmtDateShort(t.occurredAt)})`);
      lines.push(`Pembelian besar 30 hari: ${parts.join(', ')}.`);
    }

    const scheduledUnfilled = weekForecast.streams.filter(
      (s) => s.kind !== 'IRREGULAR' && s.expected > 0 && (s.status === 'PENDING' || s.status === 'MISSED'),
    );
    lines.push(
      `Pemasukan minggu ini: tercatat ${fmtRp(weekForecast.totals.received)} dari perkiraan ${fmtRp(weekForecast.totals.expected)} ` +
        `(konservatif ${fmtRp(weekForecast.totals.conservative)}).` +
        (scheduledUnfilled.length > 0 ? ` Belum check-in: ${scheduledUnfilled.map((s) => s.name).join(', ')}.` : ''),
    );

    if (goals.length > 0) {
      const parts = goals.map(
        (g) =>
          `${g.name} ${fmtRp(g.currentAmount)}/${fmtRp(Number(g.targetAmount))}` +
          (g.targetDate ? `, target ${fmtDateShort(g.targetDate)}` : ', tanpa deadline'),
      );
      lines.push(`Goal: ${parts.join(' · ')}.`);
    }

    if (upcomingSubs.length > 0) {
      const parts = upcomingSubs.map((s: any) => `${s.name} ${fmtRp(Number(s.amount))} (${fmtDateShort(s.nextDueDate)})`);
      lines.push(`Langganan 14 hari ke depan: ${parts.join(', ')}.`);
    }

    if (pendingIncomeCount > 0) {
      lines.push(`Catatan data: ${pendingIncomeCount} pemasukan PENDING belum dikonfirmasi (halaman Pemasukan).`);
    }

    return lines.join('\n');
  }
}
