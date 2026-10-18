/**
 * balance-only.check.ts — email transfer ke rekening sendiri (`balanceOnly`): saldo didebit sekali walau email diproses
 * ulang, dan debit + log EXCLUDED atomik (log gagal → debit batal, sync berikutnya mencoba lagi tanpa dobel).
 * Butuh DB dev (DATABASE_URL); user uji dihapus di akhir. Jalankan: npm run check -- balance-only
 */
import * as assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { EmailPipelineService } from './email-pipeline.service';
import { BalanceService } from '../balance/balance.service';

async function main() {
  const prisma = new PrismaClient();
  const parsed = { amount: 75_000, description: 'ke rekening sendiri', source: 'BCA', occurredAt: new Date(), excluded: true, balanceOnly: true, excludeReason: 'own' };
  const registry = { parseEmailWithSource: () => ({ parser: 'uji', result: parsed }) };
  const pipeline = new EmailPipelineService(registry as any, null as any, null as any, null as any, prisma as any, null as any, null as any, null as any, null as any, null as any, new BalanceService(prisma as any));
  const u = await prisma.user.create({ data: { username: `bal_only_${Date.now()}`, password: 'x' } });
  const saldo = async () => Number((await prisma.bankBalance.findFirst({ where: { userId: u.id, source: 'BCA' } }))?.balance ?? 0);
  const noop = () => {};
  const cb = { onRecorded: noop, onIncomeRecorded: noop, onDuplicate: noop, onExcluded: noop, onUnparsed: noop };
  const meta = { from: 'bca', subject: 'transfer', receivedAt: new Date() };
  const raw = { id: 'x', from: 'bca', subject: 'transfer', body: 'transfer', internalDate: '0' };
  try {
    // Log gagal ditulis (mis. DB putus) → debit ikut dibatalkan.
    const orig = pipeline.logParseResult.bind(pipeline);
    pipeline.logParseResult = async () => { throw new Error('log gagal'); };
    await assert.rejects(pipeline.process(u.id, `bo:${u.id}`, raw, meta, false, cb), /log gagal/);
    assert.strictEqual(await saldo(), 0, 'debit dibatalkan bersama log');
    pipeline.logParseResult = orig;

    await pipeline.process(u.id, `bo:${u.id}`, raw, meta, false, cb);
    await pipeline.process(u.id, `bo:${u.id}`, raw, meta, false, cb);
    assert.strictEqual(await saldo(), -75_000, 'didebit sekali walau diproses dua kali');
    const log = await prisma.emailParseLog.findFirst({ where: { userId: u.id, emailId: `bo:${u.id}` } });
    assert.strictEqual(log?.status, 'EXCLUDED');
    console.log('balance-only.check OK');
  } finally {
    for (const m of ['emailParseLog', 'bankBalance'] as const) await (prisma[m] as any).deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
