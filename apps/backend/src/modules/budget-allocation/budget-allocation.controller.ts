import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BudgetAllocationService } from './budget-allocation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('budget-allocation')
export class BudgetAllocationController {
  constructor(private budgetAllocationService: BudgetAllocationService) {}

  /** Preview alokasi 50/30/20 minggu berjalan — read-only, dipakai kartu di halaman Budget. */
  @Get('preview')
  async preview() {
    return this.budgetAllocationService.getWeeklyAllocationPreview();
  }

  /** Manual trigger alokasi Minggu 21:00 (untuk testing) */
  @Post('trigger-weekly')
  async triggerWeekly() {
    await this.budgetAllocationService.runWeeklyAllocation();
    return { ok: true };
  }
}
