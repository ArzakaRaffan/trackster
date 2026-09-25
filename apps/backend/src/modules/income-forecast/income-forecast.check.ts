/**
 * income-forecast.check.ts — self-check formula forecast (E03-S2), pakai fixture 5 stream Arzaka
 * (lihat prisma/seed-income-streams.js). Jalankan dengan:
 *   npx ts-node src/modules/income-forecast/income-forecast.check.ts
 */
import * as assert from 'assert';
import { calcStreamForecast, deriveStreamStatus, isScheduledInWeek, StreamForecastConfig } from './income-forecast.service';
import { startOfWibWeek } from '../../common/wib';

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ ${label}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

const lesPrivat: StreamForecastConfig = {
  kind: 'SESSION',
  cadence: 'WEEKLY',
  amount: null,
  sessionRate: 300_000,
  sessionExtra: 50_000,
  maxUnits: 2,
  deductionPerUnit: null,
  typicalUnits: 2,
};

const gajiMagang: StreamForecastConfig = {
  kind: 'DEDUCTION',
  cadence: 'WEEKLY',
  amount: 250_000,
  sessionRate: null,
  sessionExtra: null,
  maxUnits: 5,
  deductionPerUnit: 50_000,
  typicalUnits: 0,
};

const uangMingguan: StreamForecastConfig = {
  kind: 'FIXED',
  cadence: 'WEEKLY',
  amount: 400_000,
  sessionRate: null,
  sessionExtra: null,
  maxUnits: null,
  deductionPerUnit: null,
  typicalUnits: null,
};

const ruangguru: StreamForecastConfig = {
  kind: 'VARIABLE',
  cadence: 'MONTHLY',
  amount: 150_000,
  sessionRate: null,
  sessionExtra: null,
  maxUnits: null,
  deductionPerUnit: null,
  typicalUnits: null,
};

console.log('\n── calcStreamForecast: maks minggu biasa (tanpa Ruangguru) ──');

const scheduled = { historicalAmounts: [] as number[], historicalAbsences: [] as number[], isScheduledThisWeek: true };
const notScheduled = { historicalAmounts: [] as number[], historicalAbsences: [] as number[], isScheduledThisWeek: false };

check('Les Privat max = 700.000 (2 sesi x (300rb+50rb))', () => {
  assert.strictEqual(calcStreamForecast(lesPrivat, scheduled).max, 700_000);
});

check('Les Privat expected tanpa histori = typicalUnits x (rate+extra) = 700.000', () => {
  assert.strictEqual(calcStreamForecast(lesPrivat, scheduled).expected, 700_000);
});

check('Les Privat expected dengan >=3 minggu histori = rata-rata aktual', () => {
  const result = calcStreamForecast(lesPrivat, { ...scheduled, historicalAmounts: [300_000, 350_000, 400_000] });
  assert.strictEqual(result.expected, 350_000);
});

check('Les Privat conservative tanpa histori = 50% maks = 350.000', () => {
  assert.strictEqual(calcStreamForecast(lesPrivat, scheduled).conservative, 350_000);
});

check('Les Privat conservative dengan histori = minimum aktual', () => {
  const result = calcStreamForecast(lesPrivat, { ...scheduled, historicalAmounts: [300_000, 350_000, 400_000] });
  assert.strictEqual(result.conservative, 300_000);
});

check('Gaji Magang max = expected = 250.000 tanpa absen (typicalUnits=0)', () => {
  const r = calcStreamForecast(gajiMagang, scheduled);
  assert.strictEqual(r.max, 250_000);
  assert.strictEqual(r.expected, 250_000);
  assert.strictEqual(r.conservative, 250_000);
});

check('Gaji Magang expected berkurang sesuai rata-rata absen', () => {
  const r = calcStreamForecast(gajiMagang, { ...scheduled, historicalAbsences: [0, 1, 2] });
  assert.strictEqual(r.expected, 250_000 - 1 * 50_000); // rata-rata absen 1 hari
  assert.strictEqual(r.conservative, 250_000 - 2 * 50_000); // absen terbanyak 2 hari
});

check('Uang Mingguan Keluarga selalu 400.000 (FIXED)', () => {
  const r = calcStreamForecast(uangMingguan, scheduled);
  assert.strictEqual(r.max, 400_000);
  assert.strictEqual(r.expected, 400_000);
  assert.strictEqual(r.conservative, 400_000);
});

