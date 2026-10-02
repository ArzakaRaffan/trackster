// Drift-guard: track-mascot.js must stay the exact "Struk" contract (tag name + 5 moods).
// Plain node, no framework: `node track-mascot.check.mjs`
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../../../public/track-mascot.js'), 'utf8');

assert.match(src, /customElements\.define\(\s*['"]track-mascot['"]/, 'must register tag "track-mascot"');
for (const mood of ['idle', 'happy', 'alert', 'think', 'hide']) {
  assert.match(src, new RegExp(`\\b${mood}:\\s*{`), `MOODS table must keep "${mood}"`);
}
assert.match(src, /react\(n\)/, 'must keep imperative react(name) method');

console.log('track-mascot.check.mjs OK — tag name + 5 moods + react() intact');
