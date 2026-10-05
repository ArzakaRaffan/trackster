#!/usr/bin/env node
// Jalankan semua `src/**/*.check.ts` (skrip assert murni, tanpa framework) satu per satu lewat ts-node.
// Exit 1 jika ada yang gagal. Pakai: `npm run check` | `npm run check -- --transpile-only` | `npm run check -- balance`
// (argumen non-flag = filter substring path). Satu proses pada satu waktu + cap heap (lihat CAUTION.md).
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const filters = args.filter((a) => !a.startsWith('--'));

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.check.ts') ? [p] : [];
  });
}

const files = walk(join(root, 'src'))
  .map((f) => relative(root, f).split(sep).join('/'))
  .filter((f) => filters.every((x) => f.includes(x)))
  .sort();

const tsNode = join(root, 'node_modules', 'ts-node', 'dist', 'bin.js');
const env = { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=1536' };
const failed = [];

for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [tsNode, ...flags, f], { cwd: root, env, encoding: 'utf8' });
  const ok = r.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (!ok) {
    failed.push(f);
    console.log(((r.stdout ?? '') + (r.stderr ?? '')).split('\n').slice(-25).map((l) => '      ' + l).join('\n'));
  }
}

console.log(`\n${files.length - failed.length}/${files.length} check lulus`);
if (failed.length) {
  console.log('GAGAL:\n  ' + failed.join('\n  '));
  process.exit(1);
}