check('Total maks minggu biasa (Les+Magang+Mingguan) = 1.350.000', () => {
  const total =
    calcStreamForecast(lesPrivat, scheduled).max +
    calcStreamForecast(gajiMagang, scheduled).max +
    calcStreamForecast(uangMingguan, scheduled).max;
  assert.strictEqual(total, 1_350_000);
});

console.log('\n── calcStreamForecast: Ruangguru (VARIABLE, bulanan) ──');

check('Ruangguru di minggu tanggal 25 (scheduled) = 150.000 (estimasi awal)', () => {
  const r = calcStreamForecast(ruangguru, scheduled);
  assert.strictEqual(r.max, 150_000);
  assert.strictEqual(r.expected, 150_000);
  assert.strictEqual(r.conservative, 150_000);
});

check('Ruangguru di minggu lain (not scheduled) = 0', () => {
  const r = calcStreamForecast(ruangguru, notScheduled);
  assert.strictEqual(r.max, 0);
  assert.strictEqual(r.expected, 0);
  assert.strictEqual(r.conservative, 0);
});

check('Ruangguru dengan histori 3 bulan pakai min/rata-rata/maks aktual', () => {
  const r = calcStreamForecast(ruangguru, { ...scheduled, historicalAmounts: [100_000, 150_000, 200_000] });
  assert.strictEqual(r.conservative, 100_000);
  assert.strictEqual(r.expected, 150_000);
  assert.strictEqual(r.max, 200_000);
});

console.log('\n── isScheduledInWeek ──');

check('MONTHLY payDayOfMonth=25: minggu yang memuat tanggal 25 → true', () => {
  const weekStart = new Date('2026-09-21T00:00:00+07:00'); // Senin 21 Sep
  const weekEnd = new Date('2026-09-28T00:00:00+07:00'); // Senin 28 Sep (eksklusif)
  assert.strictEqual(isScheduledInWeek({ cadence: 'MONTHLY', payDayOfMonth: 25 }, weekStart, weekEnd), true);
});

check('MONTHLY payDayOfMonth=25: minggu lain → false', () => {
  const weekStart = new Date('2026-09-28T00:00:00+07:00');
  const weekEnd = new Date('2026-10-05T00:00:00+07:00');
  assert.strictEqual(isScheduledInWeek({ cadence: 'MONTHLY', payDayOfMonth: 25 }, weekStart, weekEnd), false);
});

check('MONTHLY payDayOfMonth=31 di bulan 30 hari → clamp ke hari terakhir bulan', () => {
  // April 2026: 30 hari. Minggu yang memuat 30 April.
  const weekStart = new Date('2026-04-27T00:00:00+07:00');
  const weekEnd = new Date('2026-05-04T00:00:00+07:00');
  assert.strictEqual(isScheduledInWeek({ cadence: 'MONTHLY', payDayOfMonth: 31 }, weekStart, weekEnd), true);
});

check('WEEKLY selalu true, NONE selalu false', () => {
  const weekStart = startOfWibWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  assert.strictEqual(isScheduledInWeek({ cadence: 'WEEKLY', payDayOfMonth: null }, weekStart, weekEnd), true);
  assert.strictEqual(isScheduledInWeek({ cadence: 'NONE', payDayOfMonth: null }, weekStart, weekEnd), false);
});

console.log('\n── deriveStreamStatus ──');

check('received >= expected → RECEIVED', () => {
  assert.strictEqual(deriveStreamStatus(400_000, 400_000, false), 'RECEIVED');
});

check('0 < received < expected → PARTIAL', () => {
  assert.strictEqual(deriveStreamStatus(150_000, 400_000, false), 'PARTIAL');
});

check('received = 0, expected = 0 (tidak dijadwalkan) → PENDING, bukan MISSED', () => {
  assert.strictEqual(deriveStreamStatus(0, 0, true), 'PENDING');
});

check('received = 0, expected > 0, minggu belum berakhir → PENDING', () => {
  assert.strictEqual(deriveStreamStatus(0, 400_000, false), 'PENDING');
});

check('received = 0, expected > 0, minggu sudah berakhir → MISSED', () => {
  assert.strictEqual(deriveStreamStatus(0, 400_000, true), 'MISSED');
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
