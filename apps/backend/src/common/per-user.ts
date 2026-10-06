import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Jalankan job untuk tiap user ACTIVE, berurutan; gagal di satu user TIDAK menghentikan user lain.
 * `jitterMs` = jeda acak 0..jitterMs antar user (meratakan beban AI/Telegram; user pertama langsung jalan).
 * Log per user: durasi + status. ponytail: berurutan (concurrency 1), naikkan bila user > ~20.
 */
export async function forEachActiveUser(
  prisma: Pick<PrismaClient, 'user'>,
  logger: Logger,
  jobName: string,
  fn: (userId: number) => Promise<unknown>,
  opts: { jitterMs?: number } = {},
): Promise<void> {
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } });
  for (const [i, { id }] of users.entries()) {
    if (i > 0 && opts.jitterMs) await new Promise((r) => setTimeout(r, Math.random() * opts.jitterMs!));
    const t0 = Date.now();
    try {
      await fn(id);
      logger.log(`[${jobName}] user ${id} ok (${Date.now() - t0}ms)`);
    } catch (err: any) {
      logger.error(`[${jobName}] user ${id} gagal (${Date.now() - t0}ms): ${err?.message ?? err}`);
    }
  }
}
