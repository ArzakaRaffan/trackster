import { randomUUID } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Category, Prisma, Source } from '@prisma/client';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { spend, sumSpend } from '../../common/spend';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { addWibDays, startOfWibDay, startOfWibMonth, startOfWibWeek, wibDateKey, wibDayOfWeek } from '../../common/wib';
import { merchantKey } from '../../common/merchant-key';

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
    private analyticsService: AnalyticsService,
  ) {}

  /** Tempel displayDescription (alias merchant kalau ada) ke tiap transaksi — satu query per
   * request, tidak per-transaksi. Lihat MerchantAliasService.attachDisplayNames untuk detail. */
  async attachDisplayNames<T extends { description: string }>(userId: number, transactions: T[]) {
    return this.merchantAliasService.attachDisplayNames(userId, transactions);
  }

  /** Transaksi milik user, atau 404 (tidak membedakan "tidak ada" vs "milik orang lain" — tak ada IDOR). */
  private async own(userId: number, id: number) {
    const t = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!t) throw new NotFoundException('Transaksi tidak ditemukan');
    return t;
  }

  /** updateMany ber-userId lalu baca ulang (tak ada update-by-id polos). */
  private async patch(userId: number, id: number, data: Prisma.TransactionUpdateManyMutationInput) {
    const { count } = await this.prisma.transaction.updateMany({ where: { id, userId }, data });
    if (count === 0) throw new NotFoundException('Transaksi tidak ditemukan');
    return this.prisma.transaction.findFirstOrThrow({ where: { id, userId } });
  }

  async findAll(userId: number, params: {
    startDate?: string;
    endDate?: string;
    source?: Source;
    category?: Category;
    search?: string;
    minAmount?: number;
    page?: number;
    limit?: number;
  }) {
    const { startDate, endDate, source, category, search, minAmount, page = 1, limit = 50 } = params;
    const where: any = { userId };
    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = startOfWibDay(startDate);
      if (endDate) where.occurredAt.lt = addWibDays(startOfWibDay(endDate), 1);
    }
    if (source) where.source = source;
    if (category) where.category = category;
    if (minAmount != null) where.amount = { gte: minAmount };

    if (search) {
      // Alias juga ikut dicari: transaksi dengan description mentah yang alias-nya cocok search
      // term ikut match, meskipun search term-nya tidak ada di description asli.
      const aliasedDescriptions = await this.merchantAliasService.findRawDescriptionsMatchingSearch(userId, search);
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        ...(aliasedDescriptions.length > 0 ? [{ description: { in: aliasedDescriptions } }] : []),
      ];
    }

    const [data, total] = await Promise.all([
      // tenancy-ok: `where` diawali { userId } di atas
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      // tenancy-ok: `where` diawali { userId } di atas
      this.prisma.transaction.count({ where }),
    ]);

    const dataWithDisplay = await this.attachDisplayNames(userId, data);
    return { data: dataWithDisplay, total, page, limit };
  }

  async getWeekly(userId: number) {
    const now = new Date();
    const startOfWeek = startOfWibWeek(now); // Senin 00:00 WIB

    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addWibDays(startOfWeek, i);
      const nextDate = addWibDays(date, 1);

      const dayOfWeek = wibDayOfWeek(date); // Senin..Minggu = 1..6,0
      const budgetRow = await this.prisma.dailyBudget.findFirst({ where: { userId, dayOfWeek } });
      const transactions = await this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: date, lt: nextDate } },
        orderBy: { occurredAt: 'asc' },
      });
      const totalSpent = transactions.reduce((sum, t) => sum + spend(t), 0);

      days.push({
        date: wibDateKey(date),
        dayOfWeek,
        budget: budgetRow ? Number(budgetRow.amount) : 0,
        totalSpent,
        transactions,
      });
    }

    // Satu query alias buat seluruh minggu (bukan per hari) — flatten lalu redistribusi balik
    // per hari sambil tetap menjaga urutan aslinya.
    const flatWithDisplay = await this.attachDisplayNames(userId, days.flatMap((d) => d.transactions));
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
  async remove(userId: number, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.transaction.findFirst({ where: { id, userId } });
      if (!deleted) throw new NotFoundException('Transaksi tidak ditemukan');
      // Reimbursement ikut terhapus (cascade) — balikkan dulu saldo dari patungan yang sudah diterima.
      const received = await tx.reimbursement.findMany({
        where: { userId, transactionId: id, status: 'RECEIVED', balanceApplied: true },
      });
      for (const r of received) {
        if (r.receivedSource) await this.balanceService.adjustBalance(tx, userId, r.receivedSource, -Number(r.amount));
      }
      await tx.transaction.deleteMany({ where: { id, userId } });
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, userId, deleted.source);
      if (shouldAdjustBalance(deleted.occurredAt, lastAdjustmentAt)) {
        await this.balanceService.adjustBalance(tx, userId, deleted.source, Number(deleted.amount));
      } else {
        this.logger.debug(
          `Skip adjustBalance saat hapus transaksi ${deleted.id} (occurredAt ${deleted.occurredAt.toISOString()} < koreksi manual terakhir ${lastAdjustmentAt?.toISOString()})`,
        );
      }
      return deleted;
    });
  }

  /** Catatan bebas dari user, terpisah dari data hasil parse email (amount/description/source read-only). */
  async updateNote(userId: number, id: number, note: string) {
    return this.patch(userId, id, { note });
  }

  async updateCategory(userId: number, id: number, category: Category) {
    return this.patch(userId, id, { category });
  }

  /** Kolom `merchantKey` ditambah lewat migrasi tanpa backfill (lihat Gotchas.md) — transaksi lama
   * masih NULL, jadi `where: { merchantKey: key }` doang selalu 0 match buat mereka. Recompute
   * `merchantKey(description)` di JS buat baris yang NULL supaya tetap ke-match, lalu WHERE gabung
   * keduanya. Dipakai `updateCategoryForAll` & `countSameMerchant` biar dua-duanya konsisten. */
  private async merchantMatchWhere(userId: number, key: string): Promise<Prisma.TransactionWhereInput> {
    const nullKeyRows = await this.prisma.transaction.findMany({
      where: { userId, merchantKey: null },
      select: { id: true, description: true },
    });
    const matchedNullIds = nullKeyRows.filter((t) => merchantKey(t.description) === key).map((t) => t.id);
    return { userId, OR: [{ merchantKey: key }, { id: { in: matchedNullIds } }] };
  }

  /** "Terapkan ke semua transaksi <merchant>?" — simpan rule kategori (MerchantAlias, dipakai
   * sync berikutnya) DAN update semua transaksi lama dengan merchantKey yang sama sekarang juga.
   * Sekalian backfill kolom `merchantKey` transaksi lama yang match, biar match langsung lain kali. */
  async updateCategoryForAll(userId: number, id: number, category: Category) {
    const transaction = await this.own(userId, id);
    const key = merchantKey(transaction.description);

    await this.merchantAliasService.upsertCategory(userId, transaction.description, category);
    const where = await this.merchantMatchWhere(userId, key);
    // tenancy-ok: `where` dari merchantMatchWhere(userId, ...) memuat userId
    const result = await this.prisma.transaction.updateMany({ where, data: { category, merchantKey: key } });
    return { updated: result.count };
  }

  /** Berapa transaksi lain yang bakal ikut ke-update kalau user pilih "terapkan ke semua". */
  async countSameMerchant(userId: number, id: number): Promise<number> {
    const transaction = await this.own(userId, id);
    const key = merchantKey(transaction.description);
    const where = await this.merchantMatchWhere(userId, key);
    // tenancy-ok: `where` dari merchantMatchWhere(userId, ...) memuat userId
    return this.prisma.transaction.count({ where });
  }

  /** Halaman "Rapikan kategori": semua transaksi LAINNYA dikelompokkan per merchantKey, diurut
   * dari nominal terbesar. `representativeId` dipakai frontend buat manggil
   * PATCH /transactions/:id/category?applyToAll kalau user terima saran. */
  async getUncategorizedMerchants(userId: number) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, category: Category.LAINNYA },
      select: { id: true, description: true, amount: true, reimbursedAmount: true, merchantKey: true },
      orderBy: { occurredAt: 'desc' },
    });

    const groups = new Map<
      string,
      { representativeId: number; description: string; count: number; totalAmount: number }
    >();
    for (const t of transactions) {
      const key = t.merchantKey || merchantKey(t.description);
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
        existing.totalAmount += spend(t);
      } else {
        groups.set(key, { representativeId: t.id, description: t.description, count: 1, totalAmount: spend(t) });
      }
    }

    return Array.from(groups.entries())
      .map(([merchantKeyValue, g]) => ({ merchantKey: merchantKeyValue, ...g }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /** Shortcut buat set alias langsung dari baris transaksi: ambil description transaksi itu,
   * lalu upsert ke MerchantAlias pakai description tersebut sebagai rawDescription. Otomatis
   * berlaku ke SEMUA transaksi lama & baru yang description-nya sama, bukan cuma transaksi ini. */
  async setAlias(userId: number, id: number, displayName: string) {
    const transaction = await this.own(userId, id);
    return this.merchantAliasService.upsert(userId, transaction.description, displayName);
  }

  /** Override manual "pembelian besar" (`Transaction.isBig`) — `null` balik ke aturan otomatis di `AnalyticsService`. */
  async setBig(userId: number, id: number, isBig: boolean | null) {
    return this.patch(userId, id, { isBig });
  }

  /** Semua transaksi di satu tanggal (YYYY-MM-DD) — buat drill-down dari chart bulanan/mingguan. */
  async getByDay(userId: number, date: string) {
    const start = startOfWibDay(date);
    const end = addWibDays(start, 1);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: 'asc' },
    });
    const totalSpent = transactions.reduce((sum, t) => sum + spend(t), 0);
    const transactionsWithDisplay = await this.attachDisplayNames(userId, transactions);

    return { date, totalSpent, transactions: transactionsWithDisplay };
  }

  /** Total, breakdown per kategori, dan breakdown per hari (buat chart) dalam satu bulan. */
  async getMonthly(userId: number, year: number, month: number) {
    const start = startOfWibMonth(year, month);
    const end = month === 12 ? startOfWibMonth(year + 1, 1) : startOfWibMonth(year, month + 1);

    const [transactions, byCategoryRaw] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: start, lt: end } },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.transaction.groupBy({
        by: ['category'],
        where: { userId, occurredAt: { gte: start, lt: end } },
        _sum: { amount: true, reimbursedAmount: true },
      }),
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + spend(t), 0);

    const byCategory = byCategoryRaw
      .map((row) => ({ category: row.category, total: sumSpend(row._sum) }))
      .sort((a, b) => b.total - a.total);

    const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    const byDayMap = new Map<string, number>();
    for (const t of transactions) {
      const key = wibDateKey(t.occurredAt);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + spend(t));
    }
    const byDay = Array.from({ length: daysInMonth }, (_, i) => {
      const date = wibDateKey(addWibDays(start, i));
      return { date, totalSpent: byDayMap.get(date) ?? 0 };
    });

    const transactionsWithDisplay = await this.attachDisplayNames(userId, transactions);
    return { year, month, totalSpent, byCategory, byDay, transactions: transactionsWithDisplay };
  }

  /** Total sepanjang waktu, breakdown per kategori, dan bulan tertinggi/terendah. */
  async getAllTimeSummary(userId: number) {
    const [transactions, byCategoryRaw] = await Promise.all([
      this.prisma.transaction.findMany({ where: { userId }, orderBy: { occurredAt: 'asc' } }),
      this.prisma.transaction.groupBy({ by: ['category'], where: { userId }, _sum: { amount: true, reimbursedAmount: true } }),
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + spend(t), 0);

    const byCategory = byCategoryRaw
      .map((row) => ({ category: row.category, total: sumSpend(row._sum) }))
      .sort((a, b) => b.total - a.total);

    const byMonthMap = new Map<string, number>();
    for (const t of transactions) {
      const key = wibDateKey(t.occurredAt).slice(0, 7); // YYYY-MM (WIB)
      byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + spend(t));
    }

    let highestMonth: { month: string; total: number } | null = null;
    let lowestMonth: { month: string; total: number } | null = null;
    for (const [month, total] of byMonthMap) {
      if (!highestMonth || total > highestMonth.total) highestMonth = { month, total };
      if (!lowestMonth || total < lowestMonth.total) lowestMonth = { month, total };
    }

    return { totalSpent, byCategory, highestMonth, lowestMonth };
  }

  /** Wrapper tipis di atas `AnalyticsService.getPeriodStats` (E06-S1) — dipertahankan buat
   * caller lama (mascot, weekly report, health score) yang belum pindah ke `/analytics/stats`
   * langsung. Bentuk field ('trend', 'topMerchants', dst) sengaja dipertahankan sama supaya
   * caller itu tidak perlu diubah. Jangan tambah logika baru di sini — tambahkan di PeriodStats. */
  async getInsights(userId: number, range: 'all' | '30d' = '30d') {
    const now = new Date();
    const end = addWibDays(startOfWibDay(now), 1);
    const start =
      range === 'all'
        ? startOfWibDay((await this.prisma.transaction.aggregate({ where: { userId }, _min: { occurredAt: true } }))._min.occurredAt ?? now)
        : addWibDays(end, -30);

    const [stats, thisWeekTx, lastWeekTx] = await Promise.all([
      this.analyticsService.getPeriodStats(userId, start, end, false),
      this.prisma.transaction.findMany({ where: { userId, occurredAt: { gte: startOfWibWeek(now), lte: now } }, select: { amount: true, reimbursedAmount: true } }),
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: addWibDays(startOfWibWeek(now), -7), lt: startOfWibWeek(now) } },
        select: { amount: true, reimbursedAmount: true },
      }),
    ]);

    const thisWeekTotal = thisWeekTx.reduce((sum, t) => sum + spend(t), 0);
    const lastWeekTotal = lastWeekTx.reduce((sum, t) => sum + spend(t), 0);
    const trend = {
      thisWeekTotal,
      lastWeekTotal,
      percentageChange: lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : thisWeekTotal > 0 ? 100 : 0,
    };

    const topMerchants = stats.byMerchant.slice(0, 5).map((m) => ({
      description: m.displayName,
      totalAmount: m.total,
      transactionCount: m.count,
    }));
    const categoryTotal = stats.byCategory.reduce((sum, c) => sum + c.total, 0);
    const categoryBreakdown = Object.values(Category).map((category) => {
      const row = stats.byCategory.find((c) => c.category === category);
      const totalAmount = row?.total ?? 0;
      return { category, totalAmount, percentage: categoryTotal > 0 ? (totalAmount / categoryTotal) * 100 : 0 };
    });
    const spendByDayOfWeek = stats.byWeekday.map((w) => ({ dayOfWeek: w.dayOfWeek, averageAmount: w.avgRoutine }));
    const budgetAdherence = {
      totalDays: stats.budget.daysWithBudget,
      daysOverBudget: stats.budget.daysOver,
      percentageOverBudget: stats.budget.daysWithBudget > 0 ? (stats.budget.daysOver / stats.budget.daysWithBudget) * 100 : 0,
    };

    return { range, trend, topMerchants, categoryBreakdown, spendByDayOfWeek, budgetAdherence };
  }

  /** Input manual dari user (bukan hasil parse email) — dipakai buat pengeluaran yang nggak
   * kena notifikasi bank (tunai, dll). emailId disintesis karena kolomnya unique non-null. */
  async create(userId: number, dto: CreateTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          amount: dto.amount,
          description: dto.description,
          source: dto.source,
          category: dto.category,
          occurredAt: new Date(dto.occurredAt),
          emailId: `manual:${randomUUID()}`,
          isManual: true,
          merchantKey: merchantKey(dto.description),
        },
      });
      await this.balanceService.adjustBalance(tx, userId, created.source, -Number(created.amount));
      return created;
    });
  }

  /** Dipanggil oleh Gmail sync service. Return null kalau sudah ada (deduplicated). Saldo bank
   * turun sebesar amount transaksi, dalam db transaction yang sama dengan create-nya — kecuali
   * transaksi ini lebih lama dari koreksi manual terakhir untuk source yang sama, karena koreksi
   * manual = snapshot saldo asli bank yang sudah mencakup transaksi itu (backfill tidak boleh
   * double-count). */
  async createFromParsed(userId: number, parsed: ParsedTransaction) {
    // Dedup per user; unik DB masih global (emailId) sampai C1 -> (userId, emailId).
    const existing = await this.prisma.transaction.findFirst({ where: { userId, emailId: parsed.emailId } });
    if (existing) return null;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          amount: parsed.amount,
          description: parsed.description,
          source: parsed.source,
          emailId: parsed.emailId,
          occurredAt: parsed.occurredAt,
          merchantKey: merchantKey(parsed.description),
          ...(parsed.category ? { category: parsed.category } : {}),
        },
      });
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, userId, created.source);
      if (shouldAdjustBalance(created.occurredAt, lastAdjustmentAt)) {
        await this.balanceService.adjustBalance(tx, userId, created.source, -Number(created.amount));
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
  async getSubscriptions(userId: number) {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: ninetyDaysAgo, lte: now } },
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

    return this.attachDisplayNames(userId, subscriptions);
  }

}
