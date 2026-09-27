import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IncomeCheckinService } from './income-checkin.service';
import { CheckinSubmitDto } from './dto/checkin-submit.dto';

@Controller('income/checkin')
@UseGuards(JwtAuthGuard)
export class IncomeCheckinController {
  constructor(private incomeCheckinService: IncomeCheckinService) {}

  @Get()
  getDraft(@Query('week') week?: string) {
    return this.incomeCheckinService.getDraft(week);
  }

  @Post()
  submit(@Body() dto: CheckinSubmitDto) {
    return this.incomeCheckinService.submit(dto.week, dto.entries);
  }
}
