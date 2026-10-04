/**
 * spend.check.ts — self-check pengeluaran efektif (patungan).
 * Jalankan: npx ts-node --transpile-only src/common/spend.check.ts
 */
import * as assert from 'assert';
import { Prisma } from '@prisma/client';
import { spend, sumSpend, toNet } from './spend';

const D = (n: number) => new Prisma.Decimal(n);

assert.strictEqual(spend({ amount: D(171500), reimbursedAmount: D(38000) }), 133500);
assert.strictEqual(spend({ amount: '171500' }), 171500, 'reimbursedAmount opsional');
assert.strictEqual(sumSpend({ amount: D(622000), reimbursedAmount: D(106000) }), 516000);
assert.strictEqual(sumSpend({ amount: null, reimbursedAmount: null }), 0, 'agregat kosong');
assert.strictEqual(sumSpend(undefined), 0);
const net = toNet({ amount: D(100), reimbursedAmount: D(40), id: 7 });
assert.strictEqual(Number(net.amount), 60);
assert.strictEqual(net.id, 7);
console.log('spend.check: OK');
