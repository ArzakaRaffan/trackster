// provisionUser(prisma, userId): data awal tenant untuk satu user. IDEMPOTEN (aman dipanggil berulang).
// Plain JS supaya bisa dipakai prisma/seed.js (tanpa ts-node) dan diimpor dari kode Nest. `prisma` boleh PrismaClient atau tx.
// Memakai findFirst+create (bukan upsert by unique) agar tetap benar sebelum & sesudah unique global -> komposit (C1).
// BudgetSetting dibuat malas oleh BudgetService (belum ada baris = rollover mati).
const DEFAULT_DAILY_BUDGET = 50000; // Rp50.000/hari, 0=Minggu ... 6=Sabtu (sama seperti seed lama)
const DEFAULT_SOURCES = ['BCA', 'JAGO']; // saldo awal 0; koreksi manual lewat PUT /balance/:source

async function provisionUser(prisma, userId, { sources = DEFAULT_SOURCES, dailyBudget = DEFAULT_DAILY_BUDGET } = {}) {
  const created = { dailyBudget: 0, bankBalance: 0 };
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    if (await prisma.dailyBudget.findFirst({ where: { userId, dayOfWeek }, select: { id: true } })) continue;
    await prisma.dailyBudget.create({ data: { userId, dayOfWeek, amount: dailyBudget } });
    created.dailyBudget++;
  }
  for (const source of sources) {
    if (await prisma.bankBalance.findFirst({ where: { userId, source }, select: { id: true } })) continue;
    await prisma.bankBalance.create({ data: { userId, source, balance: 0 } });
    created.bankBalance++;
  }
  return created;
}

module.exports = { provisionUser };
