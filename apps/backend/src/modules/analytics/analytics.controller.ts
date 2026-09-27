import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { addWibDays, startOfWibDay } from '../../common/wib';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /** `?range=7d|30d|90d|all` ATAU `?from=&to=` (WIB, inklusif). */
  @Get('stats')
  async getStats(@Query('range') range?: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (from && to) {
      const start = startOfWibDay(from);
      const end = addWibDays(startOfWibDay(to), 1);
      return this.analyticsService.getPeriodStats(start, end);
    }

    const days = { '7d': 7, '30d': 30, '90d': 90 }[range ?? '30d'];
    const now = new Date();
    const end = addWibDays(startOfWibDay(now), 1);

    if (range === 'all') {
      const first = await this.analyticsService.getPeriodStats(new Date(0), end, false);
      const start = first.range.dataStartsAt ? startOfWibDay(new Date(first.range.dataStartsAt)) : startOfWibDay(now);
      return this.analyticsService.getPeriodStats(start, end);
    }

    if (!days) throw new BadRequestException('range harus 7d|30d|90d|all, atau pakai from & to');
    const start = addWibDays(end, -days);
    return this.analyticsService.getPeriodStats(start, end);
  }
}
