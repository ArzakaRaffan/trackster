import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { PrismaService } from '../../prisma.service';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

@Injectable()
export class GmailAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private getOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI,
    );
  }

  /** `state` = JWT pendek bertanda tangan server berisi userId pemulai alur — callback (tanpa cookie/JWT) hanya bisa
   * menyimpan token untuk user itu. Tanpa ini siapa pun yang menyelesaikan OAuth bisa menimpa token user lain. */
  getAuthUrl(userId: number): string {
    const client = this.getOAuth2Client();
    const state = this.jwtService.sign({ sub: userId, purpose: 'gmail-oauth' }, { secret: process.env.JWT_SECRET, expiresIn: '10m' });
    return client.generateAuthUrl({
      access_type: 'offline', // wajib supaya dapat refresh_token
      prompt: 'consent', // paksa consent screen supaya refresh_token selalu diberikan
      scope: SCOPES,
      state,
    });
  }

  private userIdFromState(state: string | undefined): number {
    try {
      const payload = this.jwtService.verify(state ?? '', { secret: process.env.JWT_SECRET });
      if (payload?.purpose === 'gmail-oauth' && Number.isInteger(payload.sub)) return payload.sub;
    } catch {
      // jatuh ke throw di bawah
    }
    throw new UnauthorizedException('State OAuth tidak valid atau kedaluwarsa — mulai ulang dari Setting.');
  }

  async handleCallback(code: string, state: string | undefined) {
    const userId = this.userIdFromState(state);
    const client = this.getOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error(
        'Google tidak mengembalikan refresh_token. Coba disconnect akses app ini di myaccount.google.com/permissions lalu ulangi.',
      );
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();

    const existing = await this.prisma.gmailToken.findFirst({ where: { userId } });
    if (existing) {
      await this.prisma.gmailToken.updateMany({
        where: { id: existing.id, userId },
        data: { refreshToken: tokens.refresh_token, email: data.email || '' },
      });
    } else {
      await this.prisma.gmailToken.create({
        data: { userId, refreshToken: tokens.refresh_token, email: data.email || '' },
      });
    }

    return { email: data.email };
  }

  async getStatus(userId: number) {
    const token = await this.prisma.gmailToken.findFirst({ where: { userId } });
    return { connected: !!token, email: token?.email };
  }

  async disconnect(userId: number) {
    await this.prisma.gmailToken.deleteMany({ where: { userId } });
    return { success: true };
  }

  private async getAuthedOAuth2Client(userId: number) {
    const tokenRow = await this.prisma.gmailToken.findFirst({ where: { userId } });
    if (!tokenRow) return null;

    const client = this.getOAuth2Client();
    client.setCredentials({ refresh_token: tokenRow.refreshToken });
    return client;
  }

  /** Return authenticated Gmail API client, atau null kalau belum connect */
  async getGmailClient(userId: number) {
    const client = await this.getAuthedOAuth2Client(userId);
    if (!client) return null;
    return google.gmail({ version: 'v1', auth: client });
  }

  /** Return authenticated Calendar API client, atau null kalau belum connect */
  async getCalendarClient(userId: number) {
    const client = await this.getAuthedOAuth2Client(userId);
    if (!client) return null;
    return google.calendar({ version: 'v3', auth: client });
  }
}