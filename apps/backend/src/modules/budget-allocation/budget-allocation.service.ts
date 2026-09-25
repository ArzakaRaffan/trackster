import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { BudgetService } from '../budget/budget.service';
import { TelegramService } from '../telegram/telegram.service';
import { startOfWibWeek, wibDateKey, wibRange } from '../../common/wib';

export interface WeeklyAllocation {
  needs: number;
  wants: number;
  savings: number;
  dailyAmounts: number[]; // index 0=Minggu..6=Sabtu, sama urutan DailyBudget.dayOfWeek
}

/** Fungsi murni: pecah total pemasukan minggu ini jadi 50% kebutuhan / 30% keinginan / 20%
 * tabungan, lalu ratakan pool kebutuhan+keinginan ke 7 hari. Sisa pembulatan dari 50/30 masuk
 * ke savings (bukan pool harian), sisa pembagian 7 hari masuk ke hari terakhir (Sabtu) — supaya
 * total selalu persis sama dengan totalIncome. */
export function calcWeeklyAllocation(totalIncome: number): WeeklyAllocation {
  const needs = Math.round(totalIncome * 0.5);
  const wants = Math.round(totalIncome * 0.3);
  const savings = totalIncome - needs - wants;

  const dailyPool = needs + wants;
  const base = Math.floor(dailyPool / 7);
  const remainder = dailyPool - base * 7;
  const dailyAmounts = new Array(7).fill(base);
  dailyAmounts[6] += remainder; // Sabtu

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
  async runWeeklyAllocation() {
    try {
      const now = new Date();
      const weekStart = startOfWibWeek(now);

      const incomes = await this.prisma.income.findMany({
        where: { periodStart: weekStart, stream: { kind: { not: 'IRREGULAR' } } },
        select: { amount: true },
      });
      const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

      const prevBudgets = await this.prisma.dailyBudget.findMany();
      const prevWeekPool = prevBudgets.reduce((sum, b) => sum + Number(b.amount), 0);

      const { start: weekEndStart, end: weekEndEnd } = wibRange('week', now);
      const spentAgg = await this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { occurredAt: { gte: weekEndStart, lt: weekEndEnd } },
      });
      const actualSpent = Number(spentAgg._sum.amount ?? 0);
      const isOverspent = actualSpent > prevWeekPool;
      const leftover = Math.max(0, prevWeekPool - actualSpent);

      const alloc = calcWeeklyAllocation(totalIncome);

      await this.budgetService.updateAll({
        budgets: alloc.dailyAmounts.map((amount, dayOfWeek) => ({ dayOfWeek, amount })),
      });

      const savingsRecommendation = alloc.savings + leftover;
      const text = this.buildMessage(weekStart, totalIncome, alloc, leftover, savingsRecommendation, isOverspent);
      await this.telegramService.sendMessage(text);

      this.logger.log(
        `Alokasi minggu ${wibDateKey(weekStart)} selesai: income=${totalIncome}, savings rec=${savingsRecommendation}`,
      );
    } catch (err: any) {
      this.logger.error(`runWeeklyAllocation error: ${err?.message}`);
    }
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
    const dailyLines = alloc.dailyAmounts.map((a, i) => `  ${dayNames[i]}: ${fmt(a)}`).join('\n');

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
