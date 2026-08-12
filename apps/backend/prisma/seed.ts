import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'change-me-please';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (!existing) {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { username, password: hashed } });
    console.log(`Seeded admin user: ${username}`);
  } else {
    console.log('Admin user already exists, skipping.');
  }

  // Default daily budget: Rp50.000 setiap hari, 0=Minggu ... 6=Sabtu
  for (let day = 0; day <= 6; day++) {
    await prisma.dailyBudget.upsert({
      where: { dayOfWeek: day },
      update: {},
      create: { dayOfWeek: day, amount: 50000 },
    });
  }
  console.log('Seeded 7 daily budget rows (default Rp50.000).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
