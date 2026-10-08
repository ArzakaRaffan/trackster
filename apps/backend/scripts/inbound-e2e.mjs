#!/usr/bin/env node
// Tes inbound end-to-end (Fase 7, P7-04/P7-10): HMAC, replay, alamat salah, isolasi, shadow, filter bank, dedup, konfirmasi forward.
// Memanggil backend yang SEDANG JALAN di DB dev/scratch (JANGAN prod). Memakai dua user ACTIVE pertama di DB.
//   INGEST_HMAC_SECRET=testsecret node dist/main   lalu   INGEST_HMAC_SECRET=testsecret node scripts/inbound-e2e.mjs [--base http://localhost:4000]
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx >= 0 ? process.argv[baseIdx + 1] : 'http://localhost:4000';
const SECRET = process.env.INGEST_HMAC_SECRET;
if (!SECRET) throw new Error('set INGEST_HMAC_SECRET (sama dengan backend)');
const DOMAIN = process.env.INBOUND_DOMAIN || 'in.trackster.dev';
const prisma = new PrismaClient();
const RUN = randomBytes(4).toString('hex');
let pass = 0;
const fails = [];
async function test(name, fn) {
  try { await fn(); pass++; console.log('PASS ', name); } catch (e) { fails.push(name); console.log('FAIL ', name, '\n      ', e.message); }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const cli = (...a) => execFileSync('node', ['prisma/user-admin.js', ...a], { encoding: 'utf8' });

const mime = ({ from = 'BCA <bcamobile@bca.co.id>', subject = 'Transaksi', id, amount = '15,000.00', who = 'Warung Test' }) =>
  `From: ${from}\r\nTo: x@in.trackster.dev\r\nSubject: ${subject}\r\nMessage-ID: <${id}@test>\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n` +
  `<html><body><p>Here are the details of your transaction</p><table>` +
  `<tr><td>Transaction Type</td><td>:</td><td>QRIS Payment</td></tr>` +
  `<tr><td>Payment to</td><td>:</td><td>${who}</td></tr>` +
  `<tr><td>Total Payment</td><td>:</td><td>IDR ${amount}</td></tr>` +
  `<tr><td>Transaction Date</td><td>:</td><td>08 Oct 2026 12:30:00</td></tr>` +
  `<tr><td>Reference No.</td><td>:</td><td>REF${id}</td></tr></table></body></html>`;

function post(body, { to, ts = String(Date.now()), sig, big = false } = {}) {
  const buf = Buffer.from(big ? 'x'.repeat(4 * 1024 * 1024) : body);
  const signature = sig ?? createHmac('sha256', SECRET).update(`${ts}.${sha(buf)}`).digest('hex');
  return fetch(BASE + '/ingest/email', {
    method: 'POST',
    headers: { 'content-type': 'message/rfc822', 'x-trackster-to': to ?? '', 'x-trackster-timestamp': ts, 'x-trackster-signature': signature },
    body: buf,
  });
}
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t }; } };

const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { id: 'asc' }, take: 2 });
expect(users.length === 2, 'butuh 2 user aktif di DB scratch');
const [A, B] = users;
const addrOf = (u) => cli('inbound', '--username', u.username).match(/u-([a-z2-7]+)@/)[1];
const lpA = addrOf(A), lpB = addrOf(B);
const toA = `u-${lpA}@${DOMAIN}`, toB = `u-${lpB}@${DOMAIN}`;
const txCount = (userId, id) => prisma.transaction.count({ where: { userId, description: { contains: id } } });
const logs = (userId, status) => prisma.emailParseLog.findMany({ where: { userId, subject: { contains: RUN }, ...(status ? { status } : {}) } });
// pastikan tidak shadow di awal
cli('inbound', '--username', A.username, '--shadow', 'off'); cli('inbound', '--username', B.username, '--shadow', 'off');

