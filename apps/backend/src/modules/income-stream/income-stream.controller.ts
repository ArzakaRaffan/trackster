import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IncomeStreamService } from './income-stream.service';
import { CreateIncomeStreamDto } from './dto/create-income-stream.dto';
import { UpdateIncomeStreamDto } from './dto/update-income-stream.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('income-streams')
export class IncomeStreamController {
  constructor(private incomeStreamService: IncomeStreamService) {}

  @Get()
  async findAll(@Query('activeOnly') activeOnly?: string) {
    return this.incomeStreamService.findAll({ activeOnly: activeOnly === 'true' });
  }

  @Post()
  async create(@Body() dto: CreateIncomeStreamDto) {
    return this.incomeStreamService.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIncomeStreamDto) {
    return this.incomeStreamService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.incomeStreamService.remove(id);
  }
}
