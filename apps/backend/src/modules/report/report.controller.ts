import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { startOfWibDay } from '../../common/wib';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  /** `?period=week|month&date=YYYY-MM-DD` (default: sekarang, WIB). `date` cukup jatuh di dalam periode. */
  @Get()
  async getReport(@Query('period') period = 'week', @Query('date') date?: string) {
    if (period !== 'week' && period !== 'month') throw new BadRequestException('period harus week|month');
    const anchor = date ? startOfWibDay(date) : new Date();
    return this.reportService.getReport(period, anchor);
  }
}
