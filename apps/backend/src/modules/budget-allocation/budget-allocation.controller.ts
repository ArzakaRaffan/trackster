import { Controller, Post, UseGuards } from '@nestjs/common';
import { BudgetAllocationService } from './budget-allocation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('budget-allocation')
export class BudgetAllocationController {
  constructor(private budgetAllocationService: BudgetAllocationService) {}

  /** Manual trigger alokasi Minggu 21:00 (untuk testing) */
  @Post('trigger-weekly')
  async triggerWeekly() {
    await this.budgetAllocationService.runWeeklyAllocation();
    return { ok: true };
  }
}
