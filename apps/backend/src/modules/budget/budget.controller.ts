import { BadRequestException, Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetAdvisorService } from './budget-advisor.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(
    private budgetService: BudgetService,
    private budgetAdvisorService: BudgetAdvisorService,
  ) {}

  @Get()
  async getAll(@CurrentUser() user: AuthUser) {
    return this.budgetService.getAll(user.id);
  }

  @Put()
  async updateAll(@CurrentUser() user: AuthUser, @Body() dto: UpdateBudgetDto) {
    return this.budgetService.updateAll(user.id, dto);
  }

  @Get('rollover')
  async getRollover(@CurrentUser() user: AuthUser) {
    return { rolloverEnabled: await this.budgetService.getRolloverEnabled(user.id) };
  }

  @Put('rollover')
  async setRollover(@CurrentUser() user: AuthUser, @Body() body: { enabled?: unknown }) {
    if (typeof body.enabled !== 'boolean') throw new BadRequestException('enabled harus boolean');
    return this.budgetService.setRolloverEnabled(user.id, body.enabled);
  }

  @Get('today')
  async getToday(@CurrentUser() user: AuthUser) {
    return this.budgetService.getTodaySummary(user.id);
  }

  @Get('runway')
  async getRunway(@CurrentUser() user: AuthUser) {
    return this.budgetService.getRunwayForecast(user.id);
  }

  @Get('suggestions')
  async getSuggestions(@CurrentUser() user: AuthUser, @Query('week') week?: string) {
    return this.budgetAdvisorService.getSuggestions(user.id, week);
  }

  @Post('apply')
  async applyBudget(
    @CurrentUser() user: AuthUser,
    @Body() body: { option: 'hemat' | 'seimbang' | 'longgar'; week?: string },
  ) {
    const suggestion = await this.budgetAdvisorService.getSuggestions(user.id, body.week);
    const chosen = suggestion.options.find(o => o.option === body.option);
    if (!chosen) throw new BadRequestException('option harus hemat|seimbang|longgar');
    return this.budgetService.updateAll(user.id, {
      budgets: chosen.dailyAmounts.map((amount, dayOfWeek) => ({ dayOfWeek, amount })),
    });
  }
}
