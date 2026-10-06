#!/usr/bin/env node
// Tes alur auth end-to-end (Fase 5, P5-07): undangan, daftar, nonaktif, ganti/reset password, logout-all, throttle.
// Memanggil backend yang SEDANG JALAN di DB dev/scratch (JANGAN prod) dan CLI `prisma/user-admin.js` dengan DATABASE_URL yang sama.
//   AUTH_CACHE_MS=0 AUTH_THROTTLE_LIMIT=1000 MAX_USERS=1000 node dist/main   (backend)   lalu   AUTH_CACHE_MS=0 node scripts/auth-e2e.mjs [--base http://localhost:4000]
// Butuh minimal satu user ADMIN aktif di DB. Throttle login 10/mnt/IP: tes throttle jalan TERAKHIR dan membuat IP ini terkunci ±1 menit.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx >= 0 ? process.argv[baseIdx + 1] : 'http://localhost:4000';
let pass = 0;
const fails = [];
async function test(name, fn) {
  try { await fn(); pass++; console.log('PASS ', name); } catch (e) { fails.push(name); console.log('FAIL ', name, '\n      ', e.message); }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
const cli = (...a) => execFileSync('node', ['prisma/user-admin.js', ...a], { encoding: 'utf8', env: { ...process.env, FRONTEND_URL: 'http://x.test' } });
const lastPart = (out) => out.trim().split('/').pop();
const post = (path, body, cookie) => fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body ?? {}) });
const get = (path, cookie) => fetch(BASE + path, { headers: cookie ? { cookie } : {} });
const cookieOf = (r) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('trackster_jwt=')) ?? '';
const RUN = Date.now().toString(36);
const PW = 'Sandi-Panjang-1';
const PW2 = 'Sandi-Baru-Panjang-2';
const uname = (s) => `t${s}${RUN}`.slice(0, 24);

