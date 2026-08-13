import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Category, Source } from '@prisma/client';
import { BalanceService } from '../balance/balance.service';

export interface ParsedTransaction {
  amount: number;
  description: string;
  source: Source;
  emailId: string;
  occurredAt: Date;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
  ) {}

  async findAll(params: { startDate?: string; endDate?: string; source?: Source; page?: number; limit?: number }) {
    const { startDate, endDate, source, page = 1, limit = 50 } = params;
    const where: any = {};
    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = new Date(startDate);
      if (endDate) where.occurredAt.lte = new Date(endDate);
    }
    if (source) where.source = source;

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getWeekly() {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Minggu
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay);
    startOfWeek.setHours(0, 0, 0, 0);

    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const budgetRow = await this.prisma.dailyBudget.findUnique({ where: { dayOfWeek: i } });
      const transactions = await this.prisma.transaction.findMany({
        where: { occurredAt: { gte: date, lt: nextDate } },
        orderBy: { occurredAt: 'asc' },
      });
      const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      days.push({
        date: date.toISOString().slice(0, 10),
        dayOfWeek: i,
        budget: budgetRow ? Number(budgetRow.amount) : 0,
        totalSpent,
        transactions,
      });
    }

    return { days };
  }

  /** Hapus transaksi expense dan balikin efeknya ke saldo bank dalam satu db transaction. */
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.transaction.delete({ where: { id } });
      await this.balanceService.adjustBalance(tx, deleted.source, Number(deleted.amount));
      return deleted;
    });
  }

  /** Catatan bebas dari user, terpisah dari data hasil parse email (amount/description/source read-only). */
  async updateNote(id: number, note: string) {
    return this.prisma.transaction.update({ where: { id }, data: { note } });
  }

  async updateCategory(id: number, category: Category) {
    return this.prisma.transaction.update({ where: { id }, data: { category } });
  }

  /** Semua transaksi di satu tanggal (YYYY-MM-DD) — buat drill-down dari chart bulanan/mingguan. */
  async getByDay(date: string) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T00:00:00`);
    end.setDate(end.getDate() + 1);

    const transactions = await this.prisma.transaction.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: 'asc' },
    });
    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    return { date, totalSpent, transactions };
  }

  /** Total, breakdown per kategori, dan breakdown per hari (buat chart) dalam satu bulan. */
  async getMonthly(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [transactions, byCategoryRaw] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { occurredAt: { gte: start, lt: end } },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.transaction.groupBy({
        by: ['category'],
        where: { occurredAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    const byCategory = byCategoryRaw
      .map((row) => ({ category: row.category, total: Number(row._sum.amount ?? 0) }))
      .sort((a, b) => b.total - a.total);

    const daysInMonth = new Date(year, month, 0).getDate();
    const byDayMap = new Map<string, number>();
    for (const t of transactions) {
      const key = t.occurredAt.toISOString().slice(0, 10);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + Number(t.amount));
    }
    const byDay = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month - 1, i + 1).toISOString().slice(0, 10);
      return { date, totalSpent: byDayMap.get(date) ?? 0 };
    });

    return { year, month, totalSpent, byCategory, byDay, transactions };
  }

  /** Total sepanjang waktu, breakdown per kategori, dan bulan tertinggi/terendah. */
  async getAllTimeSummary() {
    const [transactions, byCategoryRaw] = await Promise.all([
      this.prisma.transaction.findMany({ orderBy: { occurredAt: 'asc' } }),
      this.prisma.transaction.groupBy({ by: ['category'], _sum: { amount: true } }),
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    const byCategory = byCategoryRaw
      .map((row) => ({ category: row.category, total: Number(row._sum.amount ?? 0) }))
      .sort((a, b) => b.total - a.total);

    const byMonthMap = new Map<string, number>();
    for (const t of transactions) {
      const key = t.occurredAt.toISOString().slice(0, 7); // YYYY-MM
      byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + Number(t.amount));
    }

    let highestMonth: { month: string; total: number } | null = null;
    let lowestMonth: { month: string; total: number } | null = null;
    for (const [month, total] of byMonthMap) {
      if (!highestMonth || total > highestMonth.total) highestMonth = { month, total };
      if (!lowestMonth || total < lowestMonth.total) lowestMonth = { month, total };
    }

    return { totalSpent, byCategory, highestMonth, lowestMonth };
  }

  /** Dashboard analisis: trend minggu-ke-minggu, top merchant, breakdown kategori, pola per
   * hari-dalam-minggu (dipengaruhi `range`), dan kepatuhan budget 30 hari terakhir (tetap, tidak
   * terpengaruh `range`). Semua murni dari data yang sudah ada, tanpa panggilan eksternal apapun. */
  async getInsights(range: 'all' | '30d' = '30d') {
    const now = new Date();
    const rangeStart =
      range === 'all'
        ? (await this.prisma.transaction.aggregate({ _min: { occurredAt: true } }))._min.occurredAt ?? now
        : (() => {
            const d = new Date(now);
            d.setDate(now.getDate() - 29);
            d.setHours(0, 0, 0, 0);
            return d;
          })();
    const rangeWhere = { occurredAt: { gte: rangeStart, lte: now } };

    const [trend, topMerchantsRaw, categoryRaw, dayOfWeekTx, budgetAdherence] = await Promise.all([
      this.getWeekOverWeekTrend(),
      this.prisma.transaction.groupBy({
        by: ['description'],
        where: rangeWhere,
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      this.prisma.transaction.groupBy({ by: ['category'], where: rangeWhere, _sum: { amount: true } }),
      this.prisma.transaction.findMany({ where: rangeWhere, select: { amount: true, occurredAt: true } }),
      this.getBudgetAdherence(),
    ]);

    const topMerchants = topMerchantsRaw.map((row) => ({
      description: row.description,
      totalAmount: Number(row._sum.amount ?? 0),
      transactionCount: row._count._all,
    }));

    const categoryTotal = categoryRaw.reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
    const categoryBreakdown = Object.values(Category).map((category) => {
      const row = categoryRaw.find((r) => r.category === category);
      const totalAmount = row ? Number(row._sum.amount ?? 0) : 0;
      return { category, totalAmount, percentage: categoryTotal > 0 ? (totalAmount / categoryTotal) * 100 : 0 };
    });

    const weekdaySums = Array(7).fill(0);
    for (const t of dayOfWeekTx) weekdaySums[t.occurredAt.getDay()] += Number(t.amount);
    const weekdayCounts = this.countWeekdaysInRange(rangeStart, now);
    const spendByDayOfWeek = weekdaySums.map((sum, dayOfWeek) => ({
      dayOfWeek,
      averageAmount: weekdayCounts[dayOfWeek] > 0 ? sum / weekdayCounts[dayOfWeek] : 0,
    }));

    return { range, trend, topMerchants, categoryBreakdown, spendByDayOfWeek, budgetAdherence };
  }

  /** Total spend minggu berjalan (Senin-hari ini) vs minggu lalu penuh (Senin-Minggu). */
  private async getWeekOverWeekTrend() {
    const now = new Date();
    const daysSinceMonday = (now.getDay() + 6) % 7; // getDay(): 0=Minggu ... jadikan 0=Senin
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - daysSinceMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const [thisWeekTx, lastWeekTx] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { occurredAt: { gte: thisWeekStart, lte: now } },
        select: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { occurredAt: { gte: lastWeekStart, lt: thisWeekStart } },
        select: { amount: true },
      }),
    ]);

    const thisWeekTotal = thisWeekTx.reduce((sum, t) => sum + Number(t.amount), 0);
    const lastWeekTotal = lastWeekTx.reduce((sum, t) => sum + Number(t.amount), 0);
    const percentageChange =
      lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : thisWeekTotal > 0 ? 100 : 0;

    return { thisWeekTotal, lastWeekTotal, percentageChange };
  }

  /** Berapa dari 30 hari terakhir yang actual spend-nya melebihi DailyBudget hari itu. */
  private async getBudgetAdherence() {
    const totalDays = 30;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (totalDays - 1));
    start.setHours(0, 0, 0, 0);

    const [transactions, budgetRows] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { occurredAt: { gte: start } },
        select: { amount: true, occurredAt: true },
      }),
      this.prisma.dailyBudget.findMany(),
    ]);
    const budgetByDow = new Map(budgetRows.map((b) => [b.dayOfWeek, Number(b.amount)]));

    const spentByDate = new Map<string, number>();
    for (const t of transactions) {
      const key = t.occurredAt.toISOString().slice(0, 10);
      spentByDate.set(key, (spentByDate.get(key) ?? 0) + Number(t.amount));
    }

    let daysOverBudget = 0;
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const spent = spentByDate.get(date.toISOString().slice(0, 10)) ?? 0;
      const budget = budgetByDow.get(date.getDay()) ?? 0;
      if (spent > budget) daysOverBudget++;
    }

    return { totalDays, daysOverBudget, percentageOverBudget: (daysOverBudget / totalDays) * 100 };
  }

  /** Berapa kali tiap day-of-week (0=Minggu...6=Sabtu) muncul di kalender antara start-end, dipakai
   * sebagai pembagi buat rata-rata spendByDayOfWeek (bukan cuma dibagi jumlah transaksi). */
  private countWeekdaysInRange(start: Date, end: Date): number[] {
    const counts = Array(7).fill(0);
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (cur <= endDay) {
      counts[cur.getDay()]++;
      cur.setDate(cur.getDate() + 1);
    }
    return counts;
  }

  /** Dipanggil oleh Gmail sync service. Return null kalau sudah ada (deduplicated). Saldo bank
   * turun sebesar amount transaksi, dalam db transaction yang sama dengan create-nya. */
  async createFromParsed(parsed: ParsedTransaction) {
    const existing = await this.prisma.transaction.findUnique({ where: { emailId: parsed.emailId } });
    if (existing) return null;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          amount: parsed.amount,
          description: parsed.description,
          source: parsed.source,
          emailId: parsed.emailId,
          occurredAt: parsed.occurredAt,
        },
      });
      await this.balanceService.adjustBalance(tx, created.source, -Number(created.amount));
      return created;
    });
  }
}
