import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { IncomeForecastService } from '../income-forecast/income-forecast.service';
import { startOfWibWeek, wibDateKey, addWibDays, startOfWibDay } from '../../common/wib';
import {
  computeBudgetSuggestions,
  computeOption,
  computeDailyWeights,
  applyDayOverrides,
  BudgetSuggestion,
  BudgetSuggestionInput,
  BudgetOption,
  BudgetOptionResult,
} from './budget-advisor';

@Injectable()
export class BudgetAdvisorService {
  constructor(
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
    private incomeForecastService: IncomeForecastService,
  ) {}

  /** `weekParam`: 'YYYY-MM-DD' hari Senin dari minggu yang diminta. Default = minggu ini. */
  private async buildInput(weekParam?: string): Promise<{ input: BudgetSuggestionInput; weekKey: string }> {
    const weekStart = weekParam
      ? startOfWibDay(weekParam)
      : startOfWibWeek(new Date());
    const weekEnd = addWibDays(weekStart, 7);
    const weekKey = wibDateKey(weekStart);

    // 1. Forecast pemasukan minggu ini
    const forecast = await this.incomeForecastService.getWeekForecast(weekKey);
    const expectedIncome = forecast.totals.expected;
    const conservativeIncome = forecast.totals.conservative;

    // 2. Commitments: langganan jatuh tempo minggu ini
    const dueSubs = await this.prisma.subscription.findMany({
      where: { isActive: true, nextDueDate: { gte: weekStart, lt: weekEnd } },
      select: { amount: true },
    });
    const commitments = dueSubs.reduce((s, sub) => s + Number(sub.amount), 0);

    // 3. Median rutin per hari-dalam-minggu dari 8 minggu terakhir
    const eightWeeksAgo = addWibDays(weekStart, -56);
    const stats = await this.analyticsService.getPeriodStats(eightWeeksAgo, weekStart, false);
    const medianRoutineByDow = stats.byWeekday.map(d => d.avgRoutine);
    const avgRoutinePerDay = stats.totals.avgRoutinePerDay;

    return {
      input: { expectedIncome, conservativeIncome, commitments, medianRoutineByDow, avgRoutinePerDay },
      weekKey,
    };
  }

  async getSuggestions(weekParam?: string): Promise<BudgetSuggestion> {
    const { input, weekKey } = await this.buildInput(weekParam);
    return computeBudgetSuggestions(input, weekKey);
  }

  /** Opsi + penyesuaian hari tertentu (dari tool chat `proposeBudget`) — total mingguan opsi
   * dipertahankan, sisa hari yang tidak di-override diredistribusi proporsional bobot aslinya. */
  async proposeAdjusted(
    weekParam: string | undefined,
    option: BudgetOption,
    dayOverrides: { dayOfWeek: number; amount: number }[] = [],
  ): Promise<BudgetOptionResult> {
    for (const o of dayOverrides) {
      if (o.dayOfWeek < 0 || o.dayOfWeek > 6) throw new BadRequestException('dayOfWeek harus 0-6');
    }

    const { input } = await this.buildInput(weekParam);
    const base = computeOption(option, input);
    const weights = computeDailyWeights(input.medianRoutineByDow);
    return applyDayOverrides(base, weights, dayOverrides);
  }
}
