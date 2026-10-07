/** Self-check: `npm run check -- per-user` — job per user: urut, satu gagal tak menghentikan yang lain, hanya ACTIVE. */
import * as assert from 'assert';
import { Logger } from '@nestjs/common';
import { forEachActiveUser } from './per-user';

(async () => {
  const asked: unknown[] = [];
  const prisma: any = { user: { findMany: async (q: any) => { asked.push(q.where); return [{ id: 1 }, { id: 2 }, { id: 3 }]; } } };
  const logger = { log: () => {}, error: () => {} } as unknown as Logger;
  const ran: number[] = [];
  await forEachActiveUser(prisma, logger, 'job', async (id) => {
    ran.push(id);
    if (id === 1) throw new Error('A gagal');
  });
  assert.deepStrictEqual(ran, [1, 2, 3], 'user 2 & 3 tetap jalan walau user 1 gagal');
  assert.deepStrictEqual(asked[0], { status: 'ACTIVE' }, 'hanya user ACTIVE');
  console.log('per-user.check OK');
})();
