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

@Controller('income')
export class IncomeController {
  constructor(private incomeService: IncomeService) {}

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

    return this.incomeService.createQuick(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: IncomeStatus,
  ) {
    return this.incomeService.findAll({ startDate, endDate, status });
  }


  @UseGuards(JwtAuthGuard)
  @Get('allocation')
  async getAllocation() {
    return this.incomeService.getAllocationRecommendation();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateIncomeDto) {
    return this.incomeService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIncomeDto) {
    return this.incomeService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.incomeService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/resolve')
  async resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveIncomeDto) {
    return this.incomeService.resolve(id, dto);
  }
}
