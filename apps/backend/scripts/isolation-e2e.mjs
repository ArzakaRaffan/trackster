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
const PRE_C1 = env.ISO_PRE_C1 !== '0';

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
// A membuat data berpenanda unik; B (akun kosong) tidak boleh melihatnya, tidak boleh mengubah/menghapusnya lewat id,
// dan data A harus utuh sesudah semua percobaan B. Pra-C1: B tidak punya baris saldo/budget (unik global), jadi
// pemeriksaan "tindakan A tak menggerakkan saldo B" ditunda sampai C1 (lihat 04 §C tambahan (a)/(b)).
// Pra-C1 unik global (BankBalance.source, DailyBudget.dayOfWeek, PeriodReport(period,periodStart), ...) membuat user kedua yang MENULIS
// baris tabel itu error 500. Tes yang butuh itu (mis. /reports/aggregate untuk akun kosong, B membuat income) aktif setelah C1: ISO_PRE_C1=0.
const haveBoth = env.ISO_A_USER && env.ISO_A_PASS && env.ISO_B_USER && env.ISO_B_PASS;
if (!haveBoth) skip('lintas-user (A vs B)', 'set ISO_A_* dan ISO_B_* (dua user; B boleh kosong)');
else {
  const cookieA = await login(env.ISO_A_USER, env.ISO_A_PASS);
  const cookieB = await login(env.ISO_B_USER, env.ISO_B_PASS);
  const TAG = `ISO${Date.now()}`; // penanda unik — dicari di semua respons B
  const body = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
  const mk = async (name, method, path, payload) => {
    const r = await call(method, path, cookieA, payload);
    const text = await r.text();
    expect(r.status >= 200 && r.status < 300, `setup A ${name}: ${method} ${path} -> ${r.status} ${text.slice(0, 120)}`);
    try { return JSON.parse(text); } catch { return text; }
  };

  // --- data A ---
  const tx = await mk('transaksi', 'POST', '/transactions', { amount: 12345, description: `${TAG} kopi`, source: 'BCA', category: 'MAKANAN', occurredAt: new Date().toISOString() });
  const inc = await mk('income', 'POST', '/income', { amount: 54321, description: `${TAG} gaji`, source: 'BCA', receivedAt: new Date().toISOString() });
  const goal = await mk('goal', 'POST', '/goal', { name: `${TAG} goal`, targetAmount: 1000000 });
  const sub = await mk('subscription', 'POST', '/subscriptions', { name: `${TAG} sub`, amount: 10000, cycle: 'MONTHLY', nextDueDate: '2030-01-01' });
  const alias = await mk('alias', 'POST', '/merchant-aliases', { rawDescription: `${TAG} raw`, displayName: `${TAG} alias` });
  const stream = await mk('stream', 'POST', '/income-streams', { name: `${TAG} stream`, kind: 'FIXED', cadence: 'WEEKLY', source: 'BCA', amount: 1000, payDayOfWeek: 1 });
  const reimb = await mk('reimbursement', 'POST', '/reimbursements', { transactionId: tx.id, personName: `${TAG} budi`, amount: 1000 });
  const mem = await mk('memory', 'POST', '/ai/memory', { kind: 'PROFILE', content: `${TAG} memori` });
  const thread = await mk('thread', 'POST', '/ai/threads', {});
  const balanceA0 = JSON.stringify(await body(await call('GET', '/balance', cookieA)));

  // (1) list: B tidak melihat penanda A di endpoint manapun yang bisa memuatnya
  const LISTS = ['/transactions', '/transactions/weekly', '/transactions/monthly', '/transactions/summary', '/transactions/insights', '/transactions/subscriptions',
    '/transactions/uncategorized-merchants', '/income', '/income/allocation', '/income-streams', '/income/forecast/week', '/income/forecast/horizon', '/income/checkin',
    '/goal', '/subscriptions', '/merchant-aliases', '/reimbursements', '/reimbursements?status=RECEIVED', '/ai/memory', '/ai/threads', '/budget/today', '/budget', '/balance',
    '/analytics/stats', '/reports?period=week', ...(PRE_C1 ? [] : ['/reports/aggregate']), '/reports/records', '/reports/export.csv', '/ai/health-score/history', '/sync/logs', '/sync/parse-log'];
  for (const p of LISTS) {
    await test(`B tidak melihat data A  GET ${p}`, async () => {
      const r = await call('GET', p, cookieB);
      const text = await r.text();
      expect(r.status !== 500, `500 untuk akun kosong: ${text.slice(0, 160)}`);
      expect(!text.includes(TAG), 'penanda A muncul di respons B — KEBOCORAN');
    });
  }
  await test('B kosong: /balance = [] dan /transactions total 0', async () => {
    expect(JSON.stringify(await body(await call('GET', '/balance', cookieB))) === '[]', '/balance B tidak kosong');
    const t = await body(await call('GET', '/transactions', cookieB));
    expect(t.total === 0, `total transaksi B = ${t.total}`);
  });

  // (2) by-id milik A diakses B -> 404/403 (tidak pernah 200/500)
  const ID = [
    ['DELETE', `/transactions/${tx.id}`], ['PATCH', `/transactions/${tx.id}/note`, { note: 'x' }], ['PATCH', `/transactions/${tx.id}/category`, { category: 'BELANJA' }],
    ['PATCH', `/transactions/${tx.id}/category`, { category: 'BELANJA', applyToAll: true }], ['PATCH', `/transactions/${tx.id}/alias`, { displayName: 'x' }],
    ['PATCH', `/transactions/${tx.id}/big`, { isBig: true }], ['GET', `/transactions/${tx.id}/same-merchant-count`],
    ['PUT', `/income/${inc.id}`, { amount: 1 }], ['DELETE', `/income/${inc.id}`], ['PATCH', `/income/${inc.id}/resolve`, { notIncome: true }],
    ['POST', `/goal/${goal.id}/contribute`, { amount: 1 }], ['PATCH', `/goal/${goal.id}/archive`], ['POST', `/goal/${goal.id}/simulate`, { cutPercent: 10 }],
    ['PUT', `/subscriptions/${sub.id}`, { name: 'x' }], ['DELETE', `/subscriptions/${sub.id}`],
    ['PUT', `/merchant-aliases/${alias.id}`, { displayName: 'x' }], ['DELETE', `/merchant-aliases/${alias.id}`],
    ['PUT', `/income-streams/${stream.id}`, { name: 'x' }], ['DELETE', `/income-streams/${stream.id}`],
    ['POST', `/reimbursements/${reimb.id}/received`, {}], ['DELETE', `/reimbursements/${reimb.id}`],
    ['PATCH', `/ai/memory/${mem.id}`, { content: 'x' }], ['DELETE', `/ai/memory/${mem.id}`],
    ['GET', `/ai/threads/${thread.id}/messages`], ['PATCH', `/ai/threads/${thread.id}`, { title: 'x' }], ['DELETE', `/ai/threads/${thread.id}`],
    ['POST', `/ai/threads/${thread.id}/messages`, { text: 'halo' }],
  ];
  for (const [m, p, b] of ID) {
    await test(`B ditolak 404/403  ${m} ${p}`, async () => {
      const r = await call(m, p, cookieB, b ?? (m === 'GET' || m === 'DELETE' ? undefined : {}));
      expect(r.status === 404 || r.status === 403, `harus 404/403, dapat ${r.status}`);
    });
  }
  // B membuat resource yang MERUJUK id milik A (foreign key dari klien) -> ditolak
  await test('B tidak bisa membuat reimbursement atas transaksi A', async () => {
    const r = await call('POST', '/reimbursements', cookieB, { transactionId: tx.id, personName: 'x', amount: 1 });
    expect(r.status === 404 || r.status === 403, `dapat ${r.status}`);
  });
  await test('A tidak bisa me-resolve income-nya ke stream milik B (foreign key lintas user)', async () => {
    const bStream = await body(await call('POST', '/income-streams', cookieB, { name: 'b stream', kind: 'FIXED', cadence: 'WEEKLY', source: 'BCA', amount: 1, payDayOfWeek: 1 }));
    const r = await call('PATCH', `/income/${inc.id}/resolve`, cookieA, { streamId: bStream.id });
    expect(r.status === 404 || r.status === 403, `dapat ${r.status}`);
    await call('DELETE', `/income-streams/${bStream.id}`, cookieB);
  });

  // (3) data A utuh sesudah semua percobaan B
  await test('data A utuh setelah serangan B', async () => {
    const t = await body(await call('GET', '/transactions', cookieA));
    const row = t.data.find((x) => x.id === tx.id);
    expect(row && row.note !== 'x' && row.category === 'MAKANAN' && row.isBig !== true, 'transaksi A berubah/hilang');
    expect(JSON.stringify(await body(await call('GET', '/balance', cookieA))) === balanceA0, 'saldo A berubah');
    for (const [p, label] of [['/income', 'income'], ['/goal', 'goal'], ['/subscriptions', 'subscription'], ['/merchant-aliases', 'alias'], ['/income-streams', 'stream'], ['/ai/memory', 'memori']]) {
      const text = JSON.stringify(await body(await call('GET', p, cookieA)));
      expect(text.includes(TAG), `${label} milik A hilang/berubah`);
    }
    expect(JSON.stringify(await body(await call('GET', '/reimbursements', cookieA))).includes(TAG), 'reimbursement A hilang');
    const ths = await body(await call('GET', '/ai/threads', cookieA));
    expect(ths.some((x) => x.id === thread.id), 'thread A hilang');
  });

  // bersihkan data uji A
  for (const [m, p] of [['DELETE', `/reimbursements/${reimb.id}`], ['DELETE', `/transactions/${tx.id}`], ['DELETE', `/income/${inc.id}`], ['DELETE', `/subscriptions/${sub.id}`],
    ['DELETE', `/merchant-aliases/${alias.id}`], ['DELETE', `/income-streams/${stream.id}`], ['DELETE', `/ai/memory/${mem.id}`], ['DELETE', `/ai/threads/${thread.id}`]]) {
    await call(m, p, cookieA);
  }
}

console.log(`\n${pass} lulus, ${fails.length} gagal, ${skipped.length} dilewati`);
if (fails.length) process.exit(1);
