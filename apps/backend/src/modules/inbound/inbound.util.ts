import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { ParsedMail } from 'mailparser';
import { htmlToText } from '../gmail/parsers/parser.interface';

export const MAX_SKEW_MS = 5 * 60 * 1000;

export const sha256hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

/** Tanda tangan Worker: HMAC-SHA256(secret, `${timestampMs}.${to}.${sha256hex(body)}`) dalam hex. `to` ikut ditandatangani:
 * tanpa itu request sah yang tertangkap bisa diputar ulang (≤5 mnt) ke alamat inbound user lain dengan header To diganti. */
export function signBody(secret: string, timestamp: string, to: string, body: Buffer): string {
  return createHmac('sha256', secret).update(`${timestamp}.${to}.${sha256hex(body)}`).digest('hex');
}

/** Cek tanda tangan (timing-safe) + timestamp (epoch ms) dalam ±5 menit — anti replay. */
export function verifySignature(secret: string, timestamp: string | undefined, signature: string | undefined, to: string | undefined, body: Buffer, now = Date.now()): boolean {
  if (!secret || !timestamp || !signature || !/^\d{10,16}$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_MS) return false;
  const want = Buffer.from(signBody(secret, timestamp, to ?? '', body), 'hex');
  const got = Buffer.from(signature, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

/** `u+<localPart>@<domain>` (subaddressing: satu rule Cloudflare `u@in.trackster.dev` -> Worker; catch-all tak tersedia di subdomain) -> localPart (huruf kecil), atau null bila bukan alamat inbound yang valid. */
export function parseLocalPart(to: string | undefined, domain: string): string | null {
  const m = /^<?u\+([a-z2-7]{20,64})@([^>\s]+)>?$/i.exec((to ?? '').trim());
  return m && m[2].toLowerCase() === domain.toLowerCase() ? m[1].toLowerCase() : null;
}

/** emailId dedup untuk email hasil forward: `fwd:` + hash Message-ID (fallback: hash header+body). */
export function forwardEmailId(messageId: string | undefined, fallbackSeed: string): string {
  return 'fwd:' + sha256hex(messageId?.trim() ? `mid:${messageId.trim()}` : `seed:${fallbackSeed}`).slice(0, 32);
}

/** Email konfirmasi forwarding dari Gmail. ponytail: format belum diverifikasi dengan sampel nyata (audit §10.5). */
export function parseForwardConfirmation(from: string, subject: string, text: string): { code: string; gmailSource?: string } | null {
  if (!/forwarding-noreply@google\.com/i.test(from)) return null;
  const code = /confirmation code:\s*(\d{6,12})/i.exec(text)?.[1] ?? /\(#(\d{6,12})\)/.exec(subject)?.[1];
  if (!code) return null;
  return { code, gmailSource: /from\s+([^\s@]+@[^\s@]+)/i.exec(subject)?.[1] };
}

/** localPart acak: 15 byte (120 bit) -> 24 karakter base32 huruf kecil (a-z2-7). Sama dengan `user-admin.js inbound`. */
export function newLocalPart(): string {
  const A = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = '', out = '';
  for (const b of randomBytes(15)) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

/** Teks body yang dibaca parser: text/plain bila ada, kalau tidak html->teks (meniru jalur Gmail, parser dibuat untuk itu).
 *  Dipakai inbound DAN scripts/parse-eml.ts supaya uji offline memakai jalur yang persis sama. */
export function mailBodyText(raw: Buffer, mail: Pick<ParsedMail, 'text' | 'html'>): string {
  const hasPlain = /^content-type:\s*text\/plain/im.test(raw.toString('latin1'));
  return (hasPlain && mail.text) || (mail.html ? htmlToText(mail.html) : mail.text) || '';
}
