import * as assert from 'assert';
import { bearerToken, generateToken, hashToken, isTokenShaped, isValidIdempotencyKey } from './api-token.util';

const t = generateToken();
assert(isTokenShaped(t) && t.length === 44, 'format trk_ + 40');
assert.notStrictEqual(t, generateToken(), 'acak');
assert.strictEqual(hashToken(t).length, 64);
assert.strictEqual(hashToken(t), hashToken(t));
assert.notStrictEqual(hashToken(t), hashToken(t + 'x'));

assert.strictEqual(bearerToken(`Bearer ${t}`), t);
assert.strictEqual(bearerToken(`bearer ${t}`), t);
assert.strictEqual(bearerToken(t), null, 'tanpa skema ditolak');
assert.strictEqual(bearerToken(`Basic ${t}`), null);
assert.strictEqual(bearerToken(`Bearer a b`), null);
assert.strictEqual(bearerToken(undefined), null);
assert(!isTokenShaped('trk_short') && !isTokenShaped('abc'.repeat(20)) && !isTokenShaped('trk_' + '!'.repeat(40)));

assert(isValidIdempotencyKey('3F2504E0-4F89-41D3-9A0C-0305E82C3301'));
assert(!isValidIdempotencyKey('short') && !isValidIdempotencyKey('a'.repeat(101)) && !isValidIdempotencyKey('ada spasi di sini') && !isValidIdempotencyKey(undefined));
console.log('api-token.util.check OK');
