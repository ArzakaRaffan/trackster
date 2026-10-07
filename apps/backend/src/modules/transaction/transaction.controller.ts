import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Category, Source } from '@prisma/client';
import { UpdateNoteDto } from './dto/update-note.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SetAliasDto } from './dto/set-alias.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SetBigDto } from './dto/set-big.dto';
import { wibParts } from '../../common/wib';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('source') source?: Source,
    @Query('category') category?: Category,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionService.findAll(user.id, {
      startDate,
      endDate,
      source,
      category,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('subscriptions')
  async getSubscriptions(@CurrentUser() user: AuthUser) {
    return this.transactionService.getSubscriptions(user.id);
  }

  @Get('weekly')
  async getWeekly(@CurrentUser() user: AuthUser) {
    return this.transactionService.getWeekly(user.id);
  }

  @Get('monthly')
  async getMonthly(@CurrentUser() user: AuthUser, @Query('year') year: string, @Query('month') month: string) {
    const nowParts = wibParts(new Date());
    const y = year ? parseInt(year, 10) : nowParts.year;
    const m = month ? parseInt(month, 10) : nowParts.month;
    return this.transactionService.getMonthly(user.id, y, m);
  }

  @Get('summary')
  async getSummary(@CurrentUser() user: AuthUser, @Query('range') range?: string) {
    // Cuma 'all' yang didukung saat ini — disiapin buat range lain nanti tanpa ubah shape response.
    return this.transactionService.getAllTimeSummary(user.id);
  }

  @Get('day/:date')
  async getByDay(@CurrentUser() user: AuthUser, @Param('date') date: string) {
    return this.transactionService.getByDay(user.id, date);
  }

  @Get('insights')
  async getInsights(@CurrentUser() user: AuthUser, @Query('range') range?: string) {
    return this.transactionService.getInsights(user.id, range === 'all' ? 'all' : '30d');
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.transactionService.create(user.id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.transactionService.remove(user.id, id);
  }

  @Patch(':id/note')
  async updateNote(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto) {
    return this.transactionService.updateNote(user.id, id, dto.note);
  }

  @Patch(':id/category')
  async updateCategory(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    if (dto.applyToAll) {
      return this.transactionService.updateCategoryForAll(user.id, id, dto.category);
    }
    return this.transactionService.updateCategory(user.id, id, dto.category);
  }

  /** Berapa transaksi merchant yang sama bakal ikut kalau user pilih "terapkan ke semua". */
  @Get(':id/same-merchant-count')
  async sameMerchantCount(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return { count: await this.transactionService.countSameMerchant(user.id, id) };
  }

  /** Halaman "Rapikan kategori" — merchant LAINNYA dikelompokkan, diurut nominal terbesar. */
  @Get('uncategorized-merchants')
  async uncategorizedMerchants(@CurrentUser() user: AuthUser) {
    return this.transactionService.getUncategorizedMerchants(user.id);
  }

  @Patch(':id/alias')
  async setAlias(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SetAliasDto) {
    return this.transactionService.setAlias(user.id, id, dto.displayName);
  }

  /** Override manual "pembelian besar" (dipakai tombol "Tandai rutin/besar" di Analisis). `null` = balik ke aturan otomatis. */
  @Patch(':id/big')
  async setBig(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SetBigDto) {
    return this.transactionService.setBig(user.id, id, dto.isBig);
  }
}
