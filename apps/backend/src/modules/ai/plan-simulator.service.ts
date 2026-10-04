import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BalanceService } from '../balance/balance.service';
import { IncomeForecastService } from '../income-forecast/income-forecast.service';
import { addWibDays, startOfWibWeek } from '../../common/wib';
import {
  PlanBaseline,
  SimulatePlanInput,
  WhatIfPurchaseInput,
  simulatePlan,
  whatIfPurchase,
} from './plan-simulator';
import { spend } from '../../common/spend';

// Sama semangatnya dengan threshold di financial-snapshot.service.ts/ai-anomaly.service.ts:
// heuristik sederhana buat "pembelian besar", bukan model statistik proper.
const BIG_PURCHASE_THRESHOLD = 500_000;
const BASELINE_WEEKS = 8;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Merakit baseline nyata (forecast pemasukan E03 + median pengeluaran rutin 8 minggu terakhir,
 * tanpa pembelian besar) lalu delegasi ke engine murni di plan-simulator.ts. Deterministik,
 * tidak ada panggilan AI di sini — dipanggil dari tool `simulatePlan`/`whatIfPurchase`.
 */
@Injectable()
export class PlanSimulatorService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private incomeForecastService: IncomeForecastService,
  ) {}

  async simulatePlan(input: SimulatePlanInput) {
    const baseline = await this.buildBaseline();
    return simulatePlan(input, baseline);
  }

  async whatIfPurchase(input: WhatIfPurchaseInput) {
    const baseline = await this.buildBaseline();
    return whatIfPurchase(input, baseline);
  }

  private async buildBaseline(): Promise<PlanBaseline> {
    const [horizon, balances, weeklySpendByCategory] = await Promise.all([
      this.incomeForecastService.getHorizon(1),
      this.balanceService.getAll(),
      this.getRoutineWeeklyBaseline(),
    ]);
    const totals = horizon[0]?.totals ?? { conservative: 0, expected: 0, max: 0, received: 0 };
    const startingBalance = balances.reduce((sum, b) => sum + Number(b.balance), 0);

    return {
      weeklyIncome: { conservative: totals.conservative, expected: totals.expected, max: totals.max },
      weeklySpendByCategory,
      startingBalance,
    };
  }

  /** Median pengeluaran rutin per kategori selama BASELINE_WEEKS minggu penuh terakhir (sebelum
   * minggu berjalan), buang pembelian besar (>= BIG_PURCHASE_THRESHOLD) supaya tidak mencemari
   * baseline "rutin" — definisi sama dengan yang dipakai financial-snapshot untuk "pembelian besar". */
  private async getRoutineWeeklyBaseline(): Promise<Record<string, number>> {
    const currentWeekStart = startOfWibWeek(new Date());
    const since = addWibDays(currentWeekStart, -7 * BASELINE_WEEKS);

    const rows = await this.prisma.transaction.findMany({
      where: { occurredAt: { gte: since, lt: currentWeekStart }, amount: { lt: BIG_PURCHASE_THRESHOLD } },
      select: { amount: true, reimbursedAmount: true, category: true, occurredAt: true },
    });

    const byCategoryWeekly = new Map<string, number[]>();
    for (const row of rows) {
      const weekIdx = Math.min(
        BASELINE_WEEKS - 1,
        Math.floor((row.occurredAt.getTime() - since.getTime()) / (7 * 86_400_000)),
      );
      const arr = byCategoryWeekly.get(row.category) ?? new Array(BASELINE_WEEKS).fill(0);
      arr[weekIdx] += spend(row);
      byCategoryWeekly.set(row.category, arr);
    }

    const result: Record<string, number> = {};
    for (const [category, weeklyTotals] of byCategoryWeekly) {
      result[category] = Math.round(median(weeklyTotals));
    }
    return result;
  }
}
