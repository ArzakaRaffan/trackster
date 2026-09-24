import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BalanceService } from '../balance/balance.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { addWibDays, startOfWibDay } from '../../common/wib';

@Injectable()
export class IncomeService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
  ) {}

  async findAll(params: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = params;
    const where: any = {};
    if (startDate || endDate) {
      where.receivedAt = {};
      if (startDate) where.receivedAt.gte = startOfWibDay(startDate);
      if (endDate) where.receivedAt.lt = addWibDays(startOfWibDay(endDate), 1);
    }
    return this.prisma.income.findMany({ where, orderBy: { receivedAt: 'desc' } });
  }

  async create(dto: CreateIncomeDto) {
    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          amount: dto.amount,
          description: dto.description,
          source: dto.source,
          receivedAt: new Date(dto.receivedAt),
        },
      });
      await this.balanceService.adjustBalance(tx, income.source, Number(income.amount));
      return income;
    });
  }

  /** Reverse efek balance dari data lama dulu, baru apply data baru — lebih simpel & aman
   * daripada ngitung selisih per-field, dan tetap benar walau amount dan source dua-duanya berubah. */
  async update(id: number, dto: UpdateIncomeDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.income.findUniqueOrThrow({ where: { id } });
      await this.balanceService.adjustBalance(tx, existing.source, -Number(existing.amount));

      const updated = await tx.income.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.source !== undefined && { source: dto.source }),
          ...(dto.receivedAt !== undefined && { receivedAt: new Date(dto.receivedAt) }),
        },
      });
      await this.balanceService.adjustBalance(tx, updated.source, Number(updated.amount));
      return updated;
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.income.delete({ where: { id } });
      await this.balanceService.adjustBalance(tx, deleted.source, -Number(deleted.amount));
      return deleted;
    });
  }

  /** Smoothed daily allowance: rata-rata pemasukan harian dalam windowDays terakhir * faktor tabungan.
   *  Faktor 0.7 = asumsi 30% income disisihkan untuk tabungan/darurat — bisa di-tuning. */
  async getSmoothedDailyAllowance(windowDays = 30) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const agg = await this.prisma.income.aggregate({
      _sum: { amount: true },
      where: { receivedAt: { gte: since } },
    });

    const totalIncome = Number(agg._sum.amount ?? 0);
    const averageDailyIncome = totalIncome / windowDays;

    // 0.7 = faktor tabungan. Asumsi: 30% income disisihkan untuk tabungan/darurat.
    // Angka ini keputusan produk sederhana — dokumentasikan di sini biar tidak jadi magic number.
    const SAVINGS_FACTOR = 0.7;
    const suggestedDailyAllowance = averageDailyIncome * SAVINGS_FACTOR;

    return {
      windowDays,
      totalIncome: Math.round(totalIncome),
      averageDailyIncome: Math.round(averageDailyIncome),
      suggestedDailyAllowance: Math.round(suggestedDailyAllowance),
      savingsFactor: SAVINGS_FACTOR,
    };
  }

  /** Rekomendasi alokasi mingguan: rata-rata income mingguan (windowDays terakhir) dikurangi
   *  target budget mingguan (jumlah 7 DailyBudget) = leftover, lalu leftover dibagi tabung/invest/
   *  jajan-bebas. Rasio 50/30/20 keputusan produk sederhana (sama semangatnya dengan SAVINGS_FACTOR
   *  di atas) — tuning kalau prioritas finansial berubah.
   *  Kalau nggak ada income tercatat dalam windowDays terakhir (user nyatet nggak rutin tiap minggu
   *  — kasus nyata: gap 28 hari pas kena boundary window default), fallback ke rata-rata ALL-TIME
   *  (total income / rentang minggu sejak entry pertama) biar nggak nampilin Rp0 yang menyesatkan. */
  async getAllocationRecommendation(windowDays = 28) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [incomeAgg, budgets] = await Promise.all([
      this.prisma.income.aggregate({ _sum: { amount: true }, where: { receivedAt: { gte: since } } }),
      this.prisma.dailyBudget.findMany(),
    ]);

    let totalIncome = Number(incomeAgg._sum.amount ?? 0);
    let weeks = windowDays / 7;
    let usedWindowDays = windowDays;
    let isFallback = false;

    if (totalIncome === 0) {
      const [allAgg, oldest] = await Promise.all([
        this.prisma.income.aggregate({ _sum: { amount: true } }),
        this.prisma.income.findFirst({ orderBy: { receivedAt: 'asc' } }),
      ]);
      totalIncome = Number(allAgg._sum.amount ?? 0);
      if (oldest && totalIncome > 0) {
        const spanDays = Math.max(7, (Date.now() - oldest.receivedAt.getTime()) / (24 * 60 * 60 * 1000));
        weeks = spanDays / 7;
        usedWindowDays = Math.round(spanDays);
        isFallback = true;
      }
    }

    const weeklyIncome = weeks > 0 ? totalIncome / weeks : 0;
    const weeklyBudgetTarget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const leftover = Math.max(0, weeklyIncome - weeklyBudgetTarget);

    const SAVE_RATIO = 0.5;
    const INVEST_RATIO = 0.3;
    const SPEND_RATIO = 0.2;

    return {
      windowDays: usedWindowDays,
      isFallback,
      weeklyIncome: Math.round(weeklyIncome),
      weeklyBudgetTarget: Math.round(weeklyBudgetTarget),
      leftover: Math.round(leftover),
      allocation: {
        save: Math.round(leftover * SAVE_RATIO),
        invest: Math.round(leftover * INVEST_RATIO),
        spend: Math.round(leftover * SPEND_RATIO),
      },
      ratios: { save: SAVE_RATIO, invest: INVEST_RATIO, spend: SPEND_RATIO },
    };
  }
}
