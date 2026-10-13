import * as assert from 'assert';
import { simpleParser } from 'mailparser';
import { forwardEmailId, newLocalPart, parseForwardConfirmation, parseLocalPart, signBody, verifySignature } from './inbound.util';

const secret = 's3cret';
const body = Buffer.from('From: a@b.c\r\n\r\nhalo');
const now = 1_760_000_000_000;
const ts = String(now);
const to = 'u-abcdefghijklmnopqrst2345@in.trackster.dev';
const sig = signBody(secret, ts, to, body);

// HMAC + timestamp
assert.ok(verifySignature(secret, ts, sig, to, body, now));
assert.ok(!verifySignature('lain', ts, sig, to, body, now), 'secret salah');
assert.ok(!verifySignature(secret, ts, sig, to, Buffer.from('diubah'), now), 'body diubah');
assert.ok(!verifySignature(secret, ts, sig, 'u-zzzzzzzzzzzzzzzzzzzzzzzz@in.trackster.dev', body, now), 'alamat tujuan diganti (replay ke user lain)');
assert.ok(!verifySignature(secret, String(now - 6 * 60_000), signBody(secret, String(now - 6 * 60_000), to, body), to, body, now), 'replay > 5 menit');
assert.ok(!verifySignature(secret, ts, sig.slice(0, 10), to, body, now), 'signature pendek');
assert.ok(!verifySignature(secret, ts, 'zz'.repeat(32), to, body, now), 'bukan hex');
assert.ok(!verifySignature('', ts, sig, to, body, now), 'secret kosong tak boleh lolos');

// alamat
const lp = 'abcdefghijklmnopqrst2345';
assert.strictEqual(parseLocalPart(`u-${lp}@in.trackster.dev`, 'in.trackster.dev'), lp);
assert.strictEqual(parseLocalPart(`<U-${lp.toUpperCase()}@IN.Trackster.dev>`, 'in.trackster.dev'), lp);
assert.strictEqual(parseLocalPart(`u-${lp}@trackster.dev`, 'in.trackster.dev'), null, 'domain salah');
assert.strictEqual(parseLocalPart('u-abc@in.trackster.dev', 'in.trackster.dev'), null, 'terlalu pendek (bisa ditebak)');
assert.strictEqual(parseLocalPart(undefined, 'in.trackster.dev'), null);

// dedup id stabil
assert.strictEqual(forwardEmailId('<m1@x>', 'a'), forwardEmailId(' <m1@x> ', 'b'));
assert.notStrictEqual(forwardEmailId('<m1@x>', 'a'), forwardEmailId('<m2@x>', 'a'));
assert.notStrictEqual(forwardEmailId(undefined, 'a'), forwardEmailId(undefined, 'b'));
assert.ok(forwardEmailId('<m1@x>', '').startsWith('fwd:'));

// konfirmasi forwarding Gmail
assert.deepStrictEqual(
  parseForwardConfirmation('Gmail Team <forwarding-noreply@google.com>', '(#123456789) Gmail Forwarding Confirmation - Receive Mail from me@gmail.com', 'Confirmation code: 123456789'),
  { code: '123456789', gmailSource: 'me@gmail.com' },
);
assert.strictEqual(parseForwardConfirmation('x@bca.co.id', 'Confirmation code: 123456', 'Confirmation code: 123456'), null, 'bukan dari Google');

// MIME HTML-only (seperti email bank) terbaca mailparser
(async () => {
  const mime = 'From: BCA <noreply@bca.co.id>\r\nSubject: Transaksi\r\nMessage-ID: <abc@bca>\r\nDate: Wed, 07 Oct 2026 10:00:00 +0700\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<table><tr><td>Nominal</td><td>:</td><td>Rp 10.000</td></tr></table>';
  const m = await simpleParser(Buffer.from(mime));
  assert.strictEqual(m.from?.text.includes('noreply@bca.co.id'), true);
  assert.strictEqual(m.messageId, '<abc@bca>');
  assert.ok(m.html && m.html.includes('Nominal'));
  console.log('inbound.util.check OK');
})();

// alamat baru dari newLocalPart lolos parseLocalPart (format sama dgn CLI)
{ const lp = newLocalPart(); assert.match(lp, /^[a-z2-7]{24}$/); assert.strictEqual(parseLocalPart(`u-${lp}@in.trackster.dev`, 'in.trackster.dev'), lp); assert.notStrictEqual(newLocalPart(), lp); }
