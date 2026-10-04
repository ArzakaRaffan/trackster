import { BadRequestException, Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetAdvisorService } from './budget-advisor.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(
    private budgetService: BudgetService,
    private budgetAdvisorService: BudgetAdvisorService,
  ) {}

  @Get()
  async getAll() {
    return this.budgetService.getAll();
  }

  @Put()
  async updateAll(@Body() dto: UpdateBudgetDto) {
    return this.budgetService.updateAll(dto);
  }

  @Get('rollover')
  async getRollover() {
    return { rolloverEnabled: await this.budgetService.getRolloverEnabled() };
  }

  @Put('rollover')
  async setRollover(@Body() body: { enabled?: unknown }) {
    if (typeof body.enabled !== 'boolean') throw new BadRequestException('enabled harus boolean');
    return this.budgetService.setRolloverEnabled(body.enabled);
  }

  @Get('today')
  async getToday() {
    return this.budgetService.getTodaySummary();
  }

  @Get('runway')
  async getRunway() {
    return this.budgetService.getRunwayForecast();
  }

  @Get('suggestions')
  async getSuggestions(@Query('week') week?: string) {
    return this.budgetAdvisorService.getSuggestions(week);
  }

  @Post('apply')
  async applyBudget(
    @Body() body: { option: 'hemat' | 'seimbang' | 'longgar'; week?: string },
  ) {
    const suggestion = await this.budgetAdvisorService.getSuggestions(body.week);
    const chosen = suggestion.options.find(o => o.option === body.option);
    if (!chosen) throw new BadRequestException('option harus hemat|seimbang|longgar');
    return this.budgetService.updateAll({
      budgets: chosen.dailyAmounts.map((amount, dayOfWeek) => ({ dayOfWeek, amount })),
    });
  }
}
