import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { generateToken, hashToken, isTokenShaped } from './api-token.util';

export const MAX_ACTIVE_TOKENS = 5;
const TOUCH_MS = 60_000; // lastUsedAt ditulis paling sering sekali per menit per token
const touched = new Map<number, number>();

export interface TokenAuth {
  userId: number;
  tokenId: number;
}

@Injectable()
export class ApiTokenService {
  constructor(private prisma: PrismaService) {}

  async list(userId: number) {
    return this.prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    });
  }

  /** Plaintext hanya ada di balasan ini; DB cuma menyimpan hash. */
  async create(userId: number, label: string) {
    const active = await this.prisma.apiToken.count({ where: { userId, revokedAt: null } });
    if (active >= MAX_ACTIVE_TOKENS) throw new BadRequestException(`Maksimal ${MAX_ACTIVE_TOKENS} token aktif. Cabut salah satu dulu.`);
    const token = generateToken();
    const row = await this.prisma.apiToken.create({
      data: { userId, label, tokenHash: hashToken(token), prefix: token.slice(0, 8), scopes: ['INGEST'] },
      select: { id: true, label: true, prefix: true, createdAt: true },
    });
    return { ...row, token };
  }

  async revoke(userId: number, id: number) {
    const { count } = await this.prisma.apiToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count === 0) throw new NotFoundException('Token tidak ditemukan');
    touched.delete(id);
    return { success: true };
  }

  /** Token valid = ada, belum dicabut, scope INGEST, dan pemiliknya ACTIVE. null = tolak (alasan sengaja tak dibedakan). */
  async authenticate(raw: string): Promise<TokenAuth | null> {
    if (!isTokenShaped(raw)) return null;
    const row = await this.prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      select: { id: true, userId: true, revokedAt: true, scopes: true, user: { select: { status: true } } },
    });
    if (!row || row.revokedAt || !row.scopes.includes('INGEST') || row.user.status !== 'ACTIVE') return null;

    const now = Date.now();
    if (now - (touched.get(row.id) ?? 0) > TOUCH_MS) {
      if (touched.size > 5000) touched.clear();
      touched.set(row.id, now);
      this.prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date(now) } }).catch(() => {});
    }
    return { userId: row.userId, tokenId: row.id };
  }
}
