import * as assert from 'assert';
import { calculate, SplitInput } from './split-calc';

function runChecks() {
  console.log('Running split-calc checks...');

  // 1. 3 orang, 1 item patungan (berdua), pajak 10%, service 5%, diskon 20rb, pembulatan 500
  const input1: SplitInput = {
    participants: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }],
    items: [
      { id: 1, price: 100000, qty: 1, shares: [{ participantId: 1, weight: 1 }, { participantId: 2, weight: 1 }] } // A & B patungan
    ],
    taxPercent: 10,
    servicePercent: 5,
    discountAmount: 20000,
    roundingUnit: 500,
    taxAfterService: false,
  };

  const res1 = calculate(input1);
  // A & B subtotal = 50000 each. C = 0.
  // Discount = 20000 (proporsional: A 10000, B 10000)
  // Service = 5% dari 100000 = 5000 (proporsional: A 2500, B 2500)
  // Tax = 10% dari (100000 - 20000) = 8000 (proporsional: A 4000, B 4000)
  // Subtotal setelah = 50000 - 10000 + 2500 + 4000 = 46500 unrounded each
  // total = 93000. Pembulatan 500 -> 93000.
  // totalRoundingDiff = 0
  assert.strictEqual(res1.grandTotal, 93000);
  assert.strictEqual(res1.participants.find(p => p.participantId === 3)!.total, 0);

  // 2. 2 orang, item berbeda, tanpa pajak
  const input2: SplitInput = {
    participants: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    items: [
      { id: 1, price: 30000, qty: 1, shares: [{ participantId: 1, weight: 1 }] },
      { id: 2, price: 50000, qty: 1, shares: [{ participantId: 2, weight: 1 }] },
    ],
  };
  const res2 = calculate(input2);
  assert.strictEqual(res2.grandTotal, 80000);
  assert.strictEqual(res2.participants.find(p => p.participantId === 1)!.total, 30000);
  assert.strictEqual(res2.participants.find(p => p.participantId === 2)!.total, 50000);

  // 3. 1 orang, verifikasi total = grandTotal
  const input3: SplitInput = {
    participants: [{ id: 1, name: 'A' }],
    items: [
      { id: 1, price: 10234, qty: 1, shares: [{ participantId: 1, weight: 1 }] },
    ],
    roundingUnit: 100,
  };
  const res3 = calculate(input3);
  assert.strictEqual(res3.grandTotal, 10200);
  assert.strictEqual(res3.participants[0].total, 10200);
  assert.strictEqual(res3.totalRoundingDiff, -34);

  // 4. taxAfterService: true — verifikasi urutan benar
  const input4: SplitInput = {
    participants: [{ id: 1, name: 'A' }],
    items: [
      { id: 1, price: 100000, qty: 1, shares: [{ participantId: 1, weight: 1 }] },
    ],
    taxPercent: 10,
    servicePercent: 5,
    taxAfterService: true,
  };
  const res4 = calculate(input4);
  // Service = 5000
  // Tax = 10% dari (100000 + 5000) = 10500
  // Total = 115500
  assert.strictEqual(res4.grandTotal, 115500);

  console.log('All checks passed!');
}

runChecks();
