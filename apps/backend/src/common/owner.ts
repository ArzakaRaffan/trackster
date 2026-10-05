import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
 * Jalur Gmail/sync masih memakai konfigurasi pemilik (OWNER_FULL_NAME/OWNER_ACCOUNT_NUMBERS dari env) di parser sampai Fase 3,
 * jadi hanya pemilik yang boleh menyambungkan/memicu. User lain mendapat 403 (bukan data salah yang diam-diam tercatat).
 */
export async function assertOwner(prisma: Pick<PrismaClient, 'user'>, userId: number): Promise<void> {
  if ((await getOwnerUserId(prisma)) !== userId) throw new ForbiddenException('Fitur ini hanya untuk pemilik akun');
}
