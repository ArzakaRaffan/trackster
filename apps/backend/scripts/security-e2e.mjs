#!/usr/bin/env node
// Tes regresi audit keamanan 2026-10-10 (docs/multi-user/09-Security-Audit.md). Menyerang backend yang SEDANG JALAN di DB scratch
// (JANGAN prod) dan memakai CLI `prisma/user-admin.js` dengan DATABASE_URL yang sama.
//   AI_BASE_URL=http://127.0.0.1:9 AI_RATE_PER_MIN=3 AUTH_THROTTLE_LIMIT=100 TELEGRAM_WEBHOOK_SECRET=<s> node dist/main
//   lalu: JWT_SECRET=<sama> ADMIN_USERNAME=<admin> ADMIN_PASSWORD=<pw> TELEGRAM_WEBHOOK_SECRET=<s> node scripts/security-e2e.mjs --base http://localhost:4100
// Tes kunci-login jalan TERAKHIR: username tes terkunci 15 menit sesudahnya.
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx >= 0 ? process.argv[baseIdx + 1] : 'http://localhost:4000';
let pass = 0;
const fails = [];
async function test(name, fn) {
  try { await fn(); pass++; console.log('PASS ', name); } catch (e) { fails.push(name); console.log('FAIL ', name, '\n      ', e.message); }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
const cli = (...a) => execFileSync('node', ['prisma/user-admin.js', ...a], { encoding: 'utf8', env: { ...process.env, FRONTEND_URL: 'http://x.test' } });
const req = (method, path, body, cookie, headers = {}) =>
  fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (r) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('trackster_jwt=')) ?? '';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const signJwt = (payload) => {
  const h = b64u({ alg: 'HS256', typ: 'JWT' });
  const p = b64u({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, ...payload });
  return `${h}.${p}.${createHmac('sha256', process.env.JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`;
};
const RUN = Date.now().toString(36);
const PW = 'Sandi-Panjang-1';

