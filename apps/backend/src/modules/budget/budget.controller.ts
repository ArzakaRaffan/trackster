import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Get()
  async getAll() {
    return this.budgetService.getAll();
  }

  @Put()
  async updateAll(@Body() dto: UpdateBudgetDto) {
    return this.budgetService.updateAll(dto);
  }

  @Get('today')
  async getToday() {
    return this.budgetService.getTodaySummary();
  }
}
