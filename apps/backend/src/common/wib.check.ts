/** Self-check manual: `npx ts-node apps/backend/src/common/wib.check.ts` */
import * as assert from 'assert';
import {
  wibDateKey,
  startOfWibDay,
  addWibDays,
  wibDayOfWeek,
  startOfWibWeek,
  startOfWibMonth,
  wibRange,
  isLastWibDayOfMonth,
} from './wib';

// 2026-09-23T17:30:00Z = 2026-09-24T00:30 WIB -> sudah hari berikutnya
assert.strictEqual(wibDateKey(new Date('2026-09-23T17:30:00Z')), '2026-09-24');
// 2026-09-23T16:59:59Z = 2026-09-23T23:59:59 WIB -> masih hari yang sama
assert.strictEqual(wibDateKey(new Date('2026-09-23T16:59:59Z')), '2026-09-23');

// startOfWibDay('2026-09-24') = instant UTC untuk 2026-09-23T17:00:00Z
assert.strictEqual(startOfWibDay('2026-09-24').toISOString(), '2026-09-23T17:00:00.000Z');

// addWibDays tidak kena drift DST (WIB tidak punya DST)
assert.strictEqual(wibDateKey(addWibDays(startOfWibDay('2026-09-24'), 1)), '2026-09-25');

// wibDayOfWeek: 2026-09-24 adalah hari Kamis (4)
assert.strictEqual(wibDayOfWeek(new Date('2026-09-24T10:00:00Z')), 4);

// Senin minggu dari Minggu malam (WIB) -> Senin sebelumnya, bukan Senin depan
// 2026-09-20 = Minggu. 2026-09-20T20:00 WIB = 2026-09-20T13:00Z
const sundayNightWib = new Date('2026-09-20T13:00:00Z');
assert.strictEqual(wibDateKey(startOfWibWeek(sundayNightWib)), '2026-09-14'); // Senin sebelumnya

// Batas bulan akhir Februari (tahun kabisat 2028)
const febRange = wibRange('month', new Date('2028-02-15T00:00:00Z'));
assert.strictEqual(wibDateKey(febRange.start), '2028-02-01');
assert.strictEqual(wibDateKey(addWibDays(febRange.end, -1)), '2028-02-29');
assert.strictEqual(isLastWibDayOfMonth(new Date('2028-02-29T10:00:00Z')), true);
assert.strictEqual(isLastWibDayOfMonth(new Date('2028-02-28T10:00:00Z')), false);

// startOfWibMonth konsisten dengan wibRange
assert.strictEqual(startOfWibMonth(2026, 9).toISOString(), wibRange('month', new Date('2026-09-24')).start.toISOString());

// wibRange('day', ...) end eksklusif tepat 24 jam setelah start
const dayRange = wibRange('day', new Date('2026-09-24T10:00:00Z'));
assert.strictEqual(dayRange.end.getTime() - dayRange.start.getTime(), 86_400_000);

console.log('wib.check.ts OK');
