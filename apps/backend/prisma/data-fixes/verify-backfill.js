// Verifikasi backfill multi-user: per tabel tenant cetak total, userId NULL, per-user. Exit 1 bila ada NULL.
// Read-only. Plain JS (bukan ts-node — lihat gotcha di CLAUDE.md).
//   dev:  node prisma/data-fixes/verify-backfill.js
//   prod: docker compose -f docker-compose.prod.yml exec backend node prisma/data-fixes/verify-backfill.js
const { PrismaClient } = require('@prisma/client');

// Tabel yang punya kolom userId langsung. Anak lewat induk (GoalContribution, ChatMessage) dicek terpisah di bawah.
const TABLES = [
  'Transaction', 'Reimbursement', 'DailyBudget', 'BudgetSetting', 'EmailSyncLog', 'EmailParseLog', 'TelegramConfig',
  'GmailToken', 'AlertLog', 'Income', 'IncomeStream', 'BankBalance', 'BalanceAdjustment', 'MerchantAlias',
  'CategoryIcon', 'HealthScoreLog', 'BudgetAdvice', 'AiInsightCard', 'PeriodReport', 'Goal', 'Subscription',
  'ChatThread', 'AiMemory',
];

(async () => {
  const prisma = new PrismaClient();
  let bad = 0;
  try {
    const users = await prisma.$queryRawUnsafe('SELECT id, username, role FROM "User" ORDER BY id');
    console.log('User:', users.map((u) => `${u.id}:${u.username}(${u.role})`).join(', ') || '(kosong)');
    console.log('\ntabel'.padEnd(22), 'total'.padStart(7), 'NULL'.padStart(7), '  per-user');
    for (const t of TABLES) {
      const [row] = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE "userId" IS NULL)::int AS nulls FROM "${t}"`,
      );
      const per = await prisma.$queryRawUnsafe(`SELECT "userId", count(*)::int AS n FROM "${t}" WHERE "userId" IS NOT NULL GROUP BY 1 ORDER BY 1`);
      const flag = row.nulls > 0 ? '  <-- MASIH ADA NULL' : '';
      if (row.nulls > 0) bad++;
      console.log(t.padEnd(21), String(row.total).padStart(7), String(row.nulls).padStart(7), ' ', per.map((p) => `u${p.userId}=${p.n}`).join(' '), flag);
    }
    // Anak lewat induk: tidak boleh yatim / induk tanpa userId.
    const orphans = await prisma.$queryRawUnsafe(`
      SELECT 'GoalContribution' AS t, count(*)::int AS n FROM "GoalContribution" c JOIN "Goal" g ON g.id = c."goalId" WHERE g."userId" IS NULL
      UNION ALL
      SELECT 'ChatMessage', count(*)::int FROM "ChatMessage" m JOIN "ChatThread" t ON t.id = m."threadId" WHERE t."userId" IS NULL`);
    for (const o of orphans) {
      console.log(`${o.t} dengan induk userId NULL: ${o.n}`);
      if (o.n > 0) bad++;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(bad ? `\nGAGAL: ${bad} masalah` : '\nOK: tidak ada userId NULL');
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
