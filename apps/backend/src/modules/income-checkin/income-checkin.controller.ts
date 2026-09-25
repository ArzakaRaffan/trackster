import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IncomeCheckinService } from './income-checkin.service';
import { IncomeCheckinReminderService } from './income-checkin-reminder.service';
import { SubmitCheckinDto } from './dto/submit-checkin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('income/checkin')
export class IncomeCheckinController {
  constructor(
    private incomeCheckinService: IncomeCheckinService,
    private incomeCheckinReminderService: IncomeCheckinReminderService,
  ) {}

  @Get()
  async getDraft(@Query('week') week?: string) {
    return this.incomeCheckinService.getDraft(week);
  }

  @Post()
  async submit(@Body() dto: SubmitCheckinDto) {
    return this.incomeCheckinService.submit(dto);
  }

  /** Manual trigger prompt Minggu 19:00 (untuk testing) */
  @Post('trigger-prompt')
  async triggerPrompt() {
    await this.incomeCheckinReminderService.sendWeeklyPrompt();
    return { ok: true };
  }

  /** Manual trigger reminder Senin 12:00 (untuk testing) */
  @Post('trigger-reminder')
  async triggerReminder() {
    await this.incomeCheckinReminderService.sendMondayReminder();
    return { ok: true };
  }
}
