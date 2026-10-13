#!/usr/bin/env node
// Kirim satu file email (.eml) ke POST /ingest/email persis seperti Cloudflare Worker (HMAC + timestamp + X-Trackster-To).
// Dipakai untuk menguji parser dengan email bank ASLI tanpa DNS/Cloudflare: di Gmail buka email → ⋮ → "Download message".
// File .eml asli berisi data pribadi: simpan di luar repo, JANGAN di-commit.
//
//   INGEST_HMAC_SECRET=<sama dgn backend> node scripts/send-eml.mjs --file email.eml --to u-xxxx@in.trackster.dev [--base http://localhost:4000]
//   ... --gmail-confirm --to u-xxxx@in.trackster.dev    kirim email konfirmasi penerusan Gmail tiruan (kode acak) untuk menguji wizard langkah 4
import { createHash, createHmac, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const base = arg('--base') ?? 'http://localhost:4000';
const to = arg('--to');
const secret = process.env.INGEST_HMAC_SECRET;
if (!secret || !to) {
  console.error('Pakai: INGEST_HMAC_SECRET=... node scripts/send-eml.mjs (--file x.eml | --gmail-confirm) --to u-xxxx@in.trackster.dev [--base URL]');
  process.exit(1);
}

let body;
if (process.argv.includes('--gmail-confirm')) {
  const code = String(randomInt(100_000_000, 999_999_999));
  body = Buffer.from(
    `From: Gmail Team <forwarding-noreply@google.com>\r\nTo: ${to}\r\nSubject: (#${code}) Gmail Forwarding Confirmation - Receive Mail from tester@gmail.com\r\n` +
      `Message-ID: <fwdconfirm-${code}@google.com>\r\nDate: ${new Date().toUTCString()}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n` +
      `tester@gmail.com has requested to automatically forward mail to your email address ${to}.\r\nConfirmation code: ${code}\r\n`,
  );
  console.log('kode konfirmasi tiruan:', code);
} else {
  const file = arg('--file');
  if (!file) throw new Error('--file atau --gmail-confirm wajib');
  body = readFileSync(file);
}

const ts = String(Date.now());
const sig = createHmac('sha256', secret).update(`${ts}.${to}.${createHash('sha256').update(body).digest('hex')}`).digest('hex');
const res = await fetch(base + '/ingest/email', {
  method: 'POST',
  headers: { 'content-type': 'message/rfc822', 'x-trackster-to': to, 'x-trackster-timestamp': ts, 'x-trackster-signature': sig },
  body,
});
console.log(res.status, await res.text());
// Hasil: recorded = transaksi tercatat · income · excluded (mis. transfer ke rekening sendiri) · unparsed (format belum dikenali)
//        duplicate (sudah pernah) · dropped (pengirim bukan bank) · ignored (alamat tak dikenal) · shadow (mode uji)
