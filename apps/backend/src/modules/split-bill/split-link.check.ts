/**
 * split-link.check.ts — split bill tertaut transaksi: peserta (selain pembuat) jadi patungan; lunas <-> diterima sinkron;
 * patungan tertaut hanya mengurangi pengeluaran (saldo tidak bergerak); assign ulang memperbarui nominal; hapus ditolak.
 * Butuh DB dev (DATABASE_URL); baris uji dihapus di akhir.
 * Jalankan dengan: npx ts-node src/modules/split-bill/split-link.check.ts
 */
import * as assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { SplitBillService } from './split-bill.service';
import { ReimbursementService } from '../reimbursement/reimbursement.service';

async function main() {
  const prisma = new PrismaClient();
  const svc = new SplitBillService(prisma as any);
  const balance = { getLastManualAdjustmentAt: async () => null, adjustBalance: async () => { throw new Error('saldo tak boleh bergerak'); } };
  const rb = new ReimbursementService(prisma as any, balance as any);
  const u = await prisma.user.create({ data: { username: `split_link_${Date.now()}`, password: 'x' } });
  try {
    const t = await prisma.transaction.create({
      data: { userId: u.id, amount: 120000, description: 'Warung Uji', source: 'BCA', emailId: `t:${Date.now()}`, occurredAt: new Date() },
    });
    const net = async () => { const x = await prisma.transaction.findUniqueOrThrow({ where: { id: t.id } }); return Number(x.amount) - Number(x.reimbursedAmount); };
    const rbs = () => prisma.reimbursement.findMany({ where: { transactionId: t.id }, orderBy: { id: 'asc' } });

    // Saya 40rb, Ibnu 50rb, Sari 30rb
    const bill = await svc.create(u.id, {
      restaurantName: 'Warung Uji', billDate: new Date().toISOString(), transactionId: t.id,
      participants: [{ name: 'Saya' }, { name: 'Ibnu' }, { name: 'Sari' }],
      items: [
        { description: 'A', amount: 40000, shares: [{ participantIndex: 0, weight: 1 }] },
        { description: 'B', amount: 50000, shares: [{ participantIndex: 1, weight: 1 }] },
        { description: 'C', amount: 30000, shares: [{ participantIndex: 2, weight: 1 }] },
      ],
    } as any);
    let r = await rbs();
    assert.deepStrictEqual(r.map((x) => [x.personName, Number(x.amount), x.status]), [['Ibnu', 50000, 'PENDING'], ['Sari', 30000, 'PENDING']], 'patungan dibuat, pembuat tidak');
    assert.strictEqual(await net(), 120000, 'belum ada yang lunas');
    await assert.rejects(svc.create(u.id, { restaurantName: 'x', billDate: new Date().toISOString(), transactionId: t.id, participants: [{ name: 'a' }], items: [] } as any), /sudah punya split bill/);

    const [, ibnu, sari] = bill.participants;
    await svc.togglePaidPublic(bill.publicSlug, ibnu.id); // teman tandai lunas di halaman publik
    assert.strictEqual(await net(), 70000, 'lunas publik langsung mengurangi pengeluaran');
    await svc.togglePaidPublic(bill.publicSlug, ibnu.id); // batal
    assert.strictEqual(await net(), 120000, 'batal lunas mengembalikan');

    // assign ulang item C ke Ibnu + Sari -> Ibnu 65rb, Sari 15rb
    await svc.assignShares(bill.id, bill.items[2].id, u.id, { shares: [{ participantId: ibnu.id, weight: 1 }, { participantId: sari.id, weight: 1 }] } as any);
    r = await rbs();
    assert.deepStrictEqual(r.map((x) => Number(x.amount)), [65000, 15000], 'nominal ikut assign ulang');

    // "Sudah transfer" dari kartu transaksi -> peserta ikut lunas, saldo tidak bergerak (balance stub melempar bila dipanggil)
    await rb.markReceived(u.id, r[1].id, {} as any);
    assert.strictEqual(await net(), 105000);
    assert.strictEqual((await prisma.splitBillParticipant.findUniqueOrThrow({ where: { id: sari.id } })).isPaid, true, 'peserta ikut lunas');
    await assert.rejects(rb.remove(u.id, r[0].id), /lewat split bill/, 'hapus patungan tertaut ditolak');

    // assign ulang setelah lunas: selisih nominal masuk ke pengeluaran
    await svc.assignShares(bill.id, bill.items[2].id, u.id, { shares: [{ participantId: sari.id, weight: 1 }] } as any);
    assert.strictEqual(await net(), 90000, 'Sari lunas 30rb setelah assign ulang');

    console.log('split-link.check.ts OK');
  } finally {
    const bills = await prisma.splitBill.findMany({ where: { createdByUserId: u.id }, select: { id: true } });
    await prisma.reimbursement.deleteMany({ where: { userId: u.id } });
    await prisma.splitBill.deleteMany({ where: { id: { in: bills.map((b) => b.id) } } });
    await prisma.transaction.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
