#!/usr/bin/env node
// Golden snapshot: login sebagai satu user lalu simpan JSON respons endpoint GET kunci (read-only, tanpa endpoint
// yang memanggil AI / punya efek samping). Dipakai membuktikan "perilaku untuk Arzaka identik" sebelum/sesudah refaktor
// multi-user (docs/multi-user 03-Roadmap P0-07, 04 §F).
//
//   GOLDEN_USER=... GOLDEN_PASS=... node scripts/golden-snapshot.mjs take sebelum [--base http://localhost:4000]
//   node scripts/golden-snapshot.mjs diff <a.json> <b.json> [--ignore key1,key2]
//
// Berkas disimpan DI LUAR repo (berisi data finansial; repo ini publik): $GOLDEN_DIR atau <tmpdir>/trackster-golden.
// Ambil dua snapshot pada hari (dan jam-minggu) yang sama — banyak endpoint bergantung "hari ini".
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCES = ['BCA', 'JAGO', 'GOPAY', 'BNI', 'MANDIRI', 'RAYA', 'BRI'];
// Hanya GET read-only. Sengaja TIDAK ada: ai/mascot-tip, ai/snapshot, ai/insight-card, ai/budget-suggestions,
// budget/suggestions (memanggil AI/menulis cache), gmail/auth-url, gmail/callback.
const ENDPOINTS = [
  '/auth/me',
  '/transactions', '/transactions/subscriptions', '/transactions/weekly', '/transactions/monthly',
  '/transactions/summary', '/transactions/insights', '/transactions/uncategorized-merchants',
  '/balance', ...SOURCES.map((s) => `/balance/${s}/adjustments`),
  '/budget', '/budget/rollover', '/budget/today', '/budget/runway', '/budget-allocation/preview',
  '/income', '/income/allocation', '/income-streams', '/income/forecast/week', '/income/forecast/horizon', '/income/checkin',
  '/analytics/stats', '/reports?period=week', '/reports?period=month', '/reports/aggregate', '/reports/records',
  '/goal', '/subscriptions', '/merchant-aliases', '/merchant-aliases/category-icons', '/reimbursements',
  '/ai/health-score/history', '/ai/memory', '/ai/threads',
  '/telegram/status', '/gmail/status', '/sync/next-run', '/sync/logs', '/sync/parse-log',
  '/split-bills',
];
// Kunci yang berubah tiap panggilan (waktu server) — diabaikan saat diff. Tambah lewat --ignore.
const DEFAULT_IGNORE = ['generatedAt', 'serverTime', 'fetchedAt'];

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
};
const dir = process.env.GOLDEN_DIR || join(tmpdir(), 'trackster-golden');

async function take(label) {
  const base = flag('base', 'http://localhost:4000');
  const { GOLDEN_USER: username, GOLDEN_PASS: password } = process.env;
  if (!label || !username || !password) throw new Error('Pakai: GOLDEN_USER=.. GOLDEN_PASS=.. node golden-snapshot.mjs take <label>');
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!login.ok) throw new Error(`login gagal: ${login.status}`);
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const out = { takenAt: new Date().toISOString(), base, endpoints: {} };
  for (const path of ENDPOINTS) {
    const r = await fetch(base + path, { headers: { cookie } });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    out.endpoints[path] = { status: r.status, body };
    console.log(String(r.status).padEnd(4), path);
  }
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${label}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nDisimpan: ${file}`);
}

function strip(v, ignore) {
  if (Array.isArray(v)) return v.map((x) => strip(x, ignore));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([k]) => !ignore.has(k)).map(([k, x]) => [k, strip(x, ignore)]));
  }
  return v;
}

function diff(a, b, path, acc) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  const bothObj = a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b);
  if (!bothObj) return void acc.push(`${path}\n    - ${JSON.stringify(a)?.slice(0, 160)}\n    + ${JSON.stringify(b)?.slice(0, 160)}`);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) diff(a[k], b[k], `${path}.${k}`, acc);
}

function runDiff(fa, fb) {
  const ignore = new Set([...DEFAULT_IGNORE, ...(flag('ignore', '') || '').split(',').filter(Boolean)]);
  const A = strip(JSON.parse(readFileSync(fa, 'utf8')).endpoints, ignore);
  const B = strip(JSON.parse(readFileSync(fb, 'utf8')).endpoints, ignore);
  let bad = 0;
  for (const p of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const acc = [];
    diff(A[p], B[p], '', acc);
    if (acc.length) { bad++; console.log(`BEDA  ${p}\n  ${acc.slice(0, 8).join('\n  ')}${acc.length > 8 ? `\n  … +${acc.length - 8} lagi` : ''}`); }
  }
  console.log(bad ? `\n${bad} endpoint berbeda` : '\nIDENTIK');
  process.exit(bad ? 1 : 0);
}

if (cmd === 'take') await take(rest[0]);
else if (cmd === 'diff') runDiff(rest[0], rest[1]);
else { console.log('perintah: take <label> | diff <a.json> <b.json>'); process.exit(2); }
