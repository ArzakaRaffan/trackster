#!/usr/bin/env node
// Tes isolasi tenant end-to-end (kerangka — Fase 2 mengisi matriks 04-Checklist §C). Memanggil backend HTTP yang sedang jalan
// (dev/restore, JANGAN prod). Lihat docs/multi-user/05-Security-Testing.md §2.
//
//   node scripts/isolation-e2e.mjs [--base http://localhost:4000]
//   ISO_A_USER/ISO_A_PASS = user dengan data;  ISO_B_USER/ISO_B_PASS = user kosong (bagian 2 aktif hanya bila keduanya diset)
//
// Bagian 1 (sudah aktif di F0): setiap rute privat tanpa cookie → 401. Tak punya efek samping (guard menolak sebelum handler).
// Bagian 2 (F2): user B tak melihat data A di endpoint list; by-id milik A → 404/403.
const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx >= 0 ? process.argv[baseIdx + 1] : 'http://localhost:4000';
const env = process.env;

let pass = 0;
const fails = [];
const skipped = [];
async function test(name, fn) {
  try { await fn(); pass++; console.log('PASS ', name); }
  catch (e) { fails.push(name); console.log('FAIL ', name, '\n      ', e.message); }
}
function skip(name, why) { skipped.push(name); console.log('SKIP ', name, `(${why})`); }
function expect(cond, msg) { if (!cond) throw new Error(msg); }