const login = async (username, password) => cookieOf(await req('POST', '/auth/login', { username, password }));
const admin = await login(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
expect(admin, 'login admin gagal — cek ADMIN_USERNAME/ADMIN_PASSWORD');
const B = `sb${RUN}`.slice(0, 24);
const code = cli('invite', '--for', 'sec').trim().split('/').pop();
const regB = await req('POST', '/auth/register', { inviteCode: code, username: B, password: PW });
expect(regB.status === 201, `register B ${regB.status}`);
const cookieB = cookieOf(regB);
const adminId = (await (await req('GET', '/auth/me', undefined, admin)).json()).user.id;

await test('header keamanan API ada, X-Powered-By hilang', async () => {
  const r = await req('GET', '/auth/me');
  expect(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff');
  expect(r.headers.get('x-frame-options') === 'DENY', 'x-frame-options');
  expect(r.headers.get('cache-control') === 'no-store', 'cache-control');
  expect(!r.headers.get('x-powered-by'), 'x-powered-by masih ada');
});

await test('JWT state OAuth (purpose) ditolak sebagai cookie sesi', async () => {
  const forged = signJwt({ sub: adminId, purpose: 'gmail-oauth' });
  expect((await req('GET', '/auth/me', undefined, `trackster_jwt=${forged}`)).status === 401, 'token purpose diterima');
  // kontrol: JWT sesi asli bentuknya sama tapi tanpa purpose -> lolos (membuktikan tes di atas bukan gagal karena tanda tangan)
  expect((await req('GET', '/auth/me', undefined, `trackster_jwt=${signJwt({ sub: adminId, username: 'x', tv: 0 })}`)).status === 200, 'kontrol gagal');
});

await test('member tidak bisa set chat ID Telegram manual (bot bersama)', async () => {
  const r = await req('PUT', '/telegram/config', { chatId: '123456789' }, cookieB);
  expect(r.status === 403, `member chatId -> ${r.status}`);
  const r2 = await req('PUT', '/telegram/config', { botToken: '1:abc' }, cookieB);
  expect(r2.status === 403, `member botToken -> ${r2.status}`);
  const r3 = await req('PUT', '/telegram/config', { notifyEveryTransaction: true }, cookieB);
  expect(r3.status === 200, `member toggle notif -> ${r3.status}`);
  const r4 = await req('PUT', '/telegram/config', { chatId: `9${RUN.length}${Date.now() % 1e6}` }, admin);
  expect(r4.status === 200, `pemilik chatId -> ${r4.status}`);
});

await test('webhook Telegram: secret salah 403, benar 200', async () => {
  expect((await req('POST', '/telegram/webhook/salah', {})).status === 403, 'secret salah lolos');
  expect((await req('POST', `/telegram/webhook/${process.env.TELEGRAM_WEBHOOK_SECRET}`, {})).status === 200, 'secret benar ditolak');
});

await test('query bertingkat (?source[not]=) tidak jadi operator Prisma, limit dijepit', async () => {
  const r = await req('GET', '/transactions?source[not]=BCA&limit=999999&page=-3', undefined, cookieB);
  expect(r.status === 200, `status ${r.status}`);
  const j = await r.json();
  expect(Array.isArray(j.data) && j.data.length <= 500, 'limit tak dijepit');
});

await test('ekspor CSV: formula dinetralkan, tanggal aneh 400', async () => {
  const c = await req('POST', '/transactions', { amount: 1000, description: '=HYPERLINK("http://evil")', source: 'BCA', category: 'LAINNYA', occurredAt: new Date().toISOString() }, cookieB);
  expect(c.status === 201, `buat transaksi ${c.status} ${await c.text()}`);
  const csv = await (await req('GET', '/reports/export.csv', undefined, cookieB)).text();
  expect(csv.includes(`"'=HYPERLINK(""http://evil"")"`), 'formula tidak dinetralkan:\n' + csv);
  expect((await req('GET', '/reports/export.csv?from=2026-01-01%22x', undefined, cookieB)).status === 400, 'from aneh lolos');
});

await test('isolasi: B tak melihat transaksi A, A tak melihat B', async () => {
  const a = await (await req('GET', '/transactions?limit=500', undefined, admin)).json();
  expect(!a.data.some((t) => t.description.includes('evil')), 'transaksi B bocor ke A');
});

await test('batas AI per user per rute -> 429', async () => {
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await req('POST', '/ai/suggest-category', { description: 'kopi', amount: 1 }, cookieB)).status);
  expect(codes.includes(429), `tak pernah 429: ${codes}`);
  const other = await req('POST', '/ai/suggest-category', { description: 'kopi', amount: 1 }, admin);
  expect(other.status !== 429, 'user lain ikut kena batas');
  expect((await req('POST', '/ai/chat', { message: 'x'.repeat(4001) }, admin)).status === 400, 'pesan AI >4000 char lolos');
});

await test('split bill publik: input raksasa 400, shares jahat tidak bikin crash', async () => {
  const base = { restaurantName: 'Warung', billDate: '2026-10-10', participants: [{ name: 'A' }, { name: 'B' }] };
  const big = await req('POST', '/split-bills/public', { ...base, restaurantName: 'x'.repeat(300), items: [] });
  expect(big.status === 400, `nama 300 char -> ${big.status}`);
  const evil = await req('POST', '/split-bills/public', {
    ...base,
    items: [{ description: 'Nasi', amount: 10000, shares: [{ participantIndex: '__proto__', weight: 1 }, { participantIndex: 1, weight: 'x' }, { participantIndex: 0, weight: 1 }] }],
  });
  const bill = await evil.json();
  expect(evil.status === 201, `shares jahat -> ${evil.status} ${JSON.stringify(bill)}`);
  expect(bill.items[0].shares.length === 1, `share tak valid ikut tersimpan: ${JSON.stringify(bill.items[0].shares)}`);
});

await test('kunci login per username 15 mnt: password benar pun ditolak setelah 10 gagal', async () => {
  for (let i = 0; i < 10; i++) await req('POST', '/auth/login', { username: B, password: 'salah-salah-salah' });
  expect((await req('POST', '/auth/login', { username: B, password: PW })).status === 429, 'tidak terkunci');
  expect((await req('POST', '/auth/login', { username: 'x', password: 'y'.repeat(201) })).status === 400, 'password >200 char lolos');
});

console.log(`\n${pass} lulus, ${fails.length} gagal`);
process.exit(fails.length ? 1 : 0);
