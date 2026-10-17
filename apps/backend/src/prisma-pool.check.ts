/**
 * prisma-pool.check.ts — default connection_limit di DATABASE_URL.
 * Jalankan: npx ts-node --transpile-only src/prisma-pool.check.ts
 */
import * as assert from 'assert';
import { withPoolDefaults } from './prisma.service';

assert.strictEqual(withPoolDefaults('postgresql://u:p@h:5432/db'), 'postgresql://u:p@h:5432/db?connection_limit=10');
assert.strictEqual(withPoolDefaults('postgresql://u:p@h/db?schema=x'), 'postgresql://u:p@h/db?schema=x&connection_limit=10');
assert.strictEqual(withPoolDefaults('postgresql://u:p@h/db?connection_limit=3'), 'postgresql://u:p@h/db?connection_limit=3', 'nilai .env dihormati');
assert.strictEqual(withPoolDefaults(undefined), undefined);
console.log('prisma-pool.check OK');
