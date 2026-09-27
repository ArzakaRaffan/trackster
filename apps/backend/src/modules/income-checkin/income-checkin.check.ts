/** Self-check `computeEntryAmount` — jalan dengan `npx ts-node src/modules/income-checkin/income-checkin.check.ts`.
 *  Fixture sesuai contoh Arzaka di docs/revamp/epics/E03-income-model.md (Les Kenyu, Gaji magang). */
import * as assert from 'assert';
import { computeEntryAmount } from './income-checkin.service';
import { decodeCallback, encodeCallback } from './income-checkin-cron.service';

console.log('── computeEntryAmount: FIXED ──');
{
  const stream = { kind: 'FIXED' as const, amount: 400_000, sessionRate: null, sessionExtra: null, deductionPerUnit: null };
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1 }), 400_000);
  console.log('  OK: FIXED selalu nominal stream, terlepas dari entry');
}

console.log('── computeEntryAmount: SESSION (Les Kenyu 150rb/jam x 2 jam, transport 50rb) ──');
{
  const stream = { kind: 'SESSION' as const, amount: null, sessionRate: 300_000, sessionExtra: 50_000, deductionPerUnit: null };
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1, units: 2, extraUnits: 0 }), 600_000, '2 sesi online = 2x300rb');
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1, units: 2, extraUnits: 1 }), 650_000, '2 sesi, 1 offline = 600rb + 50rb transport');
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1, units: 0 }), 0, '0 sesi (batal semua) = 0');
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1 }), 0, 'units tidak diisi = default 0');
  console.log('  OK');
}

console.log('── computeEntryAmount: DEDUCTION (Gaji magang 250rb, potongan 50rb/hari absen) ──');
{
  const stream = { kind: 'DEDUCTION' as const, amount: 250_000, sessionRate: null, sessionExtra: null, deductionPerUnit: 50_000 };
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1, units: 0 }), 250_000, '0 absen = full');
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1, units: 2 }), 150_000, '2 hari absen = 250rb - 100rb');
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1, units: 10 }), 0, 'absen lebih dari maks tidak boleh negatif');
  console.log('  OK');
}

console.log('── computeEntryAmount: VARIABLE (Ruangguru, nominal ditulis manual) ──');
{
  const stream = { kind: 'VARIABLE' as const, amount: 150_000, sessionRate: null, sessionExtra: null, deductionPerUnit: null };
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1, amount: 180_000 }), 180_000, 'nominal aktual dari input user');
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1 }), 150_000, 'tidak diisi = fallback estimasi stream');
  console.log('  OK');
}

console.log('── computeEntryAmount: IRREGULAR (tidak masuk check-in) ──');
{
  const stream = { kind: 'IRREGULAR' as const, amount: null, sessionRate: null, sessionExtra: null, deductionPerUnit: null };
  assert.strictEqual(computeEntryAmount(stream, { streamId: 1 }), null);
  console.log('  OK');
}

console.log('── encodeCallback/decodeCallback: roundtrip callback_data Telegram ──');
{
  const confirmData = encodeCallback('confirm', 3, '2026-09-21');
  assert.ok(Buffer.byteLength(confirmData, 'utf8') <= 64, 'callback_data harus muat di batas 64 byte Telegram');
  assert.deepStrictEqual(decodeCallback(confirmData), { action: 'confirm', streamId: 3, weekStart: '2026-09-21', value: undefined });

  const absentData = encodeCallback('absent', 2, '2026-09-21', 3);
  assert.deepStrictEqual(decodeCallback(absentData), { action: 'absent', streamId: 2, weekStart: '2026-09-21', value: 3 });

  assert.strictEqual(decodeCallback('bukan-callback-kita'), null, 'prefix asing harus diabaikan (bukan error)');
  assert.strictEqual(decodeCallback('ci:hapus:1:2026-09-21'), null, 'action tak dikenal harus ditolak');
  console.log('  OK');
}

console.log('\nSemua assertion income-checkin lulus ✅');
