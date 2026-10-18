/**
 * ai-quota.check.ts — kuota harian AI per user tersimpan di AiUsage (bertahan restart), aman dipanggil bersamaan.
 * Butuh DB dev (DATABASE_URL); user uji dihapus di akhir. Jalankan: npm run check -- ai-quota
 */
import * as assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { aiUserQuotaOk } from './ai-rate-limit.guard';

async function main() {
  const prisma = new PrismaClient();
  const u = await prisma.user.create({ data: { username: `ai_quota_${Date.now()}`, password: 'x' } });
  try {
    const first = await Promise.all([1, 2].map(() => aiUserQuotaOk(prisma, u.id, 'CHAT', 3)));
    assert.deepStrictEqual(first, [true, true], 'dua panggilan pertama bersamaan: keduanya lolos, tanpa error unik');
    assert.strictEqual(await aiUserQuotaOk(prisma, u.id, 'CHAT', 3), true);
    assert.strictEqual(await aiUserQuotaOk(prisma, u.id, 'CHAT', 3), false, 'panggilan ke-4 kena batas 3');
    assert.strictEqual(await aiUserQuotaOk(prisma, u.id, 'POST /ai/x', 3), true, 'kind lain punya hitungan sendiri');
    const row = await prisma.aiUsage.findFirst({ where: { userId: u.id, kind: 'CHAT' } });
    assert.strictEqual(row?.count, 4, 'hitungan ada di DB (bukan memori proses)');
    console.log('ai-quota.check OK');
  } finally {
    await prisma.aiUsage.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
