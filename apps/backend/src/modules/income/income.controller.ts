import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IncomeStatus } from '@prisma/client';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { ResolveIncomeDto } from './dto/resolve-income.dto';
import { QuickIncomeDto } from './dto/quick-income.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { getOwnerUserId } from '../../common/owner';
import { PrismaService } from '../../prisma.service';

@Controller('income')
export class IncomeController {
  constructor(
    private incomeService: IncomeService,
    private prisma: PrismaService,
  ) {}

  /**
   * Endpoint cepat untuk iOS Shortcut / webhook eksternal tanpa JWT token.
   * Dilindungi secret key via header x-api-key, query ?key=, atau body.secret / body.key.
   * Otomatis auto-match kategori ke IncomeStream & kirim konfirmasi ke Telegram bot.
   */
  @Post('quick')
  async createQuick(
    @Body() dto: QuickIncomeDto,
    @Query('key') queryKey?: string,
    @Query('secret') querySecret?: string,
    @Headers('x-api-key') headerKey?: string,
  ) {
    const providedSecret = dto.secret || dto.key || querySecret || queryKey || headerKey;
    const validSecrets = [
      process.env.QUICK_INCOME_SECRET,
      process.env.TELEGRAM_WEBHOOK_SECRET,
      process.env.JWT_SECRET,
    ].filter(Boolean);

    if (!providedSecret || !validSecrets.includes(providedSecret)) {
      throw new ForbiddenException('Secret key tidak valid');
    }

    // Endpoint legacy tanpa JWT (Shortcut Arzaka) -> selalu milik user ADMIN pertama. Dihapus di Fase 6 (diganti ApiToken per user).
    return this.incomeService.createQuick(await getOwnerUserId(this.prisma), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: IncomeStatus,
  ) {
    return this.incomeService.findAll(user.id, { startDate, endDate, status });
  }


  @UseGuards(JwtAuthGuard)
  @Get('allocation')
  async getAllocation(@CurrentUser() user: AuthUser) {
    return this.incomeService.getAllocationRecommendation(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateIncomeDto) {
    return this.incomeService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIncomeDto) {
    return this.incomeService.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.incomeService.remove(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/resolve')
  async resolve(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolveIncomeDto) {
    return this.incomeService.resolve(user.id, id, dto);
  }
}
