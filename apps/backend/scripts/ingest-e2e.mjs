#!/usr/bin/env node
// Tes ingest end-to-end (Fase 6, P6-07): ApiToken, /ingest/transaction|income, idempotensi, isolasi, validasi, rate limit.
// Memanggil backend yang SEDANG JALAN di DB dev/scratch (JANGAN prod) + CLI `prisma/user-admin.js` (DATABASE_URL sama).
//   AUTH_CACHE_MS=0 AUTH_THROTTLE_LIMIT=1000 MAX_USERS=1000 INGEST_RATE_LIMIT=30 node dist/main   lalu   node scripts/ingest-e2e.mjs [--base http://localhost:4000]
// Satu token dipakai < 30 request/menit; tes rate limit memakai token sendiri. Butuh minimal satu user ADMIN aktif.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx >= 0 ? process.argv[baseIdx + 1] : 'http://localhost:4000';
const LIMIT = Number(process.env.INGEST_RATE_LIMIT || 30);
let pass = 0;
const fails = [];
async function test(name, fn) {
  try { await fn(); pass++; console.log('PASS ', name); } catch (e) { fails.push(name); console.log('FAIL ', name, '\n      ', e.message); }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
const cli = (...a) => execFileSync('node', ['prisma/user-admin.js', ...a], { encoding: 'utf8', env: { ...process.env, FRONTEND_URL: 'http://x.test' } });
const json = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const cookieOf = (r) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('trackster_jwt=')) ?? '';
const RUN = Date.now().toString(36);
const PW = 'Sandi-Panjang-1';
const web = (method, path, cookie, body) => fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const ing = (path, token, key, body, extra = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}), ...extra }, body: JSON.stringify(body) });

async function mkUser(tag) {
  const username = `i${tag}${RUN}`.slice(0, 24);
  const code = cli('invite', '--for', `Ingest ${tag}`).trim().split('/').pop();
  const r = await web('POST', '/auth/register', null, { inviteCode: code, username, password: PW, displayName: `Ingest ${tag}` });
  const rt = await r.text();
  expect(r.status === 201, `register ${tag}: ${r.status} ${rt}`);
  return { username, cookie: cookieOf(r) };
}
async function mkToken(u, label = 'Shortcut') {
  const r = await web('POST', '/api-tokens', u.cookie, { label });
  const b = await json(r);
  expect(r.status === 201, `buat token: ${r.status} ${JSON.stringify(b)}`);
  return b;
}
const balance = async (u, source) => {
  const list = await json(await web('GET', '/balance', u.cookie));
  const row = (Array.isArray(list) ? list : list.balances ?? []).find((b) => b.source === source);
  return row ? Number(row.balance ?? row.amount) : 0;
};
const txs = async (u) => { const b = await json(await web('GET', '/transactions?limit=100', u.cookie)); return b.data ?? b.transactions ?? b; };
const tx = (o = {}) => ({ amount: 25000, description: `Kopi ${RUN}`, source: 'BCA', category: 'MAKANAN', ...o });

