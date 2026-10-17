#!/usr/bin/env node
// Simpan/bandingkan output JSON endpoint baca untuk user uji (refaktor performa harus menghasilkan angka identik). DB scratch saja.
//   node scripts/golden-api.mjs save out.json | compare out.json   (env GOLD_USER/GOLD_PASS, default user perf)
import { readFileSync, writeFileSync } from 'node:fs';
const [mode, file] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://localhost:4000';
const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: process.env.GOLD_USER ?? 'perf', password: process.env.GOLD_PASS ?? 'perf-password-123' }) });
if (!r.ok) throw new Error('login ' + r.status);
const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const PATHS = ['/analytics/stats?range=7d', '/analytics/stats?range=30d', '/analytics/stats?range=90d', '/analytics/stats?range=all',
  '/reports?period=month', '/reports?period=week', '/transactions/insights', '/transactions/weekly', '/transactions/monthly',
  '/transactions/summary', '/budget/today', '/budget/runway', '/income/forecast/week', '/income/forecast/horizon?weeks=4',
  '/transactions/uncategorized-merchants', '/sync/parse-log?limit=200'];
const out = {};
for (const p of PATHS) { const res = await fetch(BASE + p, { headers: { cookie } }); out[p] = { status: res.status, body: await res.json().catch(() => null) }; }
if (mode === 'save') { writeFileSync(file, JSON.stringify(out, null, 1)); console.log('saved', Object.keys(out).length); }
else {
  const old = JSON.parse(readFileSync(file, 'utf8')); let bad = 0;
  for (const p of PATHS) { const same = JSON.stringify(old[p]) === JSON.stringify(out[p]); if (!same) bad++; console.log(same ? 'SAME' : 'DIFF', p); }
  process.exit(bad ? 1 : 0);
}
