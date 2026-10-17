import { createHmac, timingSafeEqual } from 'crypto';
import { BillingCycle } from '@prisma/client';

// Feed kalender .ics langganan (Google/Apple Calendar "langganan dari URL"). Tanpa OAuth: URL berisi tanda tangan
// HMAC(userId, tokenVersion) — ganti password / keluar dari semua perangkat (tokenVersion naik) = tautan lama mati.

const secretKey = () => createHmac('sha256', process.env.JWT_SECRET || 'dev').update('ics-feed').digest();
const sign = (userId: number, tokenVersion: number) =>
  createHmac('sha256', secretKey()).update(`${userId}:${tokenVersion}`).digest('base64url').slice(0, 32);

/** Nama berkas di URL: `<userId>-<tanda tangan>.ics`. */
export const calendarFile = (userId: number, tokenVersion: number) => `${userId}-${sign(userId, tokenVersion)}.ics`;

/** `<userId>-<sig>.ics` → userId, tanpa memeriksa tanda tangan (butuh tokenVersion dari DB, lihat verifyCalendarSig). */
export function parseCalendarFile(file: string): { userId: number; sig: string } | null {
  const m = /^(\d{1,9})-([A-Za-z0-9_-]{32})\.ics$/.exec(file);
  return m ? { userId: Number(m[1]), sig: m[2] } : null;
}

export function verifyCalendarSig(userId: number, tokenVersion: number, sig: string): boolean {
  const a = Buffer.from(sign(userId, tokenVersion));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** RFC 5545 §3.1: baris > 75 oktet dilipat (CRLF + spasi). Dipotong per karakter supaya UTF-8 tidak terbelah. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export type IcsSub = {
  id: number;
  name: string;
  amount: unknown;
  cycle: BillingCycle;
  nextDueDate: Date;
  reminderDaysBefore: number;
  notes: string | null;
  updatedAt: Date;
};

export function buildSubscriptionsIcs(subs: IcsSub[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trackster//Langganan//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Langganan Trackster',
    'X-WR-TIMEZONE:Asia/Jakarta',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];
  for (const s of subs) {
    const day = s.nextDueDate.getUTCDate();
    // RRULE bulanan dengan DTSTART tgl 31 dilewati di bulan pendek (RFC 5545) → pakai "hari terakhir bulan".
    // ponytail: tgl 29/30 masih terlewat di Februari; tambahkan BYSETPOS bila ada yang mengeluh.
    const rrule = s.cycle === BillingCycle.YEARLY ? 'FREQ=YEARLY' : day === 31 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY';
    const end = new Date(s.nextDueDate.getTime() + 86_400_000);
    const amount = `Rp${Number(s.amount).toLocaleString('id-ID')}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:sub-${s.id}@trackster.dev`,
      `DTSTAMP:${stamp(now)}`,
      `LAST-MODIFIED:${stamp(s.updatedAt)}`,
      `DTSTART;VALUE=DATE:${ymd(s.nextDueDate)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `RRULE:${rrule}`,
      `SUMMARY:${esc(`${s.name} — ${amount}`)}`,
      `DESCRIPTION:${esc([`Langganan ${s.cycle === BillingCycle.YEARLY ? 'tahunan' : 'bulanan'} · dari Trackster`, s.notes].filter(Boolean).join('\n'))}`,
      'TRANSP:TRANSPARENT',
    );
    if (s.reminderDaysBefore > 0) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${s.name} jatuh tempo`)}`, `TRIGGER:-P${s.reminderDaysBefore}D`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
