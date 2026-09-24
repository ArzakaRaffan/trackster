/**
 * 2026-09-backfill-merchant-key.ts — E00-S3
 * Isi Transaction.merchantKey buat semua baris lama (kolom baru, cuma di-set otomatis untuk
 * transaksi baru sejak sesi ini). Aman dijalankan berkali-kali (idempotent, cuma nge-update yang
 * mismatch/null).
 *
 * Jalankan: npx ts-node prisma/data-fixes/2026-09-backfill-merchant-key.ts
 */
import { PrismaClient } from '@prisma/client';
import { merchantKey } from '../../src/common/merchant-key';

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    select: { id: true, description: true, merchantKey: true },
  });

  let updated = 0;
  for (const t of transactions) {
    const key = merchantKey(t.description);
    if (t.merchantKey === key) continue;
    await prisma.transaction.update({ where: { id: t.id }, data: { merchantKey: key } });
    updated++;
  }

  console.log(`${updated} dari ${transactions.length} transaksi di-update merchantKey-nya.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
