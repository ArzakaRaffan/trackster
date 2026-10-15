// P7-07: bandingkan hasil Gmail-sync vs email forward mode shadow untuk satu user (plain JS: jalan di container prod).
//   node prisma/compare-shadow.js --username <u> [--days 7] [--verbose]
//   node prisma/compare-shadow.js --self-test
// emailId Gmail (message id) ≠ emailId forward (`fwd:…`), jadi pasangan dicari lewat parser + nominal + selisih waktu ≤ 15 mnt
// (receivedAt Gmail = internalDate, forward = header Date). Hasil per email: COCOK / BEDA (outcome/deskripsi) /
// TIDAK-TERFORWARD (ada di Gmail, tak sampai via forward → filter Gmail?) / HANYA-FORWARD (Gmail-sync tak menangkap).
// Exit 1 bila ada selisih. Output memuat nominal & deskripsi milik user — jalankan hanya di VPS, jangan tempel ke publik.
const { PrismaClient } = require('@prisma/client');
const assert = require('assert');

const TOLERANCE_MS = 15 * 60 * 1000;
const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };

/** Hasil akhir yang sebanding: EXPENSE | INCOME | EXCLUDED | UNPARSED | ERROR. */
function gmailOutcome(l) {
  if (l.status === 'RECORDED' || l.status === 'DUPLICATE') return l.kind || 'EXPENSE';
  return l.status;
}
function shadowOutcome(l) {
  const w = /^would: (\w+)/.exec(l.reason || '');
  return w ? w[1] : 'UNPARSED';
}
const num = (v) => (v == null ? null : Number(v));
const norm = (s) => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');

/** gmail = log non-shadow (emailId bukan `fwd:`), shadow = log status SHADOW. Mengembalikan baris per email. */
function compareShadow(gmail, shadow) {
  const used = new Set();
  const rows = [];
  for (const s of [...shadow].sort((a, b) => a.receivedAt - b.receivedAt)) {
    let best = null;
    for (const g of gmail) {
      if (used.has(g) || g.parser !== s.parser || num(g.amount) !== num(s.amount)) continue;
      const dt = Math.abs(g.receivedAt - s.receivedAt);
      if (dt > TOLERANCE_MS) continue;
      // subjek sama diutamakan, lalu yang waktunya paling dekat
      const score = (g.subject === s.subject ? 0 : TOLERANCE_MS + 1) + dt;
      if (!best || score < best.score) best = { g, score };
    }
    if (!best) { rows.push({ result: 'HANYA-FORWARD', s }); continue; }
    const g = best.g;
    used.add(g);
    const go = gmailOutcome(g), so = shadowOutcome(s);
    const descDiff = g.counterparty && s.counterparty && norm(g.counterparty) !== norm(s.counterparty);
    rows.push({ result: go !== so ? 'BEDA-OUTCOME' : descDiff ? 'BEDA-DESKRIPSI' : 'COCOK', g, s });
  }
  for (const g of gmail) if (!used.has(g)) rows.push({ result: 'TIDAK-TERFORWARD', g });
  return rows;
}

