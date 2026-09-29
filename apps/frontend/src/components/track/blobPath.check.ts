import assert from 'node:assert';
import { blobPath, BLOB_POINTS, DEFAULT_BLOB_PARAMS } from './blobPath';

function segmentCount(d: string): number {
  return d.split(' C ').length - 1;
}

// Path is always closed and has a fixed segment count, at several t values (no warp).
for (const t of [0, 0.5, 3.14, 100.25]) {
  const d = blobPath(20, 20, 12, t, DEFAULT_BLOB_PARAMS, 1, 1);
  assert.ok(d.startsWith('M '), `path must start with M at t=${t}`);
  assert.ok(d.endsWith(' Z'), `path must be closed with Z at t=${t}`);
  assert.strictEqual(segmentCount(d), BLOB_POINTS, `must have exactly ${BLOB_POINTS} bezier segments at t=${t}`);

  const startMatch = d.match(/^M ([\d.-]+) ([\d.-]+)/);
  const lastSegMatch = d.match(/C [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+) Z$/);
  assert.ok(startMatch && lastSegMatch, `must be able to parse start/end points at t=${t}`);
  assert.strictEqual(startMatch![1], lastSegMatch![1], `last segment must return to start x at t=${t}`);
  assert.strictEqual(startMatch![2], lastSegMatch![2], `last segment must return to start y at t=${t}`);
}

// Squash & stretch (scaleX/scaleY) keeps the path closed too.
const stretched = blobPath(20, 20, 12, 1.2, DEFAULT_BLOB_PARAMS, 1.3, 0.8);
assert.ok(stretched.startsWith('M ') && stretched.endsWith(' Z'));
assert.strictEqual(segmentCount(stretched), BLOB_POINTS);

console.log('blobPath.check.ts OK — path always closed, segment count fixed at', BLOB_POINTS);
