import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IncomeStatus } from '@prisma/client';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { ResolveIncomeDto } from './dto/resolve-income.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('income')
export class IncomeController {
  constructor(private incomeService: IncomeService) {}

  @Get()
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: IncomeStatus,
  ) {
    return this.incomeService.findAll({ startDate, endDate, status });
  }

  @Get('allowance-suggestion')
  async getAllowanceSuggestion(@Query('windowDays') windowDays?: string) {
    const days = windowDays ? parseInt(windowDays, 10) : 30;
    return this.incomeService.getSmoothedDailyAllowance(days);
  }

  @Get('allocation')
  async getAllocation() {
    return this.incomeService.getAllocationRecommendation();
  }

  @Post()
  async create(@Body() dto: CreateIncomeDto) {
    return this.incomeService.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIncomeDto) {
    return this.incomeService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.incomeService.remove(id);
  }

  @Patch(':id/resolve')
  async resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveIncomeDto) {
    return this.incomeService.resolve(id, dto);
  }
}
