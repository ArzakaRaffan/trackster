import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BudgetAllocationService } from './budget-allocation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiRateLimitGuard } from '../../common/guards/ai-rate-limit.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('budget-allocation')
export class BudgetAllocationController {
  constructor(private budgetAllocationService: BudgetAllocationService) {}

  /** Preview alokasi 50/30/20 minggu berjalan — read-only, dipakai kartu di halaman Budget. */
  @Get('preview')
  async preview(@CurrentUser() user: AuthUser) {
    return this.budgetAllocationService.getWeeklyAllocationPreview(user.id);
  }

  /** Manual trigger alokasi Minggu 21:00 (untuk testing) */
  @UseGuards(AiRateLimitGuard)
  @Post('trigger-weekly')
  async triggerWeekly(@CurrentUser() user: AuthUser) {
    await this.budgetAllocationService.runWeeklyAllocation(user.id);
    return { ok: true };
  }
}
