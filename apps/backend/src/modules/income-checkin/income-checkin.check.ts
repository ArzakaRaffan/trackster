/**
 * income-checkin.check.ts — self-check formula check-in (E03-S3) + message builder Telegram.
 * Jalankan dengan: npx ts-node src/modules/income-checkin/income-checkin.check.ts
 */
import * as assert from 'assert';
import { calcCheckinAmount, CheckinDraft } from './income-checkin.service';
import { buildCheckinMessage, parseCheckinCallback } from './income-checkin-message';

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

console.log('\n── calcCheckinAmount ──');

check('FIXED selalu pakai amount stream, abaikan entry', () => {
  const r = calcCheckinAmount({ kind: 'FIXED', amount: 400_000, sessionRate: null, sessionExtra: null, deductionPerUnit: null }, {});
  assert.deepStrictEqual(r, { amount: 400_000, units: null, extraUnits: null });
});

check('SESSION: 2 sesi, 1 offline = 2x300rb + 1x50rb = 650rb (Les Privat Arzaka)', () => {
  const r = calcCheckinAmount(
    { kind: 'SESSION', amount: null, sessionRate: 300_000, sessionExtra: 50_000, deductionPerUnit: null },
    { units: 2, extraUnits: 1 },
  );
  assert.deepStrictEqual(r, { amount: 650_000, units: 2, extraUnits: 1 });
});

check('SESSION: extraUnits tidak boleh lebih dari units (clamp)', () => {
  const r = calcCheckinAmount(
    { kind: 'SESSION', amount: null, sessionRate: 300_000, sessionExtra: 50_000, deductionPerUnit: null },
    { units: 1, extraUnits: 3 },
  );
  assert.strictEqual(r.extraUnits, 1);
  assert.strictEqual(r.amount, 350_000);
});

check('DEDUCTION: 0 absen = maks 250rb (Gaji Magang Arzaka)', () => {
  const r = calcCheckinAmount({ kind: 'DEDUCTION', amount: 250_000, sessionRate: null, sessionExtra: null, deductionPerUnit: 50_000 }, { units: 0 });
  assert.deepStrictEqual(r, { amount: 250_000, units: 0, extraUnits: null });
});

check('DEDUCTION: 3 hari absen = 250rb - 3x50rb = 100rb', () => {
  const r = calcCheckinAmount({ kind: 'DEDUCTION', amount: 250_000, sessionRate: null, sessionExtra: null, deductionPerUnit: 50_000 }, { units: 3 });
  assert.strictEqual(r.amount, 100_000);
});

check('DEDUCTION: absen lebih dari maks hari kerja tidak jadi negatif (clamp 0)', () => {
  const r = calcCheckinAmount({ kind: 'DEDUCTION', amount: 250_000, sessionRate: null, sessionExtra: null, deductionPerUnit: 50_000 }, { units: 10 });
  assert.strictEqual(r.amount, 0);
});

check('VARIABLE: pakai nominal langsung dari entry', () => {
  const r = calcCheckinAmount({ kind: 'VARIABLE', amount: 150_000, sessionRate: null, sessionExtra: null, deductionPerUnit: null }, { amount: 180_000 });
  assert.deepStrictEqual(r, { amount: 180_000, units: null, extraUnits: null });
});

check('IRREGULAR: pakai nominal langsung, default 0 kalau tidak diisi', () => {
  const r = calcCheckinAmount({ kind: 'IRREGULAR', amount: null, sessionRate: null, sessionExtra: null, deductionPerUnit: null }, {});
  assert.strictEqual(r.amount, 0);
});

console.log('\n── buildCheckinMessage / parseCheckinCallback ──');

