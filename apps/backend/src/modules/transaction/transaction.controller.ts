import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Category, Source } from '@prisma/client';
import { UpdateNoteDto } from './dto/update-note.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SetAliasDto } from './dto/set-alias.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('source') source?: Source,
    @Query('category') category?: Category,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionService.findAll({
      startDate,
      endDate,
      source,
      category,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('weekly')
  async getWeekly() {
    return this.transactionService.getWeekly();
  }

  @Get('monthly')
  async getMonthly(@Query('year') year: string, @Query('month') month: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.transactionService.getMonthly(y, m);
  }

  @Get('summary')
  async getSummary(@Query('range') range?: string) {
    // Cuma 'all' yang didukung saat ini — disiapin buat range lain nanti tanpa ubah shape response.
    return this.transactionService.getAllTimeSummary();
  }

  @Get('day/:date')
  async getByDay(@Param('date') date: string) {
    return this.transactionService.getByDay(date);
  }

  @Get('insights')
  async getInsights(@Query('range') range?: string) {
    return this.transactionService.getInsights(range === 'all' ? 'all' : '30d');
  }

  @Post()
  async create(@Body() dto: CreateTransactionDto) {
    return this.transactionService.create(dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.transactionService.remove(id);
  }

  @Patch(':id/note')
  async updateNote(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto) {
    return this.transactionService.updateNote(id, dto.note);
  }

  @Patch(':id/category')
  async updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.transactionService.updateCategory(id, dto.category);
  }

  @Patch(':id/alias')
  async setAlias(@Param('id', ParseIntPipe) id: number, @Body() dto: SetAliasDto) {
    return this.transactionService.setAlias(id, dto.displayName);
  }
}