function selfTest() {
  const t = (min) => new Date(Date.UTC(2026, 9, 14, 10, min));
  const G = (o) => ({ parser: 'bca', subject: 'Transaksi', status: 'RECORDED', kind: 'EXPENSE', amount: '15000.00', counterparty: 'WARUNG', receivedAt: t(0), ...o });
  const S = (o) => ({ parser: 'bca', subject: 'Transaksi', reason: 'would: EXPENSE BCA', amount: '15000.00', counterparty: 'warung ', receivedAt: t(2), ...o });
  const r = (gm, sh) => compareShadow(gm, sh).map((x) => x.result).sort();
  assert.deepStrictEqual(r([G()], [S()]), ['COCOK']);
  assert.deepStrictEqual(r([G({ status: 'EXCLUDED', kind: null })], [S({ reason: 'would: EXCLUDED+balanceOnly BCA (owner)' })]), ['COCOK']);
  assert.deepStrictEqual(r([G({ status: 'UNPARSED', kind: null, amount: null })], [S({ reason: 'would: UNPARSED (no parser)', amount: null })]), ['COCOK']);
  assert.deepStrictEqual(r([G({ status: 'DUPLICATE', kind: 'INCOME' })], [S({ reason: 'would: INCOME JAGO' })]), ['COCOK']);
  assert.deepStrictEqual(r([G()], [S({ reason: 'would: UNPARSED (x)' })]), ['BEDA-OUTCOME']);
  assert.deepStrictEqual(r([G()], [S({ counterparty: 'TOKO LAIN' })]), ['BEDA-DESKRIPSI']);
  assert.deepStrictEqual(r([G()], [S({ receivedAt: t(20) })]), ['HANYA-FORWARD', 'TIDAK-TERFORWARD']);
  assert.deepStrictEqual(r([G()], [S({ amount: '15001.00' })]), ['HANYA-FORWARD', 'TIDAK-TERFORWARD']);
  assert.deepStrictEqual(r([G({ parser: 'jago' })], [S()]), ['HANYA-FORWARD', 'TIDAK-TERFORWARD']);
  // dua email nominal sama berdekatan: dipasangkan per subjek, tidak ditukar
  const pairs = compareShadow([G({ subject: 'A', receivedAt: t(0) }), G({ subject: 'B', receivedAt: t(1) })], [S({ subject: 'B', receivedAt: t(0) }), S({ subject: 'A', receivedAt: t(1) })]);
  assert.ok(pairs.every((p) => p.result === 'COCOK' && p.g.subject === p.s.subject));
  console.log('compare-shadow self-test OK');
}

async function main(prisma) {
  const username = arg('username');
  if (!username) throw new Error('--username wajib');
  const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
  if (!user) throw new Error('User tidak ditemukan');
  const days = Number(arg('days') || 7);
  const select = { emailId: true, subject: true, receivedAt: true, status: true, reason: true, amount: true, counterparty: true, kind: true, parser: true };
  const since = new Date(Date.now() - days * 864e5);
  const shadow = await prisma.emailParseLog.findMany({ where: { userId: user.id, status: 'SHADOW', receivedAt: { gte: since } }, select });
  if (!shadow.length) { console.log(`Belum ada log SHADOW untuk ${user.username} dalam ${days} hari.`); return; }
  // Mulai bandingkan sejak email forward pertama — email Gmail sebelum filter dibuat bukan selisih.
  const start = new Date(Math.min(...shadow.map((s) => s.receivedAt.getTime())) - TOLERANCE_MS);
  const gmail = await prisma.emailParseLog.findMany({
    where: { userId: user.id, status: { not: 'SHADOW' }, NOT: { emailId: { startsWith: 'fwd:' } }, receivedAt: { gte: start } },
    select,
  });
  const rows = compareShadow(gmail, shadow);
  const count = {};
  for (const r of rows) count[r.result] = (count[r.result] || 0) + 1;
  console.log(`${user.username}: sejak ${start.toISOString().slice(0, 16)}Z — Gmail ${gmail.length}, forward ${shadow.length}`);
  console.table(count);
  const bad = rows.filter((r) => r.result !== 'COCOK');
  const show = process.argv.includes('--verbose') ? rows : bad;
  if (show.length) {
    console.table(show.map(({ result, g, s }) => ({
      result,
      waktu: (g || s).receivedAt.toISOString().slice(0, 16),
      parser: (g || s).parser,
      nominal: num((g || s).amount),
      subjek: (g || s).subject.slice(0, 40),
      gmail: g ? `${gmailOutcome(g)} ${g.counterparty || ''}`.trim() : '-',
      forward: s ? `${shadowOutcome(s)} ${s.counterparty || ''}`.trim() : '-',
    })));
  }
  if (bad.length) process.exitCode = 1;
}

if (process.argv.includes('--self-test')) selfTest();
else {
  const prisma = new PrismaClient();
  main(prisma).catch((e) => { console.error('Gagal:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
