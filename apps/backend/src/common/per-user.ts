import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Jalankan job untuk tiap user ACTIVE, berurutan; gagal di satu user TIDAK menghentikan user lain.
 * Versi minimal (Fase 2). Fase 4 menambah jitter/konkurensi/log durasi (`PerUserJobRunner`, 02-Target-Architecture §7).
 */
export async function forEachActiveUser(
  prisma: Pick<PrismaClient, 'user'>,
  logger: Logger,
  jobName: string,
  fn: (userId: number) => Promise<unknown>,
): Promise<void> {
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } });
  for (const { id } of users) {
    try {
      await fn(id);
    } catch (err: any) {
      logger.error(`[${jobName}] user ${id} gagal: ${err?.message ?? err}`);
    }
  }
}
