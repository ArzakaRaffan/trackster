import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { ParseStatus } from '@prisma/client';
import { GmailSyncService } from '../gmail/gmail-sync.service';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertOwner } from '../../common/owner';

class BackfillDto {
  /** Inclusive start YYYY-MM-DD */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  after: string;

  /** Exclusive end YYYY-MM-DD (Gmail before:) */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  before: string;
}

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(
    private gmailSyncService: GmailSyncService,
    private prisma: PrismaService,
  ) {}

  @Post('trigger')
  async trigger(@CurrentUser() user: AuthUser) {
    await assertOwner(this.prisma, user.id);
    return this.gmailSyncService.syncEmails(user.id);
  }

  /** Tarik ulang email bank untuk rentang tanggal (isi gap yang terlewat window newer_than:7d). */
  @Post('backfill')
  async backfill(@CurrentUser() user: AuthUser, @Body() dto: BackfillDto) {
    await assertOwner(this.prisma, user.id);
    return this.gmailSyncService.syncEmails(user.id, {
      after: dto.after,
      before: dto.before,
      quiet: true,
    });
  }

  @Get('next-run')
  async nextRun() {
    return { nextRunAt: this.gmailSyncService.getNextRun() };
  }

  @Get('logs')
  async logs(@CurrentUser() user: AuthUser) {
    return this.prisma.emailSyncLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /** Hasil parse per email (E00-S2) — default UNPARSED biar langsung keliatan yang gagal dibaca. */
  @Get('parse-log')
  async parseLog(@CurrentUser() user: AuthUser, @Query('status') status?: ParseStatus, @Query('limit') limit?: string) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.prisma.emailParseLog.findMany({
      where: status ? { userId: user.id, status } : { userId: user.id },
      orderBy: { receivedAt: 'desc' },
      take,
    });
  }
}