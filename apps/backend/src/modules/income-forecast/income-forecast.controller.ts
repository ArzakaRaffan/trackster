import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IncomeForecastService } from './income-forecast.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('income/forecast')
export class IncomeForecastController {
  constructor(private incomeForecastService: IncomeForecastService) {}

  @Get('week')
  async getWeek(@Query('date') date?: string) {
    return this.incomeForecastService.getWeekForecast(date);
  }

  @Get('horizon')
  async getHorizon(@Query('weeks') weeks?: string) {
    const n = weeks ? parseInt(weeks, 10) : 12;
    return this.incomeForecastService.getHorizon(Math.min(Math.max(n, 1), 52));
  }
}
