import { Controller, Post, Body, Get, Patch, Delete, HttpException, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MemoryKind } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiRateLimitGuard } from '../../common/guards/ai-rate-limit.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
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
  @MaxLength(4000)
  message: string;
}

class SendThreadMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;
}

class UpdateThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

class SuggestCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description: string;

  @IsNumber()
  amount: number;
}

class CreateMemoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
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
  @MaxLength(1000)
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

  @UseGuards(AiRateLimitGuard)
  @Get('mascot-tip')
  async mascotTip(@CurrentUser() user: AuthUser) {
    return this.aiMascotService.getTip(user.id);
  }

  /** Debug — lihat persis teks yang disuntik ke system prompt sebagai kondisi keuangan saat ini. */
  @Get('snapshot')
  async snapshot(@CurrentUser() user: AuthUser) {
    const text = await this.financialSnapshotService.getSnapshot(user.id, true);
    return { text };
  }

  @Get('memory')
  async listMemory(@CurrentUser() user: AuthUser) {
    return this.aiMemoryService.listAll(user.id);
  }

  @Post('memory')
  async createMemory(@CurrentUser() user: AuthUser, @Body() body: CreateMemoryDto) {
    return this.aiMemoryService.create(user.id, body);
  }

  @Patch('memory/:id')
  async updateMemory(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateMemoryDto) {
    return this.aiMemoryService.update(user.id, id, body);
  }

  @Delete('memory/:id')
  async deleteMemory(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.aiMemoryService.remove(user.id, id);
    return { ok: true };
  }

  /** Legacy — bikin/lanjutkan thread "Quick chat" tunggal. Dipertahankan sampai frontend
   *  sepenuhnya pindah ke /ai/threads. */
  @UseGuards(AiRateLimitGuard)
  @Post('chat')
  async chat(@CurrentUser() user: AuthUser, @Body() body: ChatDto) {
    const reply = await this.aiChatService.handleMessage(user.id, body.message, { channel: 'web' });
    return { reply };
  }

  @Get('threads')
  async listThreads(@CurrentUser() user: AuthUser) {
    return this.aiChatService.listThreads(user.id);
  }

  @Post('threads')
  async createThread(@CurrentUser() user: AuthUser) {
    return this.aiChatService.createThread(user.id);
  }

  @Get('threads/:id/messages')
  async getThreadMessages(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.aiChatService.getMessages(user.id, id);
  }

  @UseGuards(AiRateLimitGuard)
  @Post('threads/:id/messages')
  async sendThreadMessage(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: SendThreadMessageDto) {
    const reply = await this.aiChatService.sendMessage(user.id, id, body.text);
    return { reply };
  }

  /** Sama dengan `POST threads/:id/messages`, tapi balasan dialirkan sebagai SSE:
   *  `{type:'token',text}` · `{type:'reset'}` (tool dipanggil, buang teks pembuka) · `{type:'done',reply}` · `{type:'error'}`.
   *  Pesan tetap disimpan lengkap oleh `sendMessage` — client yang putus di tengah tidak kehilangan balasan. */
  @UseGuards(AiRateLimitGuard)
  @Post('threads/:id/messages/stream')
  async streamThreadMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SendThreadMessageDto,
    @Res() res: Response,
  ) {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx jangan di-buffer, kalau tidak token baru muncul sekaligus di akhir
    });
    res.flushHeaders();
    const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    // Tool call bisa diam belasan detik — ping komentar supaya proxy tidak menutup koneksi.
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
    try {
      const reply = await this.aiChatService.sendMessage(user.id, id, body.text, {
        onToken: (text) => send({ type: 'token', text }),
        onToolRound: () => send({ type: 'reset' }),
      });
      send({ type: 'done', reply });
    } catch (err: any) {
      send({ type: 'error', message: err instanceof HttpException ? err.message : 'Gagal memproses pesan' });
    } finally {
      clearInterval(ping);
      res.end();
    }
  }

  @Patch('threads/:id')
  async updateThread(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateThreadDto) {
    return this.aiChatService.updateThread(user.id, id, body);
  }

  @Delete('threads/:id')
  async deleteThread(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.aiChatService.deleteThread(user.id, id);
    return { ok: true };
  }

  /** Dipakai halaman "Rapikan kategori" — saran kategori AI buat merchant yang masih LAINNYA.
   * Nggak nyimpen rule, cuma saran; rule baru kesimpen pas user beneran apply lewat
   * PATCH /transactions/:id/category?applyToAll. */
  @UseGuards(AiRateLimitGuard)
  @Post('suggest-category')
  async suggestCategory(@Body() body: SuggestCategoryDto) {
    const category = await this.aiChatService.categorize(body.description, body.amount);
    return { category };
  }

  /** "3 hal yang perlu kamu tahu" — kartu AI ringkas dari PeriodStats, di-cache per range per hari WIB. */
  @UseGuards(AiRateLimitGuard)
  @Get('insight-card')
  async insightCard(@CurrentUser() user: AuthUser, @Query('range') range?: string) {
    return this.aiInsightCardService.getInsightCard(user.id, range ?? '30d');
  }

  /** Return 12 data HealthScoreLog terakhir untuk chart trend di frontend */
  @Get('health-score/history')
  async healthScoreHistory(@CurrentUser() user: AuthUser) {
    return this.prisma.healthScoreLog.findMany({
      where: { userId: user.id },
      orderBy: { weekStart: 'desc' },
      take: 12,
    });
  }

  /** E05-S2: 3 opsi budget (E05-S1) + saran AI (opsi yang direkomendasikan, alasan, tips) — dipakai
   *  halaman /app/budget & kartu chat, digabung di sini (bukan di /budget) supaya BudgetModule
   *  tidak perlu bergantung ke AiModule (hindari circular module dependency). */
  @UseGuards(AiRateLimitGuard)
  @Get('budget-suggestions')
  async budgetSuggestions(@CurrentUser() user: AuthUser, @Query('week') week?: string) {
    const [suggestion, advice] = await Promise.all([
      this.budgetAdvisorService.getSuggestions(user.id, week),
      this.aiBudgetService.explain(user.id, week),
    ]);
    return { ...suggestion, advice };
  }

  /** Manual trigger weekly insight (untuk testing) */
  @UseGuards(AiRateLimitGuard)
  @Post('reports/trigger-weekly')
  async triggerWeekly(@CurrentUser() user: AuthUser) {
    await this.aiReportsService.sendWeeklyInsight(user.id);
    return { ok: true };
  }

  /** Manual trigger health score compute */
  @UseGuards(AiRateLimitGuard)
  @Post('reports/trigger-health-score')
  async triggerHealthScore(@CurrentUser() user: AuthUser) {
    const result = await this.aiReportsService.computeAndSaveHealthScore(user.id);
    return { ok: true, result };
  }
}
