import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// Import googleapis via require dan jadikan `any` supaya TypeScript tidak memuat seluruh
// type definitions Google APIs client pada saat build (ini yang menyebabkan heap out of memory).
const google = require('googleapis').google as any;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

@Injectable()
export class GmailAuthService {
  constructor(private prisma: PrismaService) {}

  private getOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI,
    );
  }

  getAuthUrl(): string {
    const client = this.getOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline', // wajib supaya dapat refresh_token
      prompt: 'consent', // paksa consent screen supaya refresh_token selalu diberikan
      scope: SCOPES,
    });
  }

  async handleCallback(code: string) {
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

    const existing = await this.prisma.gmailToken.findFirst();
    if (existing) {
      await this.prisma.gmailToken.update({
        where: { id: existing.id },
        data: { refreshToken: tokens.refresh_token, email: data.email || '' },
      });
    } else {
      await this.prisma.gmailToken.create({
        data: { refreshToken: tokens.refresh_token, email: data.email || '' },
      });
    }

    return { email: data.email };
  }

  async getStatus() {
    const token = await this.prisma.gmailToken.findFirst();
    return { connected: !!token, email: token?.email };
  }

  async disconnect() {
    await this.prisma.gmailToken.deleteMany();
    return { success: true };
  }

  /** Return authenticated Gmail API client, atau null kalau belum connect */
  async getGmailClient() {
    const tokenRow = await this.prisma.gmailToken.findFirst();
    if (!tokenRow) return null;

    const client = this.getOAuth2Client();
    client.setCredentials({ refresh_token: tokenRow.refreshToken });
    return google.gmail({ version: 'v1', auth: client });
  }
}
