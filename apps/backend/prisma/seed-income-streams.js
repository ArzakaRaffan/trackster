/**
 * Script sekali-jalan E03-S1: seed 5 IncomeStream Arzaka. Idempotent (skip kalau nama sudah ada).
 * Plain JS (bukan ts-node) karena prod exclude devDependencies — lihat docs/context/Gotchas.md.
 * Jalan: node prisma/seed-income-streams.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const streams = [
  {
    name: 'Les Privat',
    kind: 'SESSION',
    cadence: 'WEEKLY',
    source: 'BCA',
    sessionRate: 300_000, // 150rb/jam x 2 jam
    sessionExtra: 50_000, // transport per sesi offline
    maxUnits: 2, // maks 2 sesi/minggu
    typicalUnits: 2,
    matchKeywords: ['KENYU'],
  },
  {
    name: 'Gaji Magang',
    kind: 'DEDUCTION',
    cadence: 'WEEKLY',
    source: 'BCA',
    amount: 250_000,
    deductionPerUnit: 50_000, // dipotong per hari absen
    maxUnits: 5, // hari kerja/minggu
    typicalUnits: 0,
  },
  {
    name: 'Uang Mingguan Keluarga',
    kind: 'FIXED',
    cadence: 'WEEKLY',
    source: 'BCA',
    amount: 400_000,
  },
  {
    name: 'Ruangguru',
    kind: 'VARIABLE',
    cadence: 'MONTHLY',
    source: 'BCA',
    payDayOfMonth: 25,
    amount: 150_000, // estimasi awal, disesuaikan dari histori setelah ada data
  },
  {
    name: 'Project / Lainnya',
    kind: 'IRREGULAR',
    cadence: 'NONE',
    source: 'BCA',
  },
];

async function main() {
  for (const stream of streams) {
    const existing = await prisma.incomeStream.findFirst({ where: { name: stream.name } });
    if (existing) {
      console.log(`skip (sudah ada): ${stream.name}`);
      continue;
    }
    const created = await prisma.incomeStream.create({ data: stream });
    console.log(`dibuat: ${created.name} (id=${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
