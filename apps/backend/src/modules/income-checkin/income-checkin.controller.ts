import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IncomeCheckinService } from './income-checkin.service';
import { IncomeCheckinReminderService } from './income-checkin-reminder.service';
import { SubmitCheckinDto } from './dto/submit-checkin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiRateLimitGuard } from '../../common/guards/ai-rate-limit.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('income/checkin')
export class IncomeCheckinController {
  constructor(
    private incomeCheckinService: IncomeCheckinService,
    private incomeCheckinReminderService: IncomeCheckinReminderService,
  ) {}

  @Get()
  async getDraft(@CurrentUser() user: AuthUser, @Query('week') week?: string) {
    return this.incomeCheckinService.getDraft(user.id, week);
  }

  @Post()
  async submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitCheckinDto) {
    return this.incomeCheckinService.submit(user.id, dto);
  }

  /** Manual trigger prompt Minggu 19:00 (untuk testing) */
  @UseGuards(AiRateLimitGuard)
  @Post('trigger-prompt')
  async triggerPrompt(@CurrentUser() user: AuthUser) {
    await this.incomeCheckinReminderService.sendWeeklyPrompt(user.id);
    return { ok: true };
  }

  /** Manual trigger reminder Senin 12:00 (untuk testing) */
  @UseGuards(AiRateLimitGuard)
  @Post('trigger-reminder')
  async triggerReminder(@CurrentUser() user: AuthUser) {
    await this.incomeCheckinReminderService.sendMondayReminder(user.id);
    return { ok: true };
  }
}
