import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';

@Injectable()
export class GoalService {
  constructor(private prisma: PrismaService) {}

  /** List goal aktif (belum di-archive) + currentAmount teragregasi dari contributions */
  async findAll() {
    const goals = await this.prisma.goal.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const goalsWithAmount = await Promise.all(
      goals.map(async (goal) => {
        const agg = await this.prisma.goalContribution.aggregate({
          where: { goalId: goal.id },
          _sum: { amount: true },
        });
        const currentAmount = Number(agg._sum.amount ?? 0);
        const progress =
          Number(goal.targetAmount) > 0
            ? Math.min(100, (currentAmount / Number(goal.targetAmount)) * 100)
            : 0;
        return { ...goal, currentAmount, progress };
      }),
    );

    return goalsWithAmount;
  }

  async create(dto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: {
        name: dto.name,
        targetAmount: dto.targetAmount,
        ...(dto.targetDate ? { targetDate: new Date(dto.targetDate) } : {}),
      },
    });
  }

  async contribute(goalId: number, dto: ContributeGoalDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, archivedAt: null },
    });
    if (!goal) throw new NotFoundException(`Goal ${goalId} tidak ditemukan`);

    return this.prisma.goalContribution.create({
      data: {
        goalId,
        amount: dto.amount,
        note: dto.note,
      },
    });
  }

  async archive(goalId: number) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException(`Goal ${goalId} tidak ditemukan`);

    return this.prisma.goal.update({
      where: { id: goalId },
      data: { archivedAt: new Date() },
    });
  }

  /** What-if simulator: murni matematik, TIDAK panggil LLM.
   *  Hitung berapa bulan lebih cepat kalau Arzaka potong pengeluaran sebesar cutPercent. */
  async simulate(goalId: number, cutPercent: number) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, archivedAt: null },
    });
    if (!goal) throw new NotFoundException(`Goal ${goalId} tidak ditemukan`);

    // currentAmount dari aggregate contributions
    const agg = await this.prisma.goalContribution.aggregate({
      where: { goalId },
      _sum: { amount: true },
    });
    const currentAmount = Number(agg._sum.amount ?? 0);
    const remaining = Number(goal.targetAmount) - currentAmount;

    if (remaining <= 0) {
      return {
        currentMonthsRemaining: 0,
        adjustedMonthsRemaining: 0,
        monthsSaved: 0,
        message: 'Goal sudah tercapai! 🎉',
      };
    }

    // Historical monthly savings: income 30 hari - spent 30 hari
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [incomeAgg, spentAgg] = await Promise.all([
      this.prisma.income.aggregate({
        _sum: { amount: true },
        where: { receivedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { occurredAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalSpent = Number(spentAgg._sum.amount ?? 0);
    const historicalMonthlySavings = Math.max(0, totalIncome - totalSpent);

    // adjustedMonthlySavings = savings + (totalSpent * cutPercent/100)
    const savingsFromCut = totalSpent * (cutPercent / 100);
    const adjustedMonthlySavings = historicalMonthlySavings + savingsFromCut;

    const currentMonthsRemaining =
      historicalMonthlySavings > 0 ? remaining / historicalMonthlySavings : Infinity;

    const adjustedMonthsRemaining =
      adjustedMonthlySavings > 0 ? remaining / adjustedMonthlySavings : Infinity;

    const monthsSaved =
      currentMonthsRemaining === Infinity ? 0 : currentMonthsRemaining - adjustedMonthsRemaining;

    return {
      goalName: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount,
      remaining,
      cutPercent,
      historicalMonthlySavings,
      adjustedMonthlySavings,
      currentMonthsRemaining:
        currentMonthsRemaining === Infinity ? null : Math.round(currentMonthsRemaining * 10) / 10,
      adjustedMonthsRemaining:
        adjustedMonthsRemaining === Infinity ? null : Math.round(adjustedMonthsRemaining * 10) / 10,
      monthsSaved: Math.round(monthsSaved * 10) / 10,
    };
  }
}
