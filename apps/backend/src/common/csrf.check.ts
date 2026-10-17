/**
 * csrf.check.ts — self-check cek Origin untuk request ber-cookie.
 * Jalankan: npx ts-node --transpile-only src/common/csrf.check.ts
 */
import * as assert from 'assert';
import { isCsrfBlocked } from './csrf';

const FE = 'https://trackster.dev';
assert.strictEqual(isCsrfBlocked('POST', true, FE, FE), false, 'frontend sendiri lolos');
assert.strictEqual(isCsrfBlocked('POST', true, 'https://evil.trackster.dev', FE), true, 'subdomain lain ditolak');
assert.strictEqual(isCsrfBlocked('DELETE', true, 'https://evil.com', FE), true, 'situs lain ditolak');
assert.strictEqual(isCsrfBlocked('PATCH', true, 'null', FE), true, 'origin null (iframe sandbox) ditolak');
assert.strictEqual(isCsrfBlocked('GET', true, 'https://evil.com', FE), false, 'GET tak diubah');
assert.strictEqual(isCsrfBlocked('POST', false, 'https://evil.com', FE), false, 'tanpa cookie sesi (Bearer/webhook) lolos');
assert.strictEqual(isCsrfBlocked('POST', true, undefined, FE), false, 'klien non-browser tanpa Origin lolos');
console.log('csrf.check OK');
