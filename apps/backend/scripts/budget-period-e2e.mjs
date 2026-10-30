#!/usr/bin/env node
// E2E budget dari kebiasaan (docs/budget-kebiasaan.md) terhadap backend yang SEDANG JALAN di DB scratch (JANGAN prod).
// Memakai CLI `prisma/user-admin.js` (undangan) + Prisma langsung untuk menyiapkan riwayat sintetis.
//   DATABASE_URL=<scratch> node dist/main      lalu      DATABASE_URL=<scratch> node scripts/budget-period-e2e.mjs [--base http://localhost:4000]
// Angka yang di-assert bergantung "hari ini" — skrip menghitung ekspektasi dari tanggal saat jalan, bukan angka tetap.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
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
const eq = (a, b, m) => expect(JSON.stringify(a) === JSON.stringify(b), `${m}: dapat ${JSON.stringify(a)}, harap ${JSON.stringify(b)}`);
const cli = (...a) => execFileSync('node', ['prisma/user-admin.js', ...a], { encoding: 'utf8', env: { ...process.env, FRONTEND_URL: 'http://x.test' } });
const req = async (method, path, cookie, body) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
};
const ok = async (method, path, cookie, body) => {
  const r = await req(method, path, cookie, body);
  expect(r.status >= 200 && r.status < 300, `${method} ${path} -> ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json;
};
const RUN = Date.now().toString(36);
const PW = 'Sandi-Panjang-1';

async function newUser(tag) {
  const code = cli('invite', '--for', tag).trim().split('/').pop();
  const username = `bp${tag}${RUN}`.slice(0, 24);
  const r = await fetch(BASE + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inviteCode: code, username, password: PW }) });
  expect(r.status === 201, `register ${tag} ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('trackster_jwt=')) ?? '';
  const me = await ok('GET', '/auth/me', cookie);
  return { cookie, id: me.user.id, username };
}

// ── tanggal WIB (sama dengan common/wib.ts) ──
const WIB = 7 * 3600_000;
const DAY = 86_400_000;
const wibKey = (d) => new Date(d.getTime() + WIB).toISOString().slice(0, 10);
const startOfDay = (d) => new Date(`${wibKey(d)}T00:00:00+07:00`);
const dow = (d) => new Date(`${wibKey(d)}T00:00:00Z`).getUTCDay();
const now = new Date();
const today = startOfDay(now);
const daysToMonday = ((1 - dow(today) + 7) % 7) || 7; // hari tersisa dalam periode Senin, termasuk hari ini
const round500 = (n) => Math.round(n / 500) * 500;
const monday = new Date(today.getTime() - ((dow(today) + 6) % 7) * DAY);

