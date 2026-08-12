import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { GmailAuthService } from './gmail-auth.service';
import { GmailSyncService } from './gmail-sync.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('gmail')
export class GmailController {
  constructor(
    private gmailAuthService: GmailAuthService,
    private gmailSyncService: GmailSyncService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth-url')
  async getAuthUrl() {
    return { url: this.gmailAuthService.getAuthUrl() };
  }

  // TIDAK pakai JwtAuthGuard - ini dipanggil langsung oleh Google redirect, bukan dari frontend fetch
  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      await this.gmailAuthService.handleCallback(code);
      return res.redirect(`${frontendUrl}/settings?gmail=connected`);
    } catch (err) {
      return res.redirect(`${frontendUrl}/settings?gmail=error&message=${encodeURIComponent(err.message)}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status() {
    return this.gmailAuthService.getStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect() {
    return this.gmailAuthService.disconnect();
  }
}
