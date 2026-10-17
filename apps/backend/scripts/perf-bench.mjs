#!/usr/bin/env node
// Benchmark endpoint yang dimuat app saat dibuka (useLive.ts) — DB scratch/dev saja, JANGAN prod.
//
//   node scripts/perf-bench.mjs --seed            buat user `perf` + ±1 tahun data sintetis (idempotent: dilewati bila sudah ada)
//   node scripts/perf-bench.mjs [--base URL]      ukur: tiap endpoint berurutan (p50 dari 5x) + burst paralel seperti app
//
// Butuh backend jalan dengan DATABASE_URL yang sama. Password user perf: env PERF_PASS (default "perf-password-123").
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { provisionUser } = require('../prisma/provision-user.js');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const BASE = arg('--base') ?? 'http://localhost:4000';
const PASS = process.env.PERF_PASS ?? 'perf-password-123';
const DAY = 86_400_000;

async function seed() {
  const prisma = new PrismaClient();
  try {
    if (await prisma.user.findUnique({ where: { username: 'perf' } })) return console.log('user perf sudah ada — seed dilewati');
    const user = await prisma.user.create({ data: { username: 'perf', password: await bcrypt.hash(PASS, 10), displayName: 'Perf', role: 'MEMBER' } });
    await provisionUser(prisma, user.id);
    const cats = ['MAKANAN', 'TRANSPORT', 'BELANJA', 'TAGIHAN', 'HIBURAN', 'KESEHATAN', 'LAINNYA'];
    const merchants = Array.from({ length: 120 }, (_, i) => `MERCHANT ${i} JAKARTA`);
    const now = Date.now();
    const tx = [];
    for (let d = 0; d < 365; d++) for (let k = 0; k < 8; k++) {
      const m = merchants[(d * 7 + k * 13) % merchants.length];
      tx.push({
        userId: user.id, amount: 5000 + ((d * 31 + k * 977) % 150) * 1000, description: m, merchantKey: m.toLowerCase(),
        source: k % 3 ? 'BCA' : 'JAGO', category: cats[(d + k) % cats.length], occurredAt: new Date(now - d * DAY - k * 3_600_000),
        emailId: `perf:${d}:${k}`,
      });
    }
    await prisma.transaction.createMany({ data: tx });
    await prisma.income.createMany({ data: Array.from({ length: 24 }, (_, i) => ({ userId: user.id, amount: 3_000_000, description: 'Gaji', source: 'BCA', receivedAt: new Date(now - i * 15 * DAY) })) });
    await prisma.emailParseLog.createMany({ data: Array.from({ length: 1500 }, (_, i) => ({ userId: user.id, emailId: `perf-log:${i}`, from: 'bca@bca.co.id', subject: 'Notifikasi', status: 'RECORDED', receivedAt: new Date(now - i * 6 * 3_600_000) })) });
    console.log(`seed: user perf (#${user.id}), ${tx.length} transaksi`);
  } finally {
    await prisma.$disconnect();
  }
}

const ENDPOINTS = (from, to) => [
  '/budget', '/budget/today', '/budget/runway', '/budget/settings', `/budget/allowances?from=${from}&to=${to}`,
  `/transactions?startDate=${from}&endDate=${to}&limit=500`, '/income', '/income-streams', '/income?status=PENDING',
  '/income/forecast/week', '/income/forecast/horizon?weeks=4', '/income/checkin', '/subscriptions', '/goal', '/gmail/status',
  '/telegram/status', '/sync/next-run', '/balance', '/merchant-aliases', '/merchant-aliases/category-icons',
  '/sync/parse-log?limit=200', '/sync/logs', '/transactions/uncategorized-merchants', '/split-bills', '/auth/me', '/profile',
  '/analytics/stats?range=30d', '/reports?period=month', '/transactions/weekly', '/transactions/monthly', '/transactions/insights',
];

async function bench() {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'perf', password: PASS }) });
  if (!r.ok) throw new Error(`login gagal ${r.status} — jalankan --seed dulu`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const iso = (t) => new Date(t + 7 * 3_600_000).toISOString().slice(0, 10);
  const eps = ENDPOINTS(iso(Date.now() - 6 * DAY), iso(Date.now()));
  const hit = async (p) => {
    const t0 = performance.now();
    const res = await fetch(BASE + p, { headers: { cookie, 'accept-encoding': 'gzip' } });
    const body = await res.arrayBuffer();
    return { ms: performance.now() - t0, status: res.status, bytes: body.byteLength };
  };
  const rows = [];
  for (const p of eps) {
    const runs = [];
    for (let i = 0; i < 5; i++) runs.push(await hit(p));
    const ms = runs.map((x) => x.ms).sort((a, b) => a - b);
    rows.push({ endpoint: p.slice(0, 60), status: runs[0].status, p50_ms: +ms[2].toFixed(1), max_ms: +ms[4].toFixed(1), kb: +(runs[0].bytes / 1024).toFixed(1) });
  }
  rows.sort((a, b) => b.p50_ms - a.p50_ms);
  console.table(rows);
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const all = await Promise.all(eps.map(hit));
    console.log(`burst paralel ${eps.length} request #${i + 1}: ${(performance.now() - t0).toFixed(0)} ms (gagal: ${all.filter((x) => x.status >= 400).length})`);
  }
}

if (process.argv.includes('--seed')) await seed();
else await bench();
