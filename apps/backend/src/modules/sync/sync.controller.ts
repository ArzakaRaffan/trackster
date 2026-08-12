import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { GmailSyncService } from '../gmail/gmail-sync.service';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(
    private gmailSyncService: GmailSyncService,
    private prisma: PrismaService,
  ) {}

  @Post('trigger')
  async trigger() {
    return this.gmailSyncService.syncEmails();
  }

  @Get('logs')
  async logs() {
    return this.prisma.emailSyncLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
