import { Controller, Post, Body, Get, Patch, Delete, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import { AiReportsService } from './ai-reports.service';
import { AiMascotService } from './ai-mascot.service';
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

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private aiChatService: AiChatService,
    private aiReportsService: AiReportsService,
    private aiMascotService: AiMascotService,
    private prisma: PrismaService,
  ) {}

  @Get('mascot-tip')
  async mascotTip() {
    return this.aiMascotService.getTip();
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

  /** Return 12 data HealthScoreLog terakhir untuk chart trend di frontend */
  @Get('health-score/history')
  async healthScoreHistory() {
    return this.prisma.healthScoreLog.findMany({
      orderBy: { weekStart: 'desc' },
      take: 12,
    });
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