try {
  const invite = (hint) => lastPart(cli('invite', '--for', hint));
  const A = uname('a');
  let cookieA = '';

  await test('undangan -> daftar -> masuk app kosong', async () => {
    const code = invite('Tester A');
    const r = await post('/auth/register', { inviteCode: code, username: A, password: PW, displayName: 'Tester A' });
    expect(r.status === 201, `register ${r.status} ${await r.text()}`);
    cookieA = cookieOf(r);
    expect(cookieA, 'tak ada cookie');
    const me = await (await get('/auth/me', cookieA)).json();
    expect(me.user.username === A && me.user.role === 'MEMBER' && me.user.displayName === 'Tester A', 'me salah ' + JSON.stringify(me));
    const t = await (await get('/transactions', cookieA)).json();
    expect(t.total === 0, 'user baru melihat transaksi orang lain');
    expect(JSON.stringify(await (await get('/balance', cookieA)).json()).includes('BCA'), 'data awal (saldo) tak ter-provision');
  });

  await test('kode undangan dipakai 2x ditolak', async () => {
    const code = invite('sekali');
    const first = await post('/auth/register', { inviteCode: code, username: uname('b'), password: PW });
    expect(first.status === 201, 'pendaftaran pertama gagal ' + first.status);
    const second = await post('/auth/register', { inviteCode: code, username: uname('c'), password: PW });
    expect(second.status === 400, `kode kedua harus 400, dapat ${second.status}`);
  });

  await test('kode kedaluwarsa & kode ngawur ditolak', async () => {
    const code = invite('kedaluwarsa');
    await prisma.invite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) }, where: { forUsernameHint: 'kedaluwarsa' } });
    expect((await post('/auth/register', { inviteCode: code, username: uname('d'), password: PW })).status === 400, 'kedaluwarsa harus 400');
    expect((await post('/auth/register', { inviteCode: 'inv_ngawur_ngawur_ngawur', username: uname('e'), password: PW })).status === 400, 'ngawur harus 400');
  });

  await test('validasi: username dobel, format username, password pendek; kode tetap valid setelah gagal', async () => {
    const code = invite('validasi');
    expect((await post('/auth/register', { inviteCode: code, username: A.toUpperCase(), password: PW })).status === 400, 'huruf besar tak lolos format');
    expect((await post('/auth/register', { inviteCode: code, username: A, password: PW })).status === 409, 'username dobel harus 409');
    expect((await post('/auth/register', { inviteCode: code, username: 'ab', password: PW })).status === 400, 'username pendek');
    expect((await post('/auth/register', { inviteCode: code, username: uname('f'), password: 'pendek' })).status === 400, 'password pendek');
    expect((await post('/auth/register', { inviteCode: code, username: uname('f'), password: PW })).status === 201, 'kode harus tetap valid setelah gagal validasi');
  });

  await test('ganti password: sesi lain mati, sesi ini hidup, sandi lama tak berlaku', async () => {
    const s2 = cookieOf(await post('/auth/login', { username: A, password: PW }));
    expect((await get('/auth/me', s2)).status === 200, 'sesi 2 harus hidup');
    expect((await post('/auth/change-password', { currentPassword: 'salah-salah-1', newPassword: PW2 }, cookieA)).status === 401, 'sandi saat ini salah harus 401');
    const r = await post('/auth/change-password', { currentPassword: PW, newPassword: PW2 }, cookieA);
    expect(r.status === 201, 'change-password ' + r.status);
    const fresh = cookieOf(r);
    expect(fresh, 'tak ada cookie baru');
    expect((await get('/auth/me', s2)).status === 401, 'sesi lain harus mati');
    expect((await get('/auth/me', cookieA)).status === 401, 'cookie lama sesi ini harus mati');
    expect((await get('/auth/me', fresh)).status === 200, 'cookie baru harus hidup');
    expect((await post('/auth/login', { username: A, password: PW })).status === 401, 'sandi lama harus ditolak');
    cookieA = cookieOf(await post('/auth/login', { username: A, password: PW2 }));
    expect(cookieA, 'login sandi baru gagal');
  });

  await test('logout-all mematikan semua sesi', async () => {
    const s2 = cookieOf(await post('/auth/login', { username: A, password: PW2 }));
    expect((await post('/auth/logout-all', {}, cookieA)).status === 201, 'logout-all');
    expect((await get('/auth/me', s2)).status === 401 && (await get('/auth/me', cookieA)).status === 401, 'sesi masih hidup');
    cookieA = cookieOf(await post('/auth/login', { username: A, password: PW2 }));
  });

  await test('reset password admin-issued: sekali pakai, mematikan sesi', async () => {
    const tok = lastPart(cli('reset', '--username', A));
    expect((await post('/auth/reset-password', { token: tok, newPassword: 'pendek' })).status === 400, 'password pendek');
    const r = await post('/auth/reset-password', { token: tok, newPassword: PW });
    expect(r.status === 201, `reset ${r.status} ${await r.text()}`);
    expect((await post('/auth/reset-password', { token: tok, newPassword: PW })).status === 400, 'token dipakai 2x harus 400');
    expect((await get('/auth/me', cookieA)).status === 401, 'sesi lama harus mati');
    expect((await post('/auth/login', { username: A, password: PW2 })).status === 401, 'sandi lama harus ditolak');
    cookieA = cookieOf(await post('/auth/login', { username: A, password: PW }));
    expect(cookieA, 'login sandi reset gagal');
  });

  await test('user DISABLED: login ditolak & sesi berjalan 401', async () => {
    cli('disable', '--username', A);
    expect((await post('/auth/login', { username: A, password: PW })).status === 401, 'login DISABLED harus 401');
    await new Promise((r) => setTimeout(r, Number(process.env.AUTH_CACHE_MS ?? 30_000) + 300));
    expect((await get('/auth/me', cookieA)).status === 401, 'sesi DISABLED harus 401');
    cli('enable', '--username', A);
    expect((await post('/auth/login', { username: A, password: PW })).status === 201, 'login setelah enable');
  });

  await test('brute-force login ditolak sementara (429, kunci per username/IP)', async () => {
    let got429 = false;
    for (let i = 0; i < 25 && !got429; i++) got429 = (await post('/auth/login', { username: 'tidak-ada', password: 'salah-salah-1' })).status === 429;
    expect(got429, 'tak pernah 429');
  });
} finally {
  await prisma.$disconnect();
}
console.log(`\n${pass} lulus, ${fails.length} gagal`);
if (fails.length) process.exit(1);
