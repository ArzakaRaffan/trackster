/**
 * balance-applied.check.ts — hapus/edit hanya membalik saldo yang masih "hidup" (`balanceApplied`), koreksi manual
 * menyerap semuanya, dan hapus bersamaan (double-tap) tidak menggandakan saldo.
 * Butuh DB dev (DATABASE_URL); user uji dihapus di akhir. Jalankan: npm run check -- balance-applied
 */
import * as assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { BalanceService } from './balance.service';
import { TransactionService } from '../transaction/transaction.service';
import { IncomeService } from '../income/income.service';

async function main() {
  const prisma = new PrismaClient();
  const balance = new BalanceService(prisma as any);
  const txs = new TransactionService(prisma as any, balance, null as any, null as any);
  const incomes = new IncomeService(prisma as any, balance, null as any, null as any);
  const u = await prisma.user.create({ data: { username: `bal_applied_${Date.now()}`, password: 'x' } });
  const saldo = async () => Number((await prisma.bankBalance.findFirst({ where: { userId: u.id, source: 'BCA' } }))?.balance ?? 0);
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  try {
    // Pemasukan manual tercatat, lalu saldo dikoreksi ke angka bank → hapus pemasukan itu tak boleh mengurangi saldo lagi.
    const inc = await incomes.create(u.id, { amount: 100_000, description: 'gaji', source: 'BCA', receivedAt: ago(60) } as any);
    await balance.correctBalance(u.id, 'BCA', 1_000_000);
    await incomes.update(u.id, inc.id, { amount: 150_000 } as any);
    assert.strictEqual(await saldo(), 1_000_000, 'edit pemasukan yang sudah diserap koreksi: saldo tetap');
    await incomes.remove(u.id, inc.id);
    assert.strictEqual(await saldo(), 1_000_000, 'hapus pemasukan yang sudah diserap koreksi: saldo tetap');

    // Transaksi manual bertanggal sebelum koreksi: mengurangi saldo saat dicatat → hapus harus mengembalikannya.
    const manual = await txs.create(u.id, { amount: 20_000, description: 'tunai', source: 'BCA', occurredAt: ago(120) } as any);
    assert.strictEqual(await saldo(), 980_000);
    await txs.remove(u.id, manual.id);
    assert.strictEqual(await saldo(), 1_000_000, 'hapus transaksi manual mundur: saldo kembali');

    // Email backfill sebelum koreksi: tak menggerakkan saldo, hapus juga tidak.
    const old = await txs.createFromParsed(u.id, { amount: 50_000, description: 'lama', source: 'BCA', emailId: `e:${Date.now()}`, occurredAt: new Date(ago(180)) });
    assert.strictEqual(old!.balanceApplied, false);
    assert.strictEqual(await saldo(), 1_000_000);
    await txs.remove(u.id, old!.id);
    assert.strictEqual(await saldo(), 1_000_000);

    // Pemasukan hidup (sesudah koreksi): edit nominal menggeser saldo sebesar selisih.
    const live = await incomes.create(u.id, { amount: 10_000, description: 'x', source: 'BCA', receivedAt: new Date().toISOString() } as any);
    await incomes.update(u.id, live.id, { amount: 30_000 } as any);
    assert.strictEqual(await saldo(), 1_030_000, 'edit pemasukan hidup: saldo ikut selisih');

    // Double-tap hapus: hanya satu yang berhasil, saldo kembali sekali.
    const t = await txs.create(u.id, { amount: 40_000, description: 'kopi', source: 'BCA', occurredAt: new Date().toISOString() } as any);
    assert.strictEqual(await saldo(), 990_000);
    const res = await Promise.allSettled([txs.remove(u.id, t.id), txs.remove(u.id, t.id)]);
    assert.strictEqual(res.filter((r) => r.status === 'fulfilled').length, 1, 'satu hapus berhasil, satu ditolak');
    assert.strictEqual(await saldo(), 1_030_000, 'saldo dikembalikan sekali saja');

    console.log('balance-applied.check OK');
  } finally {
    for (const m of ['transaction', 'income', 'balanceAdjustment', 'bankBalance'] as const) await (prisma[m] as any).deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
