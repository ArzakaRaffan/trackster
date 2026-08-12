import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

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

    const transactions = await this.prisma.transaction.findMany({
      where: { occurredAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { occurredAt: 'desc' },
    });

    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      date: startOfDay.toISOString().slice(0, 10),
      budget,
      totalSpent,
      remaining: budget - totalSpent,
      isOverBudget: totalSpent > budget,
      transactions,
    };
  }
}