const baseDraft: CheckinDraft = {
  weekStart: '2026-09-21',
  weekEndLabel: '2026-09-27',
  totalExpected: 1_350_000,
  totalRecorded: 400_000,
  streams: [
    {
      id: 1,
      name: 'Uang Mingguan Keluarga',
      kind: 'FIXED',
      source: 'BCA',
      sessionRate: null,
      sessionExtra: null,
      maxUnits: null,
      deductionPerUnit: null,
      amount: 400_000,
      typicalUnits: null,
      scheduled: true,
      alreadyFilled: true,
      recordedAmount: 400_000,
      expected: 400_000,
      max: 400_000,
    },
    {
      id: 2,
      name: 'Gaji Magang',
      kind: 'DEDUCTION',
      source: 'BCA',
      sessionRate: null,
      sessionExtra: null,
      maxUnits: 5,
      deductionPerUnit: 50_000,
      amount: 250_000,
      typicalUnits: 0,
      scheduled: true,
      alreadyFilled: false,
      recordedAmount: 0,
      expected: 250_000,
      max: 250_000,
    },
    {
      id: 3,
      name: 'Les Privat',
      kind: 'SESSION',
      source: 'BCA',
      sessionRate: 300_000,
      sessionExtra: 50_000,
      maxUnits: 2,
      deductionPerUnit: null,
      amount: null,
      typicalUnits: 2,
      scheduled: true,
      alreadyFilled: false,
      recordedAmount: 0,
      expected: 700_000,
      max: 700_000,
    },
    {
      id: 4,
      name: 'Project/Lainnya',
      kind: 'IRREGULAR',
      source: 'BCA',
      sessionRate: null,
      sessionExtra: null,
      maxUnits: null,
      deductionPerUnit: null,
      amount: null,
      typicalUnits: null,
      scheduled: true,
      alreadyFilled: false,
      recordedAmount: 0,
      expected: 0,
      max: 0,
    },
  ],
};

check('FIXED yang sudah filled tampil sebagai checkmark, bukan tombol', () => {
  const { text } = buildCheckinMessage('prompt', baseDraft, 'https://track.trackster.my.id/app/income/checkin?week=2026-09-21');
  assert.ok(text.includes('✓ Uang Mingguan Keluarga'));
});

check('DEDUCTION yang belum filled dapat 1 baris tombol [0][1][2][3+]', () => {
  const { keyboard } = buildCheckinMessage('prompt', baseDraft, 'https://x/checkin');
  const row = keyboard.find((r) => r.some((b) => b.callback_data?.includes(':d0')));
  assert.ok(row);
  assert.strictEqual(row!.length, 4);
  assert.strictEqual(row![3].text, '3+');
  assert.strictEqual(row![3].callback_data, 'ci:2:2026-09-21:d3');
});

check('SESSION tidak dapat tombol khusus (diarahkan ke link web)', () => {
  const { text, keyboard } = buildCheckinMessage('prompt', baseDraft, 'https://x/checkin');
  assert.ok(text.includes('Les Privat: isi di web'));
  assert.ok(!keyboard.some((r) => r.some((b) => b.callback_data?.startsWith('ci:3:'))));
});

check('IRREGULAR tidak muncul di pesan Telegram sama sekali', () => {
  const { text } = buildCheckinMessage('prompt', baseDraft, 'https://x/checkin');
  assert.ok(!text.includes('Project/Lainnya'));
});

check('Tombol "Isi di web" selalu ada di baris terakhir, pakai url bukan callback_data', () => {
  const { keyboard } = buildCheckinMessage('prompt', baseDraft, 'https://track.trackster.my.id/app/income/checkin?week=2026-09-21');
  const last = keyboard[keyboard.length - 1];
  assert.strictEqual(last[0].url, 'https://track.trackster.my.id/app/income/checkin?week=2026-09-21');
  assert.strictEqual(last[0].callback_data, undefined);
});

check('parseCheckinCallback bongkar callback_data dengan benar', () => {
  const parsed = parseCheckinCallback('ci:2:2026-09-21:d3');
  assert.deepStrictEqual(parsed, { streamId: 2, weekStart: '2026-09-21', answer: 'd3' });
});

check('parseCheckinCallback return null untuk format tidak dikenal', () => {
  assert.strictEqual(parseCheckinCallback('bukan-callback-checkin'), null);
});

console.log(`\n${passed} lulus, ${failed} gagal.\n`);
if (failed > 0) process.exit(1);
