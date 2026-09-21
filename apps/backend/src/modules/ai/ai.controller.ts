import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import { AiReportsService } from './ai-reports.service';
import { PrismaService } from '../../prisma.service';

class ChatDto {
  @IsString()
  @MinLength(1)
  message: string;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private aiChatService: AiChatService,
    private aiReportsService: AiReportsService,
    private prisma: PrismaService,
  ) {}

  @Post('chat')
  async chat(@Body() body: ChatDto) {
    const reply = await this.aiChatService.handleMessage(body.message, { channel: 'web' });
    return { reply };
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
