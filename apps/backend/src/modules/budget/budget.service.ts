import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { addWibDays, startOfWibDay, startOfWibWeek, wibDateKey, wibDayOfWeek, wibRange } from '../../common/wib';
import { calcRollover } from './budget-rollover';
import { spend, sumSpend } from '../../common/spend';

@Injectable()
export class BudgetService {
  constructor(
    private prisma: PrismaService,
    private merchantAliasService: MerchantAliasService,
  ) {}

  async getAll(userId: number) {
    return this.prisma.dailyBudget.findMany({ where: { userId }, orderBy: { dayOfWeek: 'asc' } });
  }

  async updateAll(userId: number, dto: UpdateBudgetDto) {
    const results: Awaited<ReturnType<typeof this.prisma.dailyBudget.create>>[] = [];
    for (const item of dto.budgets) {
      // findFirst + updateMany/create (bukan upsert by `dayOfWeek`): unik masih global sampai C1 -> (userId, dayOfWeek).
      const row = await this.prisma.dailyBudget.findFirst({ where: { userId, dayOfWeek: item.dayOfWeek }, select: { id: true } });
      if (row) {
        await this.prisma.dailyBudget.updateMany({ where: { id: row.id, userId }, data: { amount: item.amount } });
        results.push(await this.prisma.dailyBudget.findFirstOrThrow({ where: { id: row.id, userId } }));
      } else {
        results.push(await this.prisma.dailyBudget.create({ data: { userId, dayOfWeek: item.dayOfWeek, amount: item.amount } }));
      }
    }
    return results;
  }

  /** Ambil budget untuk hari tertentu (0=Minggu...6=Sabtu) */
  async getBudgetForDay(userId: number, dayOfWeek: number): Promise<number> {
    const row = await this.prisma.dailyBudget.findFirst({ where: { userId, dayOfWeek } });
    return row ? Number(row.amount) : 0;
  }

  async getRolloverEnabled(userId: number): Promise<boolean> {
    const row = await this.prisma.budgetSetting.findFirst({ where: { userId } });
    return row?.rolloverEnabled ?? false;
  }

  async setRolloverEnabled(userId: number, enabled: boolean) {
    // Satu baris per user (bukan lagi singleton id=1); unik `userId` dipasang di C1.
    const existing = await this.prisma.budgetSetting.findFirst({ where: { userId }, select: { id: true } });
    if (existing) {
      await this.prisma.budgetSetting.updateMany({ where: { id: existing.id, userId }, data: { rolloverEnabled: enabled } });
    } else {
      await this.prisma.budgetSetting.create({ data: { userId, rolloverEnabled: enabled } });
    }
    return { rolloverEnabled: enabled };
  }

  /** Sisa budget Senin..kemarin (minggu berjalan) yang belum terpakai — 0 di hari Senin. */
  private async computeRollover(userId: number, now: Date): Promise<number> {
    const weekStart = startOfWibWeek(now);
    const todayStart = startOfWibDay(now);
    if (weekStart.getTime() === todayStart.getTime()) return 0;

    const [rows, txs] = await Promise.all([
      this.prisma.dailyBudget.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: weekStart, lt: todayStart } },
        select: { amount: true, reimbursedAmount: true, occurredAt: true },
      }),
    ]);
    const budgetByDow = new Map(rows.map((r) => [r.dayOfWeek, Number(r.amount)]));
    const spentByDay = new Map<string, number>();
    for (const t of txs) {
      const key = wibDateKey(t.occurredAt);
      spentByDay.set(key, (spentByDay.get(key) ?? 0) + spend(t));
    }

    const days: { budget: number; spent: number }[] = [];
    for (let d = weekStart; d < todayStart; d = addWibDays(d, 1)) {
      days.push({ budget: budgetByDow.get(wibDayOfWeek(d)) ?? 0, spent: spentByDay.get(wibDateKey(d)) ?? 0 });
    }
    return calcRollover(days);
  }

  async getTodaySummary(userId: number) {
    const now = new Date();
    const dayOfWeek = wibDayOfWeek(now);
    const baseBudget = await this.getBudgetForDay(userId, dayOfWeek);
    // `budget` = budget efektif hari ini (termasuk sisa kemarin kalau rollover aktif), supaya semua
    // pemakai summary (alert over-budget, progress bar, snapshot AI) otomatis konsisten.
    const rollover = (await this.getRolloverEnabled(userId)) ? await this.computeRollover(userId, now) : 0;
    const budget = baseBudget + rollover;

    const { start: startOfDay, end: endOfDay } = wibRange('day', now);

    const [transactions, incomes] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: startOfDay, lt: endOfDay } },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.income.findMany({
        where: { userId, receivedAt: { gte: startOfDay, lt: endOfDay } },
        orderBy: { receivedAt: 'desc' },
      }),
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + spend(t), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const transactionsWithDisplay = await this.merchantAliasService.attachDisplayNames(userId, transactions);

    return {
      date: wibDateKey(now),
      budget,
      baseBudget,
      rollover,
      totalSpent,
      remaining: budget - totalSpent,
      isOverBudget: totalSpent > budget,
      totalIncome,
      netAmount: totalIncome - totalSpent,
      isNetPositive: totalIncome - totalSpent >= 0,
      transactions: transactionsWithDisplay,
      incomes,
    };
  }

  /** Runway forecast: estimasi kondisi keuangan akhir bulan berdasarkan burn rate 7 hari terakhir.
   *  Tidak butuh LLM — murni kalkulasi deterministik. */
  async getRunwayForecast(userId: number) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Burn rate: rata-rata pengeluaran per hari dalam 7 hari terakhir
    const spentAgg = await this.prisma.transaction.aggregate({
      _sum: { amount: true, reimbursedAmount: true },
      where: { userId, occurredAt: { gte: sevenDaysAgo, lte: now } },
    });
    const totalSpent7d = sumSpend(spentAgg._sum);
    const burnRatePerDay = totalSpent7d / 7;

    // Sisa hari di bulan ini (kalender WIB)
    const { start: monthStart, end: monthEnd } = wibRange('month', now);
    const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
    const dayOfMonth = Math.round((wibRange('day', now).start.getTime() - monthStart.getTime()) / 86_400_000) + 1;
    const remainingDays = daysInMonth - dayOfMonth;

    // Saldo BCA + Jago saat ini
    const balances = await this.prisma.bankBalance.findMany({ where: { userId } });
    const currentBalance = balances.reduce((sum, b) => sum + Number(b.balance), 0);

    const projectedEndOfMonthBalance = currentBalance - burnRatePerDay * remainingDays;
    const isProjectedShortfall = projectedEndOfMonthBalance < 0;

    return {
      burnRatePerDay: Math.round(burnRatePerDay),
      currentBalance: Math.round(currentBalance),
      remainingDays,
      projectedEndOfMonthBalance: Math.round(projectedEndOfMonthBalance),
      isProjectedShortfall,
    };
  }

}
