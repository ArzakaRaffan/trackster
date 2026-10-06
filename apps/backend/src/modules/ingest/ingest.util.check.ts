import * as assert from 'assert';
import { resolveEventTime } from './ingest.util';

const now = new Date('2026-10-07T03:00:00Z');
assert.strictEqual(resolveEventTime(undefined, now), now);
assert.strictEqual(resolveEventTime('2026-10-07T02:00:00Z', now)?.toISOString(), '2026-10-07T02:00:00.000Z');
assert.strictEqual(resolveEventTime('2026-10-07T03:03:00Z', now), now, 'toleransi 5 menit dijepit ke sekarang');
assert.strictEqual(resolveEventTime('2026-10-07T03:06:00Z', now), null, 'masa depan jauh ditolak');
assert.strictEqual(resolveEventTime('1999-12-31T00:00:00Z', now), null);
assert.strictEqual(resolveEventTime('bukan tanggal', now), null);
console.log('ingest.util.check OK');
