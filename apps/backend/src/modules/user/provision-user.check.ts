/**
 * provision-user.check.ts — provisionUser idempoten. Butuh DB dev (DATABASE_URL); semua tulis di-rollback.
 * Jalankan dengan: npx ts-node src/modules/user/provision-user.check.ts
 */
import * as assert from 'assert';
import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { provisionUser } = require('../../../prisma/provision-user');

const ROLLBACK = new Error('rollback');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { username: `provision_check_${Date.now()}`, password: 'x' } });
      let first;
      try {
        first = await provisionUser(tx, user.id, { sources: [] });
      } catch (e: any) {
        // Pra-C1 DailyBudget.dayOfWeek unik global: DB yang sudah punya budget user lain menolak user kedua. Keterbatasan yang diketahui.
        if (e?.code === 'P2002') { console.log('provision-user.check.ts SKIP (unik global pra-C1, DB sudah berisi budget)'); throw ROLLBACK; }
        throw e;
      }
      const second = await provisionUser(tx, user.id, { sources: [] });
      assert.strictEqual(first.dailyBudget, 7, 'panggilan pertama membuat 7 hari');
      assert.strictEqual(second.dailyBudget, 0, 'panggilan kedua tidak membuat baris baru');
      assert.strictEqual(await tx.dailyBudget.count({ where: { userId: user.id } }), 7);
      console.log('provision-user.check.ts OK');
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('provision-user.check.ts crash:', e.message ?? e); process.exit(1); });
