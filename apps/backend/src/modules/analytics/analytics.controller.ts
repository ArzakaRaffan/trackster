import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /** `?range=7d|30d|90d|all` ATAU `?from=&to=` (WIB, inklusif). */
  @Get('stats')
  async getStats(@Query('range') range?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const { start, end } = await this.analyticsService.resolvePeriod(range, from, to);
    return this.analyticsService.getPeriodStats(start, end);
  }
}
