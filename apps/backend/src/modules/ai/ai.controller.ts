import { Controller, Post, Body, Get, Patch, Delete, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { MemoryKind } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import { AiReportsService } from './ai-reports.service';
import { AiMascotService } from './ai-mascot.service';
import { FinancialSnapshotService } from './financial-snapshot.service';
import { AiMemoryService } from './ai-memory.service';
import { AiInsightCardService } from './ai-insight-card.service';
import { AiBudgetService } from './ai-budget.service';
import { BudgetAdvisorService } from '../budget/budget-advisor.service';
import { PrismaService } from '../../prisma.service';

class ChatDto {
  @IsString()
  @MinLength(1)
  message: string;
}

class SendThreadMessageDto {
  @IsString()
  @MinLength(1)
  text: string;
}

class UpdateThreadDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

class SuggestCategoryDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  amount: number;
}

class CreateMemoryDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsEnum(MemoryKind)
  kind: MemoryKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  importance?: number;

  @IsOptional()
  @IsString()
  validUntil?: string;
}

class UpdateMemoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsEnum(MemoryKind)
  kind?: MemoryKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  importance?: number;

  @IsOptional()
  @IsString()
  validUntil?: string | null;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private aiChatService: AiChatService,
    private aiReportsService: AiReportsService,
    private aiMascotService: AiMascotService,
    private financialSnapshotService: FinancialSnapshotService,
    private aiMemoryService: AiMemoryService,
    private aiInsightCardService: AiInsightCardService,
    private aiBudgetService: AiBudgetService,
    private budgetAdvisorService: BudgetAdvisorService,
    private prisma: PrismaService,
  ) {}

  @Get('mascot-tip')
  async mascotTip() {
    return this.aiMascotService.getTip();
  }

  /** Debug — lihat persis teks yang disuntik ke system prompt sebagai kondisi keuangan saat ini. */
  @Get('snapshot')
  async snapshot() {
    const text = await this.financialSnapshotService.getSnapshot(true);
    return { text };
  }

  @Get('memory')
  async listMemory() {
    return this.aiMemoryService.listAll();
  }

  @Post('memory')
  async createMemory(@Body() body: CreateMemoryDto) {
    return this.aiMemoryService.create(body);
  }

  @Patch('memory/:id')
  async updateMemory(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateMemoryDto) {
    return this.aiMemoryService.update(id, body);
  }

  @Delete('memory/:id')
  async deleteMemory(@Param('id', ParseIntPipe) id: number) {
    await this.aiMemoryService.remove(id);
    return { ok: true };
  }

  /** Legacy — bikin/lanjutkan thread "Quick chat" tunggal. Dipertahankan sampai frontend
   *  sepenuhnya pindah ke /ai/threads. */
  @Post('chat')
  async chat(@Body() body: ChatDto) {
    const reply = await this.aiChatService.handleMessage(body.message, { channel: 'web' });
    return { reply };
  }

  @Get('threads')
  async listThreads() {
    return this.aiChatService.listThreads();
  }

  @Post('threads')
  async createThread() {
    return this.aiChatService.createThread();
  }

  @Get('threads/:id/messages')
  async getThreadMessages(@Param('id', ParseIntPipe) id: number) {
    return this.aiChatService.getMessages(id);
  }

  @Post('threads/:id/messages')
  async sendThreadMessage(@Param('id', ParseIntPipe) id: number, @Body() body: SendThreadMessageDto) {
    const reply = await this.aiChatService.sendMessage(id, body.text);
    return { reply };
  }

  @Patch('threads/:id')
  async updateThread(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateThreadDto) {
    return this.aiChatService.updateThread(id, body);
  }

  @Delete('threads/:id')
  async deleteThread(@Param('id', ParseIntPipe) id: number) {
    await this.aiChatService.deleteThread(id);
    return { ok: true };
  }

  /** Dipakai halaman "Rapikan kategori" — saran kategori AI buat merchant yang masih LAINNYA.
   * Nggak nyimpen rule, cuma saran; rule baru kesimpen pas user beneran apply lewat
   * PATCH /transactions/:id/category?applyToAll. */
  @Post('suggest-category')
  async suggestCategory(@Body() body: SuggestCategoryDto) {
    const category = await this.aiChatService.categorize(body.description, body.amount);
    return { category };
  }

  /** "3 hal yang perlu kamu tahu" — kartu AI ringkas dari PeriodStats, di-cache per range per hari WIB. */
  @Get('insight-card')
  async insightCard(@Query('range') range?: string) {
    return this.aiInsightCardService.getInsightCard(range ?? '30d');
  }

  /** Return 12 data HealthScoreLog terakhir untuk chart trend di frontend */
  @Get('health-score/history')
  async healthScoreHistory() {
    return this.prisma.healthScoreLog.findMany({
      orderBy: { weekStart: 'desc' },
      take: 12,
    });
  }

  /** E05-S2: 3 opsi budget (E05-S1) + saran AI (opsi yang direkomendasikan, alasan, tips) — dipakai
   *  halaman /app/budget & kartu chat, digabung di sini (bukan di /budget) supaya BudgetModule
   *  tidak perlu bergantung ke AiModule (hindari circular module dependency). */
  @Get('budget-suggestions')
  async budgetSuggestions(@Query('week') week?: string) {
    const [suggestion, advice] = await Promise.all([
      this.budgetAdvisorService.getSuggestions(week),
      this.aiBudgetService.explain(week),
    ]);
    return { ...suggestion, advice };
  }

  /** Manual trigger weekly insight (untuk testing) */
  @Post('reports/trigger-weekly')
  async triggerWeekly() {
    await this.aiReportsService.sendWeeklyInsight();
    return { ok: true };
  }

  /** Manual trigger health score compute */
  @Post('reports/trigger-health-score')
  async triggerHealthScore() {
    const result = await this.aiReportsService.computeAndSaveHealthScore();
    return { ok: true, result };
  }
}
