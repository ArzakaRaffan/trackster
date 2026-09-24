import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { IsNumber, IsString, MinLength } from 'class-validator';
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

  @Post('chat')
  async chat(@Body() body: ChatDto) {
    const reply = await this.aiChatService.handleMessage(body.message, { channel: 'web' });
    return { reply };
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
