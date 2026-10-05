#!/usr/bin/env node
// Audit statis (heuristik) isolasi tenant: setiap pemanggilan Prisma pada model tenant harus memuat `userId`
// di argumennya (where/data), dan raw SQL harus diberi alasan. Pengecualian sengaja = komentar `// tenancy-ok: <alasan>`
// pada baris pemanggilan atau satu baris di atasnya. Daftar model: docs/multi-user/04-Checklist.md §A.
//
// Pakai: `npm run tenancy-audit` (exit 1 bila ada temuan) | `-- --summary` (ringkas per file) | `-- --json`.
// Ini bukan bukti isolasi (tes isolasi di isolation-e2e.ts yang membuktikan) — hanya jaring statis murah.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

// Nama delegate Prisma (camelCase) untuk model tenant. Split Bill/Trip dikecualikan sengaja (publik, lihat 04 §A).
const TENANT = [
  'transaction', 'reimbursement', 'dailyBudget', 'budgetSetting', 'emailSyncLog', 'emailParseLog',
  'telegramConfig', 'telegramLink', 'telegramLinkCode', 'gmailToken', 'alertLog', 'income', 'incomeStream',
  'bankBalance', 'balanceAdjustment', 'merchantAlias', 'categoryIcon', 'healthScoreLog', 'budgetAdvice',
  'aiInsightCard', 'periodReport', 'goal', 'goalContribution', 'subscription', 'chatThread', 'chatMessage',
  'aiMemory', 'apiToken', 'inboundAddress', 'ownAccount', 'aiUsage',
];
const OPS = [
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'create', 'createMany',
  'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
];
const callRe = new RegExp(`\\.(${TENANT.join('|')})\\.(${OPS.join('|')})\\s*\\(`, 'g');
const rawRe = /\.\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\b/g;

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') && !p.endsWith('.check.ts') && !p.endsWith('.d.ts') ? [p] : [];
  });
}

// Ambil teks argumen dari kurung buka `(` pada indeks i sampai kurung tutup seimbang (abaikan string/komentar sederhana).
function balanced(src, i) {
  let depth = 0, q = null;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (q) {
      if (c === '\\') k++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return src.slice(i, k + 1);
  }
  return src.slice(i);
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;
const findings = [];

for (const file of walk(join(root, 'src'))) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const rel = relative(root, file).split(sep).join('/');
  const allowed = (ln) => /tenancy-ok:\s*\S+/.test(lines[ln - 1] ?? '') || /tenancy-ok:\s*\S+/.test(lines[ln - 2] ?? '');

  for (const m of src.matchAll(callRe)) {
    const open = m.index + m[0].length - 1;
    const arg = balanced(src, open);
    const ln = lineOf(src, m.index);
    if (/\buserId\b/.test(arg) || allowed(ln)) continue;
    findings.push({ file: rel, line: ln, kind: 'prisma', what: `${m[1]}.${m[2]}` });
  }
  for (const m of src.matchAll(rawRe)) {
    const ln = lineOf(src, m.index);
    // ponytail: raw SQL = jendela 800 char setelah pemanggilan (bisa tagged template tanpa kurung)
    if (/\buserId\b/.test(src.slice(m.index, m.index + 800)) || allowed(ln)) continue;
    findings.push({ file: rel, line: ln, kind: 'raw-sql', what: m[1] });
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

if (args.has('--json')) console.log(JSON.stringify(findings, null, 2));
else if (args.has('--summary')) {
  const by = {};
  for (const f of findings) by[f.file] = (by[f.file] ?? 0) + 1;
  for (const [f, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), f);
} else for (const f of findings) console.log(`${f.file}:${f.line}  [${f.kind}] ${f.what} tanpa userId`);

console.log(`\n${findings.length} temuan`);
process.exit(findings.length ? 1 : 0);