try {
  // ── 1. User baru: pasti 600rb/minggu (Senin), sisihkan 10%, daftar hari ini → periode pertama diprorata ──
  const A = await newUser('a');
  let stream;
  await test('wizard: pemasukan pasti mingguan 600rb → jatah prorata langsung terpetakan', async () => {
    stream = await ok('POST', '/income-streams', A.cookie, { name: 'Pemasukan pasti', kind: 'FIXED', cadence: 'WEEKLY', source: 'BCA', amount: 600000, payDayOfWeek: 1, isActive: true });
    const s = await ok('PUT', '/budget/settings', A.cookie, { period: 'WEEKLY', periodDay: 1, basis: 'INCOME', reservePct: 10, anchorStreamId: stream.id });
    eq(s.needsReview, false, 'needsReview');
    const t = await ok('GET', '/budget/today', A.cookie);
    const firstPeriod = daysToMonday < 7; // daftar Senin = periode penuh
    eq(t.cycle.firstPeriod, firstPeriod, 'firstPeriod');
    const pot = 600000 * 0.9 * (daysToMonday / 7);
    eq(t.budget, round500(pot / daysToMonday), 'jatah hari ini');
    eq(t.cycle.pasti[0].learned, false, 'belum dipelajari (riwayat < 3)');
    eq(t.cycle.daysLeft, daysToMonday, 'daysLeft');
  });

  let tambahanPot;
  await test('pemasukan tambahan 300rb langsung menaikkan jatah (tidak diprorata)', async () => {
    const inc = await ok('POST', '/income', A.cookie, { amount: 300000, description: 'Project desain', source: 'BCA', receivedAt: now.toISOString() });
    eq(inc.streamId ?? null, null, 'bukan pasti (beda jauh dari 600rb)');
    const t = await ok('GET', '/budget/today', A.cookie);
    tambahanPot = 600000 * 0.9 * (daysToMonday / 7) + 300000 * 0.9;
    eq(t.budget, round500(tambahanPot / daysToMonday), 'jatah setelah tambahan');
    eq(t.cycle.tambahan, 300000, 'tambahan tercatat');
  });

  await test('pemasukan mirip pasti (590rb, tanpa sumber) tertaut otomatis, angka asli menggantikan perkiraan', async () => {
    const inc = await ok('POST', '/income', A.cookie, { amount: 590000, description: 'Transfer mingguan', source: 'BCA', receivedAt: now.toISOString() });
    eq(inc.streamId, stream.id, 'tertaut ke pemasukan pasti');
    const t = await ok('GET', '/budget/today', A.cookie);
    eq(t.cycle.pasti[0].received, 590000, 'pasti diterima');
    eq(t.cycle.pasti[0].expected, 0, 'perkiraan 0 setelah masuk');
    eq(t.budget, round500((590000 + 300000) * 0.9 / daysToMonday), 'jatah = (pasti asli + tambahan) × 90%');
  });

  await test('gaya Hemat langsung diterapkan (sisihkan 15%), pratinjau 3 gaya tersedia', async () => {
    const before = await ok('GET', '/budget/today', A.cookie);
    eq(before.cycle.styles.length, 3, 'pratinjau gaya');
    const hemat = before.cycle.styles.find((x) => x.option === 'hemat');
    const t = await ok('POST', '/budget/apply', A.cookie, { option: 'hemat' });
    eq(t.cycle.style, 'hemat', 'gaya aktif');
    eq(t.cycle.reservePct, 15, 'reservePct');
    eq(t.budget, hemat.allowance, 'jatah = pratinjau hemat');
    eq(t.budget, round500((590000 + 300000) * 0.85 / daysToMonday), 'jatah hemat');
  });

  await test('gaya tidak dikenal → 400', async () => eq((await req('POST', '/budget/apply', A.cookie, { option: 'boros' })).status, 400, 'status'));

  await test('TARGET bulanan Rp3,1jt (daftar hari ini → diprorata)', async () => {
    await ok('PUT', '/budget/settings', A.cookie, { basis: 'TARGET', period: 'MONTHLY', periodDay: 1, targetAmount: 3100000 });
    const t = await ok('GET', '/budget/today', A.cookie);
    const end = new Date(`${t.cycle.end}T00:00:00+07:00`);
    const start = new Date(`${t.cycle.start}T00:00:00+07:00`);
    const total = Math.round((end - start) / DAY);
    const left = Math.round((end - today) / DAY);
    const spent = 0;
    eq(t.cycle.target, 3100000 * 1, 'target tampil');
    eq(t.budget, round500((3100000 * (left / total) - spent) / left), 'jatah target prorata');
    eq(t.cycle.tambahan, 300000, 'pemasukan tetap tercatat tapi tidak memengaruhi target');
  });

  await test('validasi setelan: periodDay mingguan 9 → 400, anchor milik user lain → 400', async () => {
    eq((await req('PUT', '/budget/settings', A.cookie, { period: 'WEEKLY', periodDay: 9 })).status, 400, 'periodDay');
    const B = await newUser('b');
    eq((await req('PUT', '/budget/settings', B.cookie, { anchorStreamId: stream.id })).status, 400, 'anchor user lain');
  });

  // ── 2. User lama: setelan FIXED/CYCLE diturunkan otomatis + banner ──
  await test('user lama FIXED (nominal per hari tidak rata) → target mingguan = Σ, bobot manual, needsReview', async () => {
    const L = await newUser('l');
    await ok('PUT', '/budget', L.cookie, { budgets: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, amount: d === 6 || d === 0 ? 100000 : 50000 })) });
    const s = await ok('GET', '/budget/settings', L.cookie);
    eq(s.needsReview, true, 'needsReview');
    eq(s.basis, 'TARGET', 'basis');
    eq(s.period, 'WEEKLY', 'period');
    eq(s.periodDay, 1, 'Senin');
    eq(s.targetAmount, 450000, 'target = Σ per hari');
    eq(s.autoWeights, false, 'bobot manual dipertahankan');
    const t = await ok('GET', '/budget/today', L.cookie);
    eq(t.cycle.needsReview, true, 'banner di ringkasan');
    const saved = await ok('PUT', '/budget/settings', L.cookie, {});
    eq(saved.needsReview, false, '"Sudah benar" menyimpan setelan');
  });

  await test('user lama CYCLE (gaji bulanan tgl 25) → ikut pemasukan, periode bulanan tgl 25', async () => {
    const C = await newUser('c');
    const st = await ok('POST', '/income-streams', C.cookie, { name: 'Gaji', kind: 'FIXED', cadence: 'MONTHLY', source: 'BCA', amount: 3000000, payDayOfMonth: 25, isActive: true });
    await prisma.budgetSetting.create({ data: { userId: C.id, mode: 'CYCLE', anchorStreamId: st.id, reservePct: 10 } });
    const s = await ok('GET', '/budget/settings', C.cookie);
    eq([s.needsReview, s.basis, s.period, s.periodDay], [true, 'INCOME', 'MONTHLY', 25], 'turunan');
  });

  // ── 3. Kebiasaan: riwayat sintetis 8 minggu ──
  const H = await newUser('h');
  await test('kebiasaan: kopi lebih sering dari biasanya, pemasukan pasti telat, "biasanya" dipelajari', async () => {
    await prisma.user.updateMany({ where: { id: H.id }, data: { createdAt: new Date(monday.getTime() - 9 * 7 * DAY) } });
    const st = await ok('POST', '/income-streams', H.cookie, { name: 'Uang mingguan', kind: 'FIXED', cadence: 'WEEKLY', source: 'BCA', amount: 700000, payDayOfWeek: 1, isActive: true });
    await ok('PUT', '/budget/settings', H.cookie, { period: 'WEEKLY', periodDay: 1, basis: 'INCOME', reservePct: 10, anchorStreamId: st.id });
    const tx = (at, amount, description, category = 'MAKANAN') => ({
      userId: H.id, amount, description, source: 'BCA', category, occurredAt: at, emailId: `manual:${randomUUID()}`, isManual: true,
      merchantKey: description.toLowerCase().split(' ').slice(0, 3).join(' '),
    });
    const rows = [];
    const incomes = [];
    for (let w = 8; w >= 1; w--) {
      const ws = new Date(monday.getTime() - w * 7 * DAY);
      for (let d = 0; d < 7; d++) rows.push(tx(new Date(ws.getTime() + d * DAY + 12 * 3600_000), d === 5 ? 150000 : 50000, 'Warung Bu Sri'));
      rows.push(tx(new Date(ws.getTime() + 1 * DAY + 19 * 3600_000), 30000, 'Kopi Kenangan'), tx(new Date(ws.getTime() + 3 * DAY + 19 * 3600_000), 30000, 'Kopi Kenangan'));
      if (w <= 6) incomes.push({ userId: H.id, amount: w % 2 ? 650000 : 600000, description: 'Uang mingguan', source: 'BCA', receivedAt: new Date(ws.getTime() + 9 * 3600_000), streamId: st.id, status: 'CONFIRMED' });
    }
    // minggu ini: kopi tiap hari yang sudah lewat (minimal 3×)
    const elapsed = Math.round((today - monday) / DAY) + 1;
    for (let d = 0; d < Math.max(3, elapsed); d++) rows.push(tx(new Date(Math.min(monday.getTime() + d * DAY + 8 * 3600_000, now.getTime() - 60_000)), 30000, 'Kopi Kenangan'));
    await prisma.transaction.createMany({ data: rows });
    await prisma.income.createMany({ data: incomes });

    const h = await ok('GET', '/habits', H.cookie);
    eq(h.learning, null, 'sudah kenal');
    expect(h.spending.usualWeekly > 0, 'belanja biasanya terisi');
    expect(h.insights.some((x) => x.id.startsWith('habit-up:') && x.textId.includes('Kopi Kenangan')), 'insight kopi: ' + JSON.stringify(h.insights.map((x) => x.textId)));
    expect(h.insights.every((x) => x.textEn), 'teks EN');
    if (dow(today) !== 1) eq(h.insights[0].id, 'pasti-late:Uang mingguan', 'pemasukan pasti telat paling atas');
    eq(h.income.usualPasti, 625000, 'median pemasukan pasti per periode (3×650rb, 3×600rb)');

    const t = await ok('GET', '/budget/today', H.cookie);
    eq(t.cycle.pasti[0].learned, true, 'biasanya dipelajari');
    eq(t.cycle.pasti[0].usual, 625000, 'median 6 pembayaran (3×650rb, 3×600rb)');
    eq(t.cycle.weightsLearned, true, 'bobot hari dari kebiasaan (≥4 minggu)');
    expect(t.cycle.weights[6] > t.cycle.weights[1], 'Sabtu lebih berat dari Senin');
    eq(t.cycle.styles.length, 3, 'gaya');
  });

  await test('isolasi: user lain tidak melihat kebiasaan H', async () => {
    const B = await newUser('i');
    const h = await ok('GET', '/habits', B.cookie);
    expect(!JSON.stringify(h).includes('Kopi Kenangan'), 'bocor');
    expect(h.learning, 'akun baru = masih kenalan');
  });

  await test('endpoint lama sudah tidak ada (404)', async () => {
    for (const p of ['/income/checkin', '/income/forecast/week', '/budget-allocation/preview', '/budget/suggestions', '/income/allocation', '/ai/budget-suggestions', '/budget/rollover']) {
      eq((await req('GET', p, A.cookie)).status, 404, p);
    }
  });
} finally {
  await prisma.$disconnect();
}

console.log(`\n${pass} lulus, ${fails.length} gagal`);
if (fails.length) process.exit(1);
