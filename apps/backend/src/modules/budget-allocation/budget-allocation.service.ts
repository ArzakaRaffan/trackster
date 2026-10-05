import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { BudgetService } from '../budget/budget.service';
import { TelegramService } from '../telegram/telegram.service';
import { WEEK_ORDER, startOfWibWeek, wibDateKey, wibRange } from '../../common/wib';
import { sumSpend } from '../../common/spend';
import { forEachActiveUser } from '../../common/per-user';

export interface WeeklyAllocation {
  needs: number;
  wants: number;
  savings: number;
  dailyAmounts: number[]; // index 0=Minggu..6=Sabtu, sama urutan DailyBudget.dayOfWeek
}

/** Fungsi murni: pecah total pemasukan minggu ini jadi 50% kebutuhan / 30% keinginan / 20%
 * tabungan, lalu ratakan pool kebutuhan+keinginan ke 7 hari. Sisa pembulatan dari 50/30 masuk
 * ke savings (bukan pool harian), sisa pembagian 7 hari masuk ke hari terakhir (Minggu, karena minggu = Senin–Minggu) — supaya
 * total selalu persis sama dengan totalIncome. */
export function calcWeeklyAllocation(totalIncome: number): WeeklyAllocation {
  const needs = Math.round(totalIncome * 0.5);
  const wants = Math.round(totalIncome * 0.3);
  const savings = totalIncome - needs - wants;

  const dailyPool = needs + wants;
  const base = Math.floor(dailyPool / 7);
  const remainder = dailyPool - base * 7;
  const dailyAmounts = new Array(7).fill(base);
  dailyAmounts[0] += remainder; // index 0 = Minggu = hari terakhir minggu Senin–Minggu

  return { needs, wants, savings, dailyAmounts };
}

@Injectable()
export class BudgetAllocationService {
  private readonly logger = new Logger(BudgetAllocationService.name);

  constructor(
    private prisma: PrismaService,
    private budgetService: BudgetService,
    private telegramService: TelegramService,
  ) {}

  /** Minggu 21:00 WIB — setelah check-in prompt (19:00) & weekly insight report (20:00). Hitung
   * ulang budget harian minggu depan dari pemasukan yang baru saja di-checkin minggu ini, dan
   * rekomendasikan sisa + 20% tabungan dipindah ke Jago. */
  @Cron('0 21 * * 0', { name: 'weekly-budget-allocation', timeZone: 'Asia/Jakarta' })
  async weeklyAllocationCron() {
    await forEachActiveUser(this.prisma, this.logger, 'weekly-budget-allocation', (userId) => this.runWeeklyAllocation(userId));
  }

  async runWeeklyAllocation(userId: number) {
    try {
      const preview = await this.computePreview(userId);

      await this.budgetService.updateAll(userId, {
        budgets: preview.alloc.dailyAmounts.map((amount, dayOfWeek) => ({ dayOfWeek, amount })),
      });

      const text = this.buildMessage(
        preview.weekStart,
        preview.totalIncome,
        preview.alloc,
        preview.leftover,
        preview.savingsRecommendation,
        preview.isOverspent,
      );
      await this.telegramService.sendMessage(userId, text);

      this.logger.log(
        `Alokasi (user ${userId}) minggu ${wibDateKey(preview.weekStart)} selesai: income=${preview.totalIncome}, savings rec=${preview.savingsRecommendation}`,
      );
    } catch (err: any) {
      this.logger.error(`runWeeklyAllocation error: ${err?.message}`);
    }
  }

  /** Sama persis kalkulasinya dengan `runWeeklyAllocation`, tapi read-only — dipakai buat kartu
   * "Alokasi 50/30/20" di halaman Budget, biar rekomendasi nabung nggak cuma lewat Telegram. */
  async getWeeklyAllocationPreview(userId: number) {
    const preview = await this.computePreview(userId);
    return {
      weekStart: wibDateKey(preview.weekStart),
      totalIncome: Math.round(preview.totalIncome),
      leftover: Math.round(preview.leftover),
      isOverspent: preview.isOverspent,
      savingsRecommendation: Math.round(preview.savingsRecommendation),
      allocation: {
        needs: preview.alloc.needs,
        wants: preview.alloc.wants,
        savings: preview.alloc.savings,
      },
    };
  }

  private async computePreview(userId: number) {
    const now = new Date();
    const weekStart = startOfWibWeek(now);

    const incomes = await this.prisma.income.findMany({
      where: { userId, periodStart: weekStart, stream: { kind: { not: 'IRREGULAR' } } },
      select: { amount: true },
    });
    const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

    const prevBudgets = await this.prisma.dailyBudget.findMany({ where: { userId } });
    const prevWeekPool = prevBudgets.reduce((sum, b) => sum + Number(b.amount), 0);

    const { start: weekEndStart, end: weekEndEnd } = wibRange('week', now);
    const spentAgg = await this.prisma.transaction.aggregate({
      _sum: { amount: true, reimbursedAmount: true },
      where: { userId, occurredAt: { gte: weekEndStart, lt: weekEndEnd } },
    });
    const actualSpent = sumSpend(spentAgg._sum);
    const isOverspent = actualSpent > prevWeekPool;
    const leftover = Math.max(0, prevWeekPool - actualSpent);

    const alloc = calcWeeklyAllocation(totalIncome);
    const savingsRecommendation = alloc.savings + leftover;

    return { weekStart, totalIncome, alloc, leftover, isOverspent, savingsRecommendation };
  }

  private buildMessage(
    weekStart: Date,
    totalIncome: number,
    alloc: WeeklyAllocation,
    leftover: number,
    savingsRecommendation: number,
    isOverspent: boolean,
  ): string {
    const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dailyLines = WEEK_ORDER.map((i) => `  ${dayNames[i]}: ${fmt(alloc.dailyAmounts[i])}`).join('\n');

    const lines = [
      `<b>Alokasi 50/30/20 — minggu ${wibDateKey(weekStart)}</b>`,
      `Pemasukan minggu ini: ${fmt(totalIncome)}`,
      ``,
      `Kebutuhan (50%): ${fmt(alloc.needs)}`,
      `Keinginan (30%): ${fmt(alloc.wants)}`,
      `Tabungan/investasi (20%): ${fmt(alloc.savings)}`,
      ``,
      `Budget harian minggu depan:`,
      dailyLines,
      ``,
    ];

    if (isOverspent) {
      lines.push(`⚠️ Pengeluaran minggu ini (Rp lebih besar dari budget yang berlaku) — nggak ada sisa buat nabung minggu ini.`);
    } else if (leftover > 0) {
      lines.push(`Sisa budget minggu ini yang nggak kepake: ${fmt(leftover)}`);
    }

    lines.push(`\n💰 Rekomendasi pindah ke Jago: ${fmt(savingsRecommendation)}`);

    return lines.join('\n');
  }
}
