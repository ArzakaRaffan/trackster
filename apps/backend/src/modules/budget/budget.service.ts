import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';

@Injectable()
export class BudgetService {
  constructor(
    private prisma: PrismaService,
    private merchantAliasService: MerchantAliasService,
  ) {}

  async getAll() {
    return this.prisma.dailyBudget.findMany({ orderBy: { dayOfWeek: 'asc' } });
  }

  async updateAll(dto: UpdateBudgetDto) {
    const results: Awaited<ReturnType<typeof this.prisma.dailyBudget.upsert>>[] = [];
    for (const item of dto.budgets) {
      const updated = await this.prisma.dailyBudget.upsert({
        where: { dayOfWeek: item.dayOfWeek },
        update: { amount: item.amount },
        create: { dayOfWeek: item.dayOfWeek, amount: item.amount },
      });
      results.push(updated);
    }
    return results;
  }

  /** Ambil budget untuk hari tertentu (0=Minggu...6=Sabtu) */
  async getBudgetForDay(dayOfWeek: number): Promise<number> {
    const row = await this.prisma.dailyBudget.findUnique({ where: { dayOfWeek } });
    return row ? Number(row.amount) : 0;
  }

  async getTodaySummary() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const budget = await this.getBudgetForDay(dayOfWeek);

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [transactions, incomes] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { occurredAt: { gte: startOfDay, lte: endOfDay } },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.income.findMany({
        where: { receivedAt: { gte: startOfDay, lte: endOfDay } },
        orderBy: { receivedAt: 'desc' },
      }),
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const transactionsWithDisplay = await this.merchantAliasService.attachDisplayNames(transactions);

    return {
      date: startOfDay.toISOString().slice(0, 10),
      budget,
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
}