async function login(username, password) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  expect(r.ok, `login ${username} gagal: ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const call = (method, path, cookie, body) =>
  fetch(BASE + path, { method, headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

// ── Daftar rute privat (04 §C). Sumber kebenaran = controller; rute baru WAJIB ditambahkan di sini. ──
const PRIVATE = [
  ['GET', '/ai/mascot-tip'], ['GET', '/ai/snapshot'], ['GET', '/ai/memory'], ['GET', '/ai/threads'], ['GET', '/ai/threads/1/messages'],
  ['GET', '/ai/insight-card'], ['GET', '/ai/health-score/history'], ['GET', '/ai/budget-suggestions'],
  ['POST', '/ai/memory'], ['POST', '/ai/chat'], ['POST', '/ai/threads'], ['POST', '/ai/threads/1/messages'], ['POST', '/ai/threads/1/messages/stream'],
  ['POST', '/ai/suggest-category'], ['POST', '/ai/reports/trigger-weekly'], ['POST', '/ai/reports/trigger-health-score'],
  ['PATCH', '/ai/memory/1'], ['PATCH', '/ai/threads/1'], ['DELETE', '/ai/memory/1'], ['DELETE', '/ai/threads/1'],
  ['GET', '/analytics/stats'], ['GET', '/auth/me'],
  ['GET', '/balance'], ['PUT', '/balance/BCA'], ['GET', '/balance/BCA/adjustments'],
  ['GET', '/budget-allocation/preview'], ['POST', '/budget-allocation/trigger-weekly'],
  ['GET', '/budget'], ['GET', '/budget/rollover'], ['GET', '/budget/today'], ['GET', '/budget/runway'], ['GET', '/budget/suggestions'],
  ['PUT', '/budget'], ['PUT', '/budget/rollover'], ['POST', '/budget/apply'],
  ['GET', '/gmail/auth-url'], ['GET', '/gmail/status'], ['POST', '/gmail/disconnect'],
  ['GET', '/goal'], ['POST', '/goal'], ['POST', '/goal/1/contribute'], ['POST', '/goal/1/simulate'], ['PATCH', '/goal/1/archive'],
  ['GET', '/income/checkin'], ['POST', '/income/checkin'], ['POST', '/income/checkin/trigger-prompt'], ['POST', '/income/checkin/trigger-reminder'],
  ['GET', '/income/forecast/week'], ['GET', '/income/forecast/horizon'],
  ['GET', '/income-streams'], ['POST', '/income-streams'], ['PUT', '/income-streams/1'], ['DELETE', '/income-streams/1'],
  ['GET', '/income'], ['GET', '/income/allocation'], ['POST', '/income'], ['PUT', '/income/1'], ['DELETE', '/income/1'], ['PATCH', '/income/1/resolve'],
  ['GET', '/merchant-aliases'], ['GET', '/merchant-aliases/category-icons'], ['POST', '/merchant-aliases'], ['PUT', '/merchant-aliases/1'],
  ['PUT', '/merchant-aliases/category-icons'], ['DELETE', '/merchant-aliases/1'],
  ['GET', '/reimbursements'], ['POST', '/reimbursements'], ['POST', '/reimbursements/1/received'], ['DELETE', '/reimbursements/1'],
  ['GET', '/reports'], ['GET', '/reports/aggregate'], ['GET', '/reports/records'], ['GET', '/reports/export.csv'],
  ['GET', '/subscriptions'], ['POST', '/subscriptions'], ['PUT', '/subscriptions/1'], ['DELETE', '/subscriptions/1'],
  ['POST', '/sync/trigger'], ['POST', '/sync/backfill'], ['GET', '/sync/next-run'], ['GET', '/sync/logs'], ['GET', '/sync/parse-log'],
  ['GET', '/telegram/status'], ['PUT', '/telegram/config'], ['POST', '/telegram/test'],
  ['GET', '/transactions'], ['GET', '/transactions/subscriptions'], ['GET', '/transactions/weekly'], ['GET', '/transactions/monthly'],
  ['GET', '/transactions/summary'], ['GET', '/transactions/day/2026-01-01'], ['GET', '/transactions/insights'],
  ['GET', '/transactions/uncategorized-merchants'], ['GET', '/transactions/1/same-merchant-count'],
  ['POST', '/transactions'], ['DELETE', '/transactions/1'], ['PATCH', '/transactions/1/note'], ['PATCH', '/transactions/1/category'],
  ['PATCH', '/transactions/1/alias'], ['PATCH', '/transactions/1/big'],
  ['POST', '/split-bills'], ['POST', '/split-bills/scan-receipt'], ['GET', '/split-bills'], ['GET', '/split-bills/1'], ['PATCH', '/split-bills/1/items/1/assign'],
  ['POST', '/trips'],
];

console.log(`Target: ${BASE}\n`);

// ── Bagian 1: tanpa cookie → 401 ──
for (const [m, p] of PRIVATE) {
  await test(`401 tanpa cookie  ${m} ${p}`, async () => {
    const r = await call(m, p, null, m === 'GET' || m === 'DELETE' ? undefined : {});
    expect(r.status === 401, `harus 401, dapat ${r.status}`);
  });
}

// ── Bagian 2 (F2): lintas-user ──
const haveBoth = env.ISO_A_USER && env.ISO_A_PASS && env.ISO_B_USER && env.ISO_B_PASS;
if (!haveBoth) skip('lintas-user (A vs B)', 'set ISO_A_* dan ISO_B_* (butuh 2 user; ada setelah F5/provisioning)');
else {
  const cookieB = await login(env.ISO_B_USER, env.ISO_B_PASS);
  // TODO(F2): A membuat data berpenanda unik (transaksi, income, goal, thread, memori, alias, subscription, reimbursement…),
  // lalu untuk setiap rute di 04 §C: (1) list sebagai B tidak memuat penanda A; (2) :id/:source/:date milik A sebagai B → 404/403
  // dan data A tak berubah; (3) saldo/budget today/alert log B tak terpengaruh tindakan A; (4) AI chat B tak mengutip data A.
  for (const p of ['/transactions', '/income', '/goal', '/subscriptions', '/merchant-aliases', '/reimbursements', '/ai/memory', '/ai/threads', '/income-streams']) {
    await test(`B (kosong) melihat 0 item  GET ${p}`, async () => {
      const r = await call('GET', p, cookieB);
      expect(r.status === 200, `status ${r.status}`);
      const j = await r.json();
      const items = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : null;
      expect(items === null || items.length === 0, `B melihat ${items?.length} item — kemungkinan kebocoran dari user lain`);
    });
  }
}

console.log(`\n${pass} lulus, ${fails.length} gagal, ${skipped.length} dilewati`);
if (fails.length) process.exit(1);
