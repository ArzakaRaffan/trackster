// Backfill multi-user, bagian data pribadi + sisa baris NULL. Plain JS (bukan ts-node).
// Migrasi SQL `multiuser_backfill` sudah mengisi userId; skrip ini (a) mengisi profil pemilik dari ENV (repo publik -> tak ada
// nilai pribadi di SQL), (b) menyalin TelegramConfig -> TelegramLink (token bot TIDAK disalin), (c) mengisi ulang baris userId NULL
// yang dibuat kode lama setelah migrasi. IDEMPOTEN. Default = DRY-RUN; tulis hanya dengan --apply. WAJIB backup dulu (06-Runbooks §1).
//
//   OWNER_FULL_NAME="..." OWNER_ACCOUNT_NUMBERS="123,456" node prisma/data-fixes/2026-10-multiuser-backfill-owner.js [--apply] [--user-id N] [--display-name Nama]
//   prod: docker compose -f docker-compose.prod.yml exec backend node prisma/data-fixes/2026-10-multiuser-backfill-owner.js --apply
const { PrismaClient } = require('@prisma/client');

const TABLES = [
  'Transaction', 'Reimbursement', 'DailyBudget', 'BudgetSetting', 'EmailSyncLog', 'EmailParseLog', 'TelegramConfig',
  'GmailToken', 'AlertLog', 'Income', 'IncomeStream', 'BankBalance', 'BalanceAdjustment', 'MerchantAlias',
  'CategoryIcon', 'HealthScoreLog', 'BudgetAdvice', 'AiInsightCard', 'PeriodReport', 'Goal', 'Subscription',
  'ChatThread', 'AiMemory',
];

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };

(async () => {
  const prisma = new PrismaClient();
  try {
    const owner = opt('user-id')
      ? await prisma.user.findUnique({ where: { id: Number(opt('user-id')) } })
      : await prisma.user.findFirst({ orderBy: { id: 'asc' } });
    if (!owner) throw new Error('User pemilik tidak ditemukan');
    console.log(`${apply ? 'APPLY' : 'DRY-RUN'} — pemilik: id=${owner.id} username=${owner.username} role=${owner.role}`);

    const fullName = (process.env.OWNER_FULL_NAME || '').trim();
    const displayName = opt('display-name') || process.env.OWNER_DISPLAY_NAME || owner.displayName || owner.username;
    const numbers = [...new Set((process.env.OWNER_ACCOUNT_NUMBERS || '').split(',').map((s) => s.replace(/\D/g, '')).filter((s) => s.length >= 6))];
    const tg = await prisma.telegramConfig.findFirst({ orderBy: { id: 'asc' } });
    const tgExists = await prisma.telegramLink.findUnique({ where: { userId: owner.id } });

    const nulls = {};
    for (const t of TABLES) {
      const [r] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}" WHERE "userId" IS NULL`);
      if (r.n) nulls[t] = r.n;
    }
    console.log('rencana:');
    console.log(`  user: role=ADMIN, displayName="${displayName}", fullName=${fullName ? '(dari OWNER_FULL_NAME, panjang ' + fullName.length + ')' : '(env kosong -> tidak diubah)'}`);
    console.log(`  OwnAccount: ${numbers.length} nomor dari OWNER_ACCOUNT_NUMBERS (yang sudah ada dilewati)`);
    console.log(`  TelegramLink: ${tg ? (tgExists ? 'sudah ada -> lewati' : 'salin dari TelegramConfig (chatId saja)') : 'tidak ada TelegramConfig'}`);
    console.log(`  userId NULL yang diisi ulang: ${Object.keys(nulls).length ? JSON.stringify(nulls) : 'tidak ada'}`);
    if (!apply) return console.log('\nDry-run selesai, tidak ada yang ditulis. Tambahkan --apply untuk menjalankan.');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: owner.id },
        data: { role: 'ADMIN', displayName, ...(fullName ? { fullName } : {}) },
      });
      for (const accountNumber of numbers) {
        await tx.ownAccount.upsert({
          where: { userId_accountNumber: { userId: owner.id, accountNumber } },
          update: {},
          create: { userId: owner.id, accountNumber },
        });
      }
      if (tg && !tgExists) {
        await tx.telegramLink.create({
          data: { userId: owner.id, chatId: tg.chatId, isActive: tg.isActive, notifyEveryTransaction: tg.notifyEveryTransaction },
        });
      }
      for (const t of Object.keys(nulls)) {
        await tx.$executeRawUnsafe(`UPDATE "${t}" SET "userId" = $1 WHERE "userId" IS NULL`, owner.id);
      }
    });
    console.log('\nSelesai. Jalankan: node prisma/data-fixes/verify-backfill.js');
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
