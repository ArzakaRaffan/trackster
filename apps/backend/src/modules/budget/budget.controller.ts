import { BadRequestException, Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetOption } from './budget-period';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UpdateBudgetSettingsDto } from './dto/update-budget-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  /** Nominal per hari = bobot hari kalau "atur sendiri". */
  @Get()
  async getAll(@CurrentUser() user: AuthUser) {
    return this.budgetService.getAll(user.id);
  }

  @Put()
  async updateAll(@CurrentUser() user: AuthUser, @Body() dto: UpdateBudgetDto) {
    return this.budgetService.updateAll(user.id, dto);
  }

  @Get('settings')
  async getSettings(@CurrentUser() user: AuthUser) {
    return this.budgetService.getSettings(user.id);
  }

  @Put('settings')
  async updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateBudgetSettingsDto) {
    return this.budgetService.updateSettings(user.id, dto);
  }

  /** Snapshot jatah harian, `from`/`to` = 'YYYY-MM-DD' (inklusif). Hari tanpa baris = sebelum snapshot ada. */
  @Get('allowances')
  async getAllowances(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !iso.test(from) || !iso.test(to)) throw new BadRequestException('from & to harus YYYY-MM-DD');
    return this.budgetService.getAllowances(user.id, from, to);
  }

  @Get('today')
  async getToday(@CurrentUser() user: AuthUser) {
    return this.budgetService.getTodaySummary(user.id);
  }

  @Get('runway')
  async getRunway(@CurrentUser() user: AuthUser) {
    return this.budgetService.getRunwayForecast(user.id);
  }

  /** Gaya hemat/seimbang/longgar — langsung diterapkan, mengembalikan ringkasan hari ini yang baru. */
  @Post('apply')
  async applyBudget(@CurrentUser() user: AuthUser, @Body() body: { option?: BudgetOption }) {
    return this.budgetService.applyStyle(user.id, body?.option as BudgetOption);
  }
}