await test('tanpa tanda tangan -> 401', async () => {
  const r = await post(mime({ id: `n${RUN}` }), { to: toA, sig: 'ab'.repeat(32) });
  expect(r.status === 401, `status ${r.status}`);
});
await test('timestamp lama (replay) -> 401', async () => {
  const old = String(Date.now() - 10 * 60_000);
  const r = await post(mime({ id: `o${RUN}` }), { to: toA, ts: old });
  expect(r.status === 401, `status ${r.status}`);
});
await test('alamat tak dikenal -> 200 ignored, tidak ada data', async () => {
  const r = await post(mime({ id: `u${RUN}`, subject: `unknown ${RUN}` }), { to: `u-${'a'.repeat(24)}@${DOMAIN}` });
  const b = await j(r);
  expect(r.status === 200 && b.result === 'ignored', `${r.status} ${JSON.stringify(b)}`);
  expect((await logs(A.id)).length === 0 && (await logs(B.id)).length === 0, 'log tak boleh terbentuk');
});
await test('email bank sah -> tercatat untuk user A saja', async () => {
  const w = `WarungA${RUN}`;
  const r = await post(mime({ id: `a${RUN}`, subject: `bank ${RUN}`, who: w }), { to: toA });
  const b = await j(r);
  expect(r.status === 200 && b.result === 'recorded', `${r.status} ${JSON.stringify(b)}`);
  expect((await txCount(A.id, w)) === 1, 'A harus punya 1 transaksi');
  expect((await txCount(B.id, w)) === 0, 'B tidak boleh punya');
  const a = await prisma.inboundAddress.findUnique({ where: { userId: A.id } });
  expect(a.lastEmailAt && a.forwardVerifiedAt, 'lastEmailAt/forwardVerifiedAt terisi');
});
await test('kirim ulang Message-ID sama -> duplicate, tetap 1 transaksi', async () => {
  const w = `WarungA${RUN}`;
  const r = await post(mime({ id: `a${RUN}`, subject: `bank ${RUN}`, who: w }), { to: toA });
  const b = await j(r);
  expect(b.result === 'duplicate', JSON.stringify(b));
  expect((await txCount(A.id, w)) === 1, 'tidak boleh dobel');
});
await test('email non-bank -> dibuang, tidak disimpan', async () => {
  const r = await post(mime({ id: `p${RUN}`, from: 'Promo <promo@toko.example>', subject: `promo ${RUN}` }), { to: toA });
  const b = await j(r);
  expect(b.result === 'dropped', JSON.stringify(b));
  expect((await logs(A.id)).filter((l) => l.subject.startsWith('promo')).length === 0, 'tidak boleh ada log');
});
await test('isolasi: email ke alamat B tidak muncul di A', async () => {
  const w = `WarungB${RUN}`;
  const r = await post(mime({ id: `b${RUN}`, subject: `bankB ${RUN}`, who: w }), { to: toB });
  expect((await j(r)).result === 'recorded', 'B harus tercatat');
  expect((await txCount(B.id, w)) === 1 && (await txCount(A.id, w)) === 0, 'harus hanya di B');
});
await test('shadow=on -> log SHADOW, tanpa Transaction', async () => {
  cli('inbound', '--username', A.username, '--shadow', 'on');
  const w = `WarungS${RUN}`;
  const r = await post(mime({ id: `s${RUN}`, subject: `shadow ${RUN}`, who: w }), { to: toA });
  const b = await j(r);
  expect(b.result === 'shadow', JSON.stringify(b));
  expect((await txCount(A.id, w)) === 0, 'shadow tidak boleh menulis transaksi');
  const l = (await logs(A.id, 'SHADOW'))[0];
  expect(l && /would: EXPENSE/.test(l.reason), `log shadow: ${JSON.stringify(l)}`);
  cli('inbound', '--username', A.username, '--shadow', 'off');
});
await test('alamat nonaktif -> ignored', async () => {
  await prisma.inboundAddress.update({ where: { userId: B.id }, data: { isActive: false } });
  const r = await post(mime({ id: `x${RUN}`, subject: `inactive ${RUN}`, who: `WarungX${RUN}` }), { to: toB });
  expect((await j(r)).result === 'ignored', 'harus ignored');
  await prisma.inboundAddress.update({ where: { userId: B.id }, data: { isActive: true } });
});
await test('konfirmasi forwarding Gmail -> kode tersimpan, bukan transaksi', async () => {
  const m = `From: Gmail Team <forwarding-noreply@google.com>\r\nSubject: (#987654321) Gmail Forwarding Confirmation - Receive Mail from tester@gmail.com\r\nMessage-ID: <fc${RUN}@g>\r\nContent-Type: text/plain\r\n\r\ntester@gmail.com has requested to automatically forward mail to your email address.\r\nConfirmation code: 987654321\r\n`;
  const r = await post(m, { to: toA });
  expect((await j(r)).result === 'forward-confirmation', 'harus dikenali');
  const a = await prisma.inboundAddress.findUnique({ where: { userId: A.id } });
  expect(a.lastForwardCode === '987654321' && a.gmailSource === 'tester@gmail.com', JSON.stringify(a));
});
await test('body > 3MB -> 413', async () => {
  const r = await post('', { to: toA, big: true });
  expect(r.status === 413, `status ${r.status}`);
});

console.log(`\n${pass} lulus, ${fails.length} gagal`);
await prisma.$disconnect();
process.exit(fails.length ? 1 : 0);
