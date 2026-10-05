import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IncomeStreamService } from './income-stream.service';
import { CreateIncomeStreamDto } from './dto/create-income-stream.dto';
import { UpdateIncomeStreamDto } from './dto/update-income-stream.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('income-streams')
export class IncomeStreamController {
  constructor(private incomeStreamService: IncomeStreamService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query('activeOnly') activeOnly?: string) {
    return this.incomeStreamService.findAll(user.id, { activeOnly: activeOnly === 'true' });
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateIncomeStreamDto) {
    return this.incomeStreamService.create(user.id, dto);
  }

  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIncomeStreamDto) {
    return this.incomeStreamService.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.incomeStreamService.remove(user.id, id);
  }
}
