const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { provisionUser } = require('./provision-user');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'change-me-please';

  let admin = await prisma.user.findUnique({ where: { username } });
  if (!admin) {
    const hashed = await bcrypt.hash(password, 10);
    admin = await prisma.user.create({ data: { username, password: hashed, role: 'ADMIN' } });
    console.log(`Seeded admin user: ${username}`);
  } else {
    console.log('Admin user already exists, skipping.');
  }

  // Data awal tenant (budget harian default Rp50.000 + saldo BCA/JAGO @0) — lihat provision-user.js.
  const created = await provisionUser(prisma, admin.id);
  console.log(`Provisioned admin: +${created.dailyBudget} daily budget, +${created.bankBalance} bank balance rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
