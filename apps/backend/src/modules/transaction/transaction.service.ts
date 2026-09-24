import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Category, Source } from '@prisma/client';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { addWibDays, startOfWibDay, startOfWibMonth, startOfWibWeek, wibDateKey, wibDayOfWeek } from '../../common/wib';

export interface ParsedTransaction {
  amount: number;
  description: string;
  source: Source;
  emailId: string;
  occurredAt: Date;
  category?: Category;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private merchantAliasService: MerchantAliasService,
  ) {}

  /** Tempel displayDescription (alias merchant kalau ada) ke tiap transaksi — satu query per
   * request, tidak per-transaksi. Lihat MerchantAliasService.attachDisplayNames untuk detail. */
  async attachDisplayNames<T extends { description: string }>(transactions: T[]) {
    return this.merchantAliasService.attachDisplayNames(transactions);
  }

  async findAll(params: {
    startDate?: string;
    endDate?: string;
    source?: Source;
    category?: Category;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { startDate, endDate, source, category, search, page = 1, limit = 50 } = params;
    const where: any = {};
    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = startOfWibDay(startDate);
      if (endDate) where.occurredAt.lt = addWibDays(startOfWibDay(endDate), 1);
    }
    if (source) where.source = source;
    if (category) where.category = category;

    if (search) {
      // Alias juga ikut dicari: transaksi dengan description mentah yang alias-nya cocok search
      // term ikut match, meskipun search term-nya tidak ada di description asli.
      const aliasedDescriptions = await this.merchantAliasService.findRawDescriptionsMatchingSearch(search);
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        ...(aliasedDescriptions.length > 0 ? [{ description: { in: aliasedDescriptions } }] : []),
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const dataWithDisplay = await this.attachDisplayNames(data);
    return { data: dataWithDisplay, total, page, limit };
  }

  async getWeekly() {
    const now = new Date();
    const currentDay = wibDayOfWeek(now); // 0=Minggu
    const startOfWeek = addWibDays(startOfWibDay(now), -currentDay);

    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addWibDays(startOfWeek, i);
      const nextDate = addWibDays(date, 1);

      const budgetRow = await this.prisma.dailyBudget.findUnique({ where: { dayOfWeek: i } });
      const transactions = await this.prisma.transaction.findMany({
        where: { occurredAt: { gte: date, lt: nextDate } },
        orderBy: { occurredAt: 'asc' },
      });
      const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      days.push({
        date: wibDateKey(date),
        dayOfWeek: i,
        budget: budgetRow ? Number(budgetRow.amount) : 0,
        totalSpent,
        transactions,
      });
    }

    // Satu query alias buat seluruh minggu (bukan per hari) — flatten lalu redistribusi balik
    // per hari sambil tetap menjaga urutan aslinya.
    const flatWithDisplay = await this.attachDisplayNames(days.flatMap((d) => d.transactions));
    let idx = 0;
    for (const day of days) {
      const count = day.transactions.length;
      day.transactions = flatWithDisplay.slice(idx, idx + count);
      idx += count;
    }

    return { days };
  }

  /** Hapus transaksi expense dan balikin efeknya ke saldo bank dalam satu db transaction —
   * kecuali transaksi ini lebih lama dari koreksi manual terakhir untuk source yang sama, karena
   * saldo koreksi manual itu sudah "menyerap" pengeluaran ini (sama aturannya dengan
   * createFromParsed). */
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.transaction.delete({ where: { id } });
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, deleted.source);
      if (shouldAdjustBalance(deleted.occurredAt, lastAdjustmentAt)) {
        await this.balanceService.adjustBalance(tx, deleted.source, Number(deleted.amount));
      } else {
        this.logger.debug(
          `Skip adjustBalance saat hapus transaksi ${deleted.id} (occurredAt ${deleted.occurredAt.toISOString()} < koreksi manual terakhir ${lastAdjustmentAt?.toISOString()})`,
        );
      }
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

  /** Shortcut buat set alias langsung dari baris transaksi: ambil description transaksi itu,
   * lalu upsert ke MerchantAlias pakai description tersebut sebagai rawDescription. Otomatis
   * berlaku ke SEMUA transaksi lama & baru yang description-nya sama, bukan cuma transaksi ini. */
  async setAlias(id: number, displayName: string) {
    const transaction = await this.prisma.transaction.findUniqueOrThrow({ where: { id } });
    return this.merchantAliasService.upsert(transaction.description, displayName);
  }

  /** Semua transaksi di satu tanggal (YYYY-MM-DD) — buat drill-down dari chart bulanan/mingguan. */
  async getByDay(date: string) {
    const start = startOfWibDay(date);
    const end = addWibDays(start, 1);

    const transactions = await this.prisma.transaction.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: 'asc' },
    });
    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionsWithDisplay = await this.attachDisplayNames(transactions);

    return { date, totalSpent, transactions: transactionsWithDisplay };
  }

  /** Total, breakdown per kategori, dan breakdown per hari (buat chart) dalam satu bulan. */
  async getMonthly(year: number, month: number) {
    const start = startOfWibMonth(year, month);
    const end = month === 12 ? startOfWibMonth(year + 1, 1) : startOfWibMonth(year, month + 1);

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

    const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    const byDayMap = new Map<string, number>();
    for (const t of transactions) {
      const key = wibDateKey(t.occurredAt);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + Number(t.amount));
    }
    const byDay = Array.from({ length: daysInMonth }, (_, i) => {
      const date = wibDateKey(addWibDays(start, i));
      return { date, totalSpent: byDayMap.get(date) ?? 0 };
    });

    const transactionsWithDisplay = await this.attachDisplayNames(transactions);
    return { year, month, totalSpent, byCategory, byDay, transactions: transactionsWithDisplay };
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
      const key = wibDateKey(t.occurredAt).slice(0, 7); // YYYY-MM (WIB)
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
        : addWibDays(startOfWibDay(now), -29);
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
    for (const t of dayOfWeekTx) weekdaySums[wibDayOfWeek(t.occurredAt)] += Number(t.amount);
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
    const thisWeekStart = startOfWibWeek(now);
    const lastWeekStart = addWibDays(thisWeekStart, -7);

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
    const start = addWibDays(startOfWibDay(now), -(totalDays - 1));

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
      const key = wibDateKey(t.occurredAt);
      spentByDate.set(key, (spentByDate.get(key) ?? 0) + Number(t.amount));
    }

    let daysOverBudget = 0;
    for (let i = 0; i < totalDays; i++) {
      const date = addWibDays(start, i);
      const spent = spentByDate.get(wibDateKey(date)) ?? 0;
      const budget = budgetByDow.get(wibDayOfWeek(date)) ?? 0;
      if (spent > budget) daysOverBudget++;
    }

    return { totalDays, daysOverBudget, percentageOverBudget: (daysOverBudget / totalDays) * 100 };
  }

  /** Berapa kali tiap day-of-week (0=Minggu...6=Sabtu) muncul di kalender antara start-end, dipakai
   * sebagai pembagi buat rata-rata spendByDayOfWeek (bukan cuma dibagi jumlah transaksi). */
  private countWeekdaysInRange(start: Date, end: Date): number[] {
    const counts = Array(7).fill(0);
    let cur = startOfWibDay(start);
    const endDay = startOfWibDay(end);
    while (cur <= endDay) {
      counts[wibDayOfWeek(cur)]++;
      cur = addWibDays(cur, 1);
    }
    return counts;
  }

  /** Input manual dari user (bukan hasil parse email) — dipakai buat pengeluaran yang nggak
   * kena notifikasi bank (tunai, dll). emailId disintesis karena kolomnya unique non-null. */
  async create(dto: CreateTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          amount: dto.amount,
          description: dto.description,
          source: dto.source,
          category: dto.category,
          occurredAt: new Date(dto.occurredAt),
          emailId: `manual:${randomUUID()}`,
          isManual: true,
        },
      });
      await this.balanceService.adjustBalance(tx, created.source, -Number(created.amount));
      return created;
    });
  }

  /** Dipanggil oleh Gmail sync service. Return null kalau sudah ada (deduplicated). Saldo bank
   * turun sebesar amount transaksi, dalam db transaction yang sama dengan create-nya — kecuali
   * transaksi ini lebih lama dari koreksi manual terakhir untuk source yang sama, karena koreksi
   * manual = snapshot saldo asli bank yang sudah mencakup transaksi itu (backfill tidak boleh
   * double-count). */
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
          ...(parsed.category ? { category: parsed.category } : {}),
        },
      });
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, created.source);
      if (shouldAdjustBalance(created.occurredAt, lastAdjustmentAt)) {
        await this.balanceService.adjustBalance(tx, created.source, -Number(created.amount));
      } else {
        this.logger.debug(
          `Skip adjustBalance utk transaksi ${created.id} (occurredAt ${created.occurredAt.toISOString()} < koreksi manual terakhir ${lastAdjustmentAt?.toISOString()})`,
        );
      }
      return created;
    });
  }

  /** Deteksi langganan berulang (Subscription Detector).
   *  Heuristic: group transaksi 90 hari terakhir by description, variance amount <= 10%,
   *  gap antar occurredAt berurutan 27-33 hari. */
  async getSubscriptions() {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const transactions = await this.prisma.transaction.findMany({
      where: { occurredAt: { gte: ninetyDaysAgo, lte: now } },
      orderBy: { occurredAt: 'asc' },
      select: { description: true, amount: true, occurredAt: true },
    });

    const groups = new Map<string, Array<{ amount: number; occurredAt: Date; rawDesc: string }>>();
    for (const tx of transactions) {
      const key = tx.description.trim().toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({
        amount: Number(tx.amount),
        occurredAt: tx.occurredAt,
        rawDesc: tx.description,
      });
    }

    const subscriptions: Array<{
      description: string;
      averageAmount: number;
      occurrenceCount: number;
      estimatedMonthlyBurn: number;
      lastSeenAt: string;
    }> = [];

    for (const [, items] of groups) {
      if (items.length < 2) continue;

      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
      const avgAmount = totalAmount / items.length;

      const amountMatches = items.every((item) => Math.abs(item.amount - avgAmount) <= 0.1 * avgAmount);
      if (!amountMatches) continue;

      let intervalsMatch = true;
      for (let i = 1; i < items.length; i++) {
        const diffMs = items[i].occurredAt.getTime() - items[i - 1].occurredAt.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays < 27 || diffDays > 34) {
          intervalsMatch = false;
          break;
        }
      }

      if (intervalsMatch) {
        const lastSeen = items[items.length - 1];
        subscriptions.push({
          description: lastSeen.rawDesc,
          averageAmount: Math.round(avgAmount),
          occurrenceCount: items.length,
          estimatedMonthlyBurn: Math.round(avgAmount),
          lastSeenAt: lastSeen.occurredAt.toISOString(),
        });
      }
    }

    return this.attachDisplayNames(subscriptions);
  }

}
