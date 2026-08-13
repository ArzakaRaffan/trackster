import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('income')
export class IncomeController {
  constructor(private incomeService: IncomeService) {}

  @Get()
  async findAll(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.incomeService.findAll({ startDate, endDate });
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
}
