import * as assert from 'assert';
import { calculateInstallment, monthlyIrr } from './installment-math';

function runChecks() {
  console.log('Running installment-math checks...');

  // 1. Tanpa bunga, tanpa fee: cicilan = harga/tenor, total = harga, biaya tambahan 0, IRR ~0
  const r1 = calculateInstallment({ price: 12_000_000, downPayment: 0, tenorMonths: 12, monthlyRatePercent: 0, adminFee: 0, upfrontFee: 0 });
  assert.strictEqual(r1.monthlyInstallment, 1_000_000);
  assert.strictEqual(r1.totalInterest, 0);
  assert.strictEqual(r1.totalPayment, 12_000_000);
  assert.strictEqual(r1.extraCost, 0);
  assert.ok(r1.effectiveAnnualRatePercent !== null && Math.abs(r1.effectiveAnnualRatePercent) < 0.01);

  // 2. Flat 1%/bulan, 12 bulan: bunga total = pokok × 1% × 12 = 12% pokok
  const r2 = calculateInstallment({ price: 10_000_000, downPayment: 0, tenorMonths: 12, monthlyRatePercent: 1, adminFee: 0, upfrontFee: 0 });
  assert.strictEqual(r2.totalInterest, 1_200_000);
  assert.strictEqual(r2.extraCost, 1_200_000);
  // IRR flat 1%/bulan 12 bulan ≈ 21.3% efektif tahunan — harus jauh di atas 12%
  assert.ok(r2.effectiveAnnualRatePercent !== null && r2.effectiveAnnualRatePercent > 20, `got ${r2.effectiveAnnualRatePercent}`);

  // 3. Flat 2.95%/bulan (paylater umum) — efektif tahunan harus > 35%
  const r3 = calculateInstallment({ price: 5_000_000, downPayment: 0, tenorMonths: 6, monthlyRatePercent: 2.95, adminFee: 0, upfrontFee: 0 });
  assert.ok(r3.effectiveAnnualRatePercent !== null && r3.effectiveAnnualRatePercent > 35, `got ${r3.effectiveAnnualRatePercent}`);

  // 4. Dengan DP: pokok = harga - DP
  const r4 = calculateInstallment({ price: 10_000_000, downPayment: 2_000_000, tenorMonths: 10, monthlyRatePercent: 0, adminFee: 0, upfrontFee: 0 });
  assert.strictEqual(r4.principal, 8_000_000);
  assert.strictEqual(r4.monthlyInstallment, 800_000);

  // 5. Admin fee per bulan: total admin = fee × tenor
  const r5 = calculateInstallment({ price: 1_000_000, downPayment: 0, tenorMonths: 3, monthlyRatePercent: 0, adminFee: 5_000, upfrontFee: 0 });
  assert.strictEqual(r5.totalAdmin, 15_000);
  assert.strictEqual(r5.extraCost, 15_000);

  // 6. Denda keterlambatan = % dari cicilan
  const r6 = calculateInstallment({ price: 1_000_000, downPayment: 0, tenorMonths: 2, monthlyRatePercent: 0, adminFee: 0, upfrontFee: 0, latePenaltyPercent: 5 });
  assert.strictEqual(r6.latePenaltyPerMonth, 25_000);
  // 7. NPV pada IRR harus ≈ 0 (definisi IRR)
  const flows = [
    { t: 0, v: 1_000_000 },
    { t: 1, v: -350_000 },
    { t: 2, v: -350_000 },
    { t: 3, v: -350_000 },
  ];
  const irr = monthlyIrr(flows);
  assert.ok(irr !== null);
  const npvAtIrr = flows.reduce((s, f) => s + f.v / Math.pow(1 + irr!, f.t), 0);
  assert.ok(Math.abs(npvAtIrr) < 1, `npv ${npvAtIrr}`);

  console.log('All checks passed!');
}

runChecks();
