import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { OwnerContext } from '../modules/gmail/parsers/own-accounts';

/**
 * User "pemilik" (ADMIN pertama; fallback user dengan id terkecil) untuk jalur LEGACY yang tidak punya konteks user
 * (endpoint `/income/quick` berbasis secret) atau yang memang khusus pemilik (Gmail OAuth/Calendar, `/sync/*`).
 * Sementara — hilang saat Fase 6/7 (ApiToken & forwarding).
 */
export async function getOwnerUserId(prisma: Pick<PrismaClient, 'user'>): Promise<number> {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } });
  if (admin) return admin.id;
  const first = await prisma.user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (!first) throw new Error('Belum ada user — jalankan seed');
  return first.id;
}

/**
 * Jalur Gmail/sync khusus pemilik (OAuth Gmail milik Arzaka; user lain memakai forwarding, Fase 7). User lain mendapat 403 (bukan data salah yang diam-diam tercatat).
 */
export async function assertOwner(prisma: Pick<PrismaClient, 'user'>, userId: number): Promise<void> {
  if ((await getOwnerUserId(prisma)) !== userId) throw new ForbiddenException('Fitur ini hanya untuk pemilik akun');
}

/**
 * Konteks pemilik per user (nama rekening + rekening miliknya) untuk parser & klasifikasi income.
 * ponytail: pemilik (ADMIN pertama) yang datanya belum diisi → fallback env OWNER_* supaya perilaku prod tidak berubah
 * sebelum skrip backfill-owner dijalankan; hapus fallback ini setelah skrip itu `--apply` di prod.
 */
export async function getOwnerContext(prisma: Pick<PrismaClient, 'user' | 'ownAccount'>, userId: number): Promise<OwnerContext> {
  const [user, own] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
    prisma.ownAccount.findMany({ where: { userId }, select: { accountNumber: true } }),
  ]);
  const ctx: OwnerContext = { fullName: user?.fullName ?? '', accounts: own.map((a) => a.accountNumber) };
  if ((!ctx.fullName || !ctx.accounts.length) && (await getOwnerUserId(prisma)) === userId) {
    if (!ctx.fullName) ctx.fullName = process.env.OWNER_FULL_NAME || '';
    if (!ctx.accounts.length) ctx.accounts = (process.env.OWNER_ACCOUNT_NUMBERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return ctx;
}
