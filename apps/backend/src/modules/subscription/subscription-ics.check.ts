/**
 * subscription-ics.check.ts — feed .ics langganan + tanda tangan URL.
 * Jalankan: npx ts-node --transpile-only src/modules/subscription/subscription-ics.check.ts
 */
import * as assert from 'assert';
import { BillingCycle } from '@prisma/client';
import { buildSubscriptionsIcs, calendarFile, parseCalendarFile, verifyCalendarSig } from './subscription-ics';

process.env.JWT_SECRET = 'check-secret';

// Tanda tangan: cocok hanya untuk user + tokenVersion yang sama.
const f = calendarFile(42, 3);
const p = parseCalendarFile(f)!;
assert.strictEqual(p.userId, 42);
assert.ok(verifyCalendarSig(42, 3, p.sig));
assert.ok(!verifyCalendarSig(42, 4, p.sig), 'tokenVersion naik → tautan lama mati');
assert.ok(!verifyCalendarSig(43, 3, p.sig), 'tanda tangan tidak bisa dipakai user lain');
assert.ok(!verifyCalendarSig(42, 3, p.sig.slice(0, 31)), 'panjang beda ditolak tanpa throw');
assert.strictEqual(parseCalendarFile('42-abc.ics'), null);
assert.strictEqual(parseCalendarFile('../42-' + 'a'.repeat(32) + '.ics'), null);
assert.strictEqual(parseCalendarFile(`42-${'a'.repeat(32)}.ics.exe`), null);

const now = new Date('2026-10-16T01:00:00Z');
const ics = buildSubscriptionsIcs(
  [
    { id: 1, name: 'Netflix, Premium; 4K', amount: '186000', cycle: BillingCycle.MONTHLY, nextDueDate: new Date('2026-10-20T00:00:00Z'), reminderDaysBefore: 3, notes: 'kartu\nJago', updatedAt: now },
    { id: 2, name: 'Domain', amount: 150000, cycle: BillingCycle.YEARLY, nextDueDate: new Date('2027-03-01T00:00:00Z'), reminderDaysBefore: 0, notes: null, updatedAt: now },
    { id: 3, name: 'Kos', amount: 1500000, cycle: BillingCycle.MONTHLY, nextDueDate: new Date('2026-10-31T00:00:00Z'), reminderDaysBefore: 1, notes: null, updatedAt: now },
    { id: 4, name: 'Langganan dengan nama yang sangat panjang sekali sampai lewat tujuh puluh lima oktet ya', amount: 1, cycle: BillingCycle.MONTHLY, nextDueDate: new Date('2026-11-02T00:00:00Z'), reminderDaysBefore: 0, notes: null, updatedAt: now },
  ],
  now,
);
const lines = ics.split('\r\n');
assert.strictEqual(lines[0], 'BEGIN:VCALENDAR');
assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
assert.strictEqual(lines.filter((l) => l === 'BEGIN:VEVENT').length, 4);
assert.ok(lines.includes('SUMMARY:Netflix\\, Premium\\; 4K — Rp186.000'), 'koma/titik koma di-escape');
assert.ok(lines.includes('DESCRIPTION:Langganan bulanan · dari Trackster\\nkartu\\nJago'));
assert.ok(lines.includes('DTSTART;VALUE=DATE:20261020') && lines.includes('DTEND;VALUE=DATE:20261021'));
assert.ok(lines.includes('RRULE:FREQ=YEARLY'));
assert.ok(lines.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=-1'), 'tgl 31 → hari terakhir bulan');
assert.strictEqual(lines.filter((l) => l === 'BEGIN:VALARM').length, 2, 'alarm hanya jika reminderDaysBefore > 0');
assert.ok(lines.includes('TRIGGER:-P3D'));
assert.ok(lines.includes('DTSTAMP:20261016T010000Z'));
for (const l of lines) assert.ok(Buffer.byteLength(l) <= 75, `baris terlalu panjang: ${l}`);
assert.ok(lines.some((l) => l.startsWith(' ')), 'baris panjang dilipat');
// Unfold → teks utuh lagi.
assert.ok(ics.replace(/\r\n /g, '').includes('sampai lewat tujuh puluh lima oktet ya — Rp1'));

console.log('subscription-ics.check: OK');
