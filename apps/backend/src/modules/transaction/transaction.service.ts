import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Source } from '@prisma/client';

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

  constructor(private prisma: PrismaService) {}

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

  async remove(id: number) {
    return this.prisma.transaction.delete({ where: { id } });
  }

  /** Dipanggil oleh Gmail sync service. Return null kalau sudah ada (deduplicated). */
  async createFromParsed(parsed: ParsedTransaction) {
    const existing = await this.prisma.transaction.findUnique({ where: { emailId: parsed.emailId } });
    if (existing) return null;

    this.logger.debug(
      `DEBUG parsed transaction -> amount: ${parsed.amount}, description: "${parsed.description}", source: ${parsed.source}, occurredAt: ${parsed.occurredAt}`,
    );

    return this.prisma.transaction.create({
      data: {
        amount: parsed.amount,
        description: parsed.description,
        source: parsed.source,
        emailId: parsed.emailId,
        occurredAt: parsed.occurredAt,
      },
    });
  }
}