try {
  const A = await mkUser('a');
  const B = await mkUser('b');
  const tA = await mkToken(A);
  const tB = await mkToken(B);

  await test('token: format trk_, plaintext hanya saat dibuat, daftar tanpa hash/plaintext', async () => {
    expect(/^trk_[0-9A-Za-z]{40}$/.test(tA.token), `format ${tA.token}`);
    const list = await json(await web('GET', '/api-tokens', A.cookie));
    expect(list.length === 1 && list[0].prefix === tA.token.slice(0, 8), 'daftar salah');
    expect(!JSON.stringify(list).includes(tA.token) && !('tokenHash' in list[0]) && !('token' in list[0]), 'daftar membocorkan token/hash');
  });

  await test('tanpa Authorization / skema salah / token acak / token di query / token di body -> 401', async () => {
    const k = randomUUID();
    for (const [name, r] of [
      ['tanpa header', await ing('/ingest/transaction', null, k, tx())],
      ['Basic', await ing('/ingest/transaction', null, k, tx(), { authorization: `Basic ${tA.token}` })],
      ['acak', await ing('/ingest/transaction', 'trk_' + 'x'.repeat(40), k, tx())],
      ['query', await fetch(`${BASE}/ingest/transaction?token=${tA.token}`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': k }, body: JSON.stringify(tx()) })],
      ['body', await ing('/ingest/transaction', null, k, { ...tx(), token: tA.token })],
      ['cookie JWT bukan token', await fetch(`${BASE}/ingest/transaction`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: A.cookie, 'idempotency-key': k }, body: JSON.stringify(tx()) })],
    ]) expect(r.status === 401, `${name}: ${r.status}`);
  });

  await test('Idempotency-Key hilang / tak valid -> 400', async () => {
    for (const k of [undefined, 'pendek', 'ada spasi di dalam kunci', 'a'.repeat(101)]) {
      const r = await ing('/ingest/transaction', tA.token, k, tx());
      expect(r.status === 400, `kunci ${JSON.stringify(k)}: ${r.status}`);
    }
  });

  const key1 = randomUUID();
  let bal0;
  await test('transaksi: 201, tercatat milik A, saldo A berkurang, pesan memuat sisa budget', async () => {
    bal0 = await balance(A, 'BCA');
    const r = await ing('/ingest/transaction', tA.token, key1, tx({ userId: 1 })); // userId di body harus diabaikan
    const b = await json(r);
    expect(r.status === 201 && b.success && b.duplicate === false && b.id, `${r.status} ${JSON.stringify(b)}`);
    expect(/Tercatat Rp25\.000/.test(b.message) && /budget/.test(b.message), `pesan: ${b.message}`);
    expect(b.category === 'MAKANAN', `kategori ${b.category}`);
    expect((await balance(A, 'BCA')) === bal0 - 25000, 'saldo A harus turun 25000');
    expect((await txs(A)).filter((t) => t.description === `Kopi ${RUN}`).length === 1, 'A harus punya 1 transaksi');
  });

  await test('retry kunci sama -> 200 duplicate:true, tidak menggandakan, saldo tidak bergerak lagi', async () => {
    const r = await ing('/ingest/transaction', tA.token, key1, tx());
    const b = await json(r);
    expect(r.status === 200 && b.duplicate === true, `${r.status} ${JSON.stringify(b)}`);
    expect((await txs(A)).filter((t) => t.description === `Kopi ${RUN}`).length === 1, 'tergandakan');
    expect((await balance(A, 'BCA')) === bal0 - 25000, 'saldo bergerak lagi');
  });

  await test('5 request paralel berkunci sama -> tepat 1 tercatat', async () => {
    const k = randomUUID();
    const before = await balance(A, 'BCA');
    const rs = await Promise.all(Array.from({ length: 5 }, () => ing('/ingest/transaction', tA.token, k, tx({ description: `Paralel ${RUN}`, amount: 10000 }))));
    const codes = rs.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201).length === 1 && codes.filter((c) => c === 200).length === 4, `kode: ${codes}`);
    expect((await txs(A)).filter((t) => t.description === `Paralel ${RUN}`).length === 1, 'baris ganda');
    expect((await balance(A, 'BCA')) === before - 10000, 'saldo salah');
  });

  await test('kunci sama di user lain tidak bentrok (kunci per user)', async () => {
    const r = await ing('/ingest/transaction', tB.token, key1, tx({ source: 'JAGO' }));
    expect(r.status === 201, `B dgn kunci A: ${r.status} ${await r.text()}`);
  });

  await test('isolasi: B tak melihat transaksi A; transaksi token B milik B', async () => {
    const bTx = await txs(B);
    expect(!bTx.some((t) => t.description === `Kopi ${RUN}` && t.source === 'BCA'), 'B melihat transaksi A');
    expect(bTx.some((t) => t.source === 'JAGO'), 'transaksi B hilang');
    expect(!(await txs(A)).some((t) => t.source === 'JAGO'), 'A melihat transaksi B');
  });

  const keyI = randomUUID();
  await test('pemasukan: 201, saldo naik, retry kunci sama -> 200 duplicate, saldo tak naik lagi', async () => {
    const before = await balance(A, 'BCA');
    const r = await ing('/ingest/income', tA.token, keyI, { amount: '150000', description: 'Gaji uji', source: 'BCA' });
    const b = await json(r);
    expect(r.status === 201 && b.duplicate === false && b.id, `${r.status} ${JSON.stringify(b)}`);
    expect((await balance(A, 'BCA')) === before + 150000, 'saldo harus naik 150000');
    const r2 = await ing('/ingest/income', tA.token, keyI, { amount: 150000, description: 'Gaji uji', source: 'BCA' });
    const b2 = await json(r2);
    expect(r2.status === 200 && b2.duplicate === true && b2.id === b.id, `${r2.status} ${JSON.stringify(b2)}`);
    expect((await balance(A, 'BCA')) === before + 150000, 'saldo naik dua kali');
    const incomes = await json(await web('GET', '/income', A.cookie));
    expect((incomes.data ?? incomes).filter((i) => i.description === 'Gaji uji').length === 1, 'income ganda');
  });

  await test('pemasukan: streamId milik user lain -> 400; streamId milik sendiri dipakai', async () => {
    const mk = await web('POST', '/income-streams', B.cookie, { name: `Stream B ${RUN}`, type: 'FIXED', cadence: 'MONTHLY', expectedAmount: 1000000 });
    if (mk.status === 201 || mk.status === 200) {
      const sB = await json(mk);
      const r = await ing('/ingest/income', tA.token, randomUUID(), { amount: 1000, description: 'x', source: 'BCA', streamId: sB.id });
      expect(r.status === 400, `streamId B lewat token A: ${r.status}`);
    }
    const r2 = await ing('/ingest/income', tA.token, randomUUID(), { amount: 1000, description: 'x', source: 'BCA', streamId: 999999 });
    expect(r2.status === 400, `streamId asing: ${r2.status}`);
  });

  const tV = await mkToken(A, 'Validasi'); // token terpisah: tes validasi mengirim >16 request, jangan menghabiskan jatah tA

  await test('validasi: amount/description/source/waktu/kategori tak valid -> 400, tak ada efek', async () => {
    const before = await balance(A, 'BCA');
    const bad = [
      { amount: 0 }, { amount: -5 }, { amount: 'abc' }, { amount: 'Rp 50.000' }, { amount: 1e12 }, { amount: 10.123 }, { amount: null },
      { description: '' }, { description: '   ' }, { description: 'x'.repeat(201) },
      { source: undefined }, { source: 'NOPE' }, { category: 'NOPE' },
      { occurredAt: new Date(Date.now() + 3600_000).toISOString() }, { occurredAt: 'kemarin' }, { occurredAt: '1999-01-01T00:00:00Z' },
    ];
    for (const patch of bad) {
      const r = await ing('/ingest/transaction', tV.token, randomUUID(), { ...tx(), ...patch });
      expect(r.status === 400, `${JSON.stringify(patch)} -> ${r.status}`);
    }
    expect((await balance(A, 'BCA')) === before, 'saldo bergerak karena input invalid');
  });

  await test('body besar (>100kb) -> 413', async () => {
    const r = await ing('/ingest/transaction', tV.token, randomUUID(), tx({ description: 'x'.repeat(300_000) }));
    expect(r.status === 413, `dapat ${r.status}`);
  });

  await test('amount teks angka polos diterima; waktu lampau diterima', async () => {
    const r = await ing('/ingest/transaction', tV.token, randomUUID(), tx({ amount: '5000', description: `Lampau ${RUN}`, occurredAt: new Date(Date.now() - 86400_000).toISOString() }));
    expect(r.status === 201, `${r.status} ${await r.text()}`);
  });

  await test('cabut token: A tak bisa mencabut token B (404); token dicabut -> 401; daftar menandai revokedAt', async () => {
    const list = await json(await web('GET', '/api-tokens', B.cookie));
    const r0 = await web('DELETE', `/api-tokens/${list[0].id}`, A.cookie);
    expect(r0.status === 404, `A mencabut token B: ${r0.status}`);
    expect((await ing('/ingest/transaction', tB.token, randomUUID(), tx({ source: 'JAGO' }))).status === 201, 'token B harus tetap hidup');

    const t2 = await mkToken(A, 'Sementara');
    expect((await ing('/ingest/transaction', t2.token, randomUUID(), tx())).status === 201, 'token baru harus jalan');
    const aList = await json(await web('GET', '/api-tokens', A.cookie));
    const id2 = aList.find((x) => x.label === 'Sementara').id;
    expect((await web('DELETE', `/api-tokens/${id2}`, A.cookie)).status === 200, 'cabut gagal');
    expect((await ing('/ingest/transaction', t2.token, randomUUID(), tx())).status === 401, 'token dicabut masih diterima');
    expect((await web('DELETE', `/api-tokens/${id2}`, A.cookie)).status === 404, 'cabut dua kali harus 404');
    const after = await json(await web('GET', '/api-tokens', A.cookie));
    expect(after.find((x) => x.id === id2).revokedAt, 'revokedAt kosong');
  });

  await test('batas token aktif per user (5) -> yang ke-6 ditolak; setelah dicabut bisa lagi', async () => {
    const C = await mkUser('c');
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push((await mkToken(C, `t${i}`)).id);
    expect((await web('POST', '/api-tokens', C.cookie, { label: 'ke-6' })).status === 400, 'token ke-6 harus ditolak');
    await web('DELETE', `/api-tokens/${ids[0]}`, C.cookie);
    expect((await web('POST', '/api-tokens', C.cookie, { label: 'lagi' })).status === 201, 'setelah cabut harus bisa');
    expect((await web('POST', '/api-tokens', C.cookie, { label: '' })).status === 400, 'label kosong harus ditolak');
  });

  await test('user DISABLED -> token ditolak (401); enable -> jalan lagi', async () => {
    const D = await mkUser('d');
    const tD = await mkToken(D);
    expect((await ing('/ingest/transaction', tD.token, randomUUID(), tx())).status === 201, 'sebelum disable');
    cli('disable', '--username', D.username);
    expect((await ing('/ingest/transaction', tD.token, randomUUID(), tx())).status === 401, 'token user nonaktif masih diterima');
    cli('enable', '--username', D.username);
    expect((await ing('/ingest/transaction', tD.token, randomUUID(), tx())).status === 201, 'setelah enable');
  });

  await test(`rate limit per token: >${LIMIT}/menit -> 429; token lain tak terpengaruh`, async () => {
    const E = await mkUser('e');
    const tE = await mkToken(E);
    let got429 = false;
    for (let i = 0; i < LIMIT + 5 && !got429; i++) got429 = (await ing('/ingest/transaction', tE.token, null, tx())).status === 429; // 400 (kunci hilang) dihitung juga
    expect(got429, 'tak pernah 429');
    expect((await ing('/ingest/transaction', tB.token, randomUUID(), tx({ source: 'JAGO' }))).status === 201, 'token lain ikut terkena');
  });

  await test('lastUsedAt terisi setelah dipakai', async () => {
    await new Promise((r) => setTimeout(r, 300));
    const list = await json(await web('GET', '/api-tokens', A.cookie));
    expect(list.some((x) => x.lastUsedAt), 'lastUsedAt kosong');
  });
} catch (e) {
  fails.push('setup');
  console.log('FATAL', e.message);
}
console.log(`\n${pass} lulus, ${fails.length} gagal${fails.length ? ': ' + fails.join(' | ') : ''}`);
process.exit(fails.length ? 1 : 0);
