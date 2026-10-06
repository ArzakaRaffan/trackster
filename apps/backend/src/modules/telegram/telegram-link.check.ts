/**
 * telegram-link.check.ts — tautan bot bersama: kode sekali pakai, chat unik per user, webhook memetakan chat->user.
 * Butuh DB dev (DATABASE_URL); baris uji dihapus di akhir.
 * Jalankan dengan: npx ts-node src/modules/telegram/telegram-link.check.ts
 */
import * as assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { TelegramService } from './telegram.service';

async function main() {
  const prisma = new PrismaClient();
  try {
    const ids: number[] = [];
    try {
      const tx = prisma;
      const svc = new TelegramService(prisma as any);
      const a = await tx.user.create({ data: { username: `tg_a_${Date.now()}`, password: 'x' } });
      const b = await tx.user.create({ data: { username: `tg_b_${Date.now()}`, password: 'x' } });
      ids.push(a.id, b.id);

      const { code } = await svc.createLinkCode(a.id);
      assert.strictEqual(await svc.linkChatByCode('900001', 'SALAH'), null, 'kode salah ditolak');
      assert.strictEqual(await svc.linkChatByCode('900001', code), a.id, 'kode benar menautkan ke A');
      assert.strictEqual(await svc.linkChatByCode('900002', code), null, 'kode sekali pakai');
      assert.deepStrictEqual(await svc.getConfigByChatId('900001'), { userId: a.id });

      const { code: codeB } = await svc.createLinkCode(b.id);
      assert.strictEqual(await svc.linkChatByCode('900001', codeB), null, 'chat milik A tidak bisa ditautkan ke B');
      assert.strictEqual(await svc.getConfigByChatId('900001').then((r) => r?.userId), a.id);

      console.log('telegram-link.check.ts OK');
    } finally {
      await prisma.telegramLink.deleteMany({ where: { userId: { in: ids } } });
      await prisma.telegramLinkCode.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('telegram-link.check.ts GAGAL', e); process.exit(1); });
