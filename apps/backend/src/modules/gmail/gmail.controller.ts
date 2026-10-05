import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GmailAuthService } from './gmail-auth.service';
import { GmailSyncService } from './gmail-sync.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertOwner } from '../../common/owner';
import { PrismaService } from '../../prisma.service';

@Controller('gmail')
export class GmailController {
  constructor(
    private gmailAuthService: GmailAuthService,
    private gmailSyncService: GmailSyncService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth-url')
  async getAuthUrl(@CurrentUser() user: AuthUser) {
    await assertOwner(this.prisma, user.id); // Gmail masih pakai konfigurasi pemilik sampai Fase 3
    return { url: this.gmailAuthService.getAuthUrl(user.id) };
  }

  // TIDAK pakai JwtAuthGuard - ini dipanggil langsung oleh Google redirect, bukan dari frontend fetch.
  // Identitas = `state` bertanda tangan yang dibuat getAuthUrl(userId).
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      await this.gmailAuthService.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/settings?gmail=connected`);
    } catch (err) {
      return res.redirect(`${frontendUrl}/settings?gmail=error&message=${encodeURIComponent(err.message)}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@CurrentUser() user: AuthUser) {
    return this.gmailAuthService.getStatus(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: AuthUser) {
    return this.gmailAuthService.disconnect(user.id);
  }
}
