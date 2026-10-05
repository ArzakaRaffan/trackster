import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IncomeForecastService } from './income-forecast.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('income/forecast')
export class IncomeForecastController {
  constructor(private incomeForecastService: IncomeForecastService) {}

  @Get('week')
  async getWeek(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.incomeForecastService.getWeekForecast(user.id, date);
  }

  @Get('horizon')
  async getHorizon(@CurrentUser() user: AuthUser, @Query('weeks') weeks?: string) {
    const n = weeks ? parseInt(weeks, 10) : 12;
    return this.incomeForecastService.getHorizon(user.id, Math.min(Math.max(n, 1), 52));
  }
}
