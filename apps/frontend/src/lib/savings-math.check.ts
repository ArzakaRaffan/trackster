// Self-check for savings-math.ts (E08-S2). Run from apps/backend:
//   npx ts-node --skip-project ../frontend/src/lib/savings-math.check.ts
import assert from 'node:assert';
import {
  futureValue,
  inflate,
  milestones,
  milestonesWithInflation,
  periodicRate,
  periodsToReach,
  periodsToReachWithInflation,
  projection,
  requiredDeposit,
  samplePoints,
} from './savings-math';

const approx = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

// --- periodicRate: return tahunan → per periode (mingguan/bulanan) ---
approx(periodicRate(0, 'monthly'), 0);
approx(periodicRate(0, 'weekly'), 0);
approx(periodicRate(12, 'monthly'), Math.pow(1.12, 1 / 12) - 1);
approx(periodicRate(12, 'weekly'), Math.pow(1.12, 1 / 52) - 1);

// --- inflate ---
approx(inflate(1_000_000, 0, 10), 1_000_000);
approx(inflate(1_000_000, 100, 1), 2_000_000);
approx(inflate(1_000_000, 3, 2), 1_000_000 * 1.03 * 1.03);

// --- futureValue: kasus 0% = linear; kasus compounding dikenal ---
approx(futureValue(0, 100_000, 0, 12), 1_200_000);
approx(futureValue(1_000_000, 0, 0, 12), 1_000_000);
// Setoran bulanan 1jt, 6%/tahun efektif → 12 bulan, saldo 0.
const r = periodicRate(6, 'monthly');
const fv = futureValue(0, 1_000_000, r, 12);
assert.ok(fv > 12_000_000, 'compounding harus di atas total setoran');
assert.ok(fv < 12_400_000, '6%/thn ~0.49%/bln: bunga 12 bulan harus < 4%');
// Saldo awal ikut compounding: > existing kalau rate > 0.
assert.ok(futureValue(10_000_000, 0, r, 12) > 10_000_000);

// --- requiredDeposit: konsisten dengan futureValue ---
const target = 30_000_000;
const dep = requiredDeposit(target, 2_000_000, r, 24);
assert.ok(dep > 0);
approx(futureValue(2_000_000, dep, r, 24), target, 1e-4);
// 0% → (target - existing)/n
approx(requiredDeposit(30_000_000, 6_000_000, 0, 24), 1_000_000);
// n = 0 → sisa target
approx(requiredDeposit(30_000_000, 10_000_000, 0, 0), 20_000_000);
// existing >= target → 0
approx(requiredDeposit(10_000_000, 12_000_000, r, 24), 0);

// --- periodsToReach ---
approx(periodsToReach(10_000_000, 0, 1_000_000, 0), 10);
approx(periodsToReach(10_000_000, 5_000_000, 0, 0), 5);
assert.strictEqual(periodsToReach(10_000_000, 10_000_000, 1_000_000, 0), 0);
assert.strictEqual(periodsToReach(10_000_000, 0, 0, 0), Infinity);
// Invers dari requiredDeposit.
const pReach = periodsToReach(30_000_000, 2_000_000, dep, r);
approx(pReach, 24, 1e-4);

// --- periodsToReachWithInflation: inflasi nambah waktu, 0% = tanpa inflasi ---
const withInfl = periodsToReachWithInflation(10_000_000, 0, 500_000, 0, 5, 'monthly');
const withoutInfl = periodsToReach(10_000_000, 0, 500_000, 0);
assert.ok(withInfl > withoutInfl, `inflasi harus memperlama: ${withInfl} vs ${withoutInfl}`);
approx(periodsToReachWithInflation(10_000_000, 0, 500_000, 0, 0, 'monthly'), withoutInfl);
// existing >= target → langsung 0
approx(periodsToReachWithInflation(10_000_000, 10_000_000, 0, 0, 3, 'monthly'), 0);

// --- projection ---
const proj = projection(0, 1_000_000, 0, 12);
assert.strictEqual(proj.length, 13);
approx(proj[0].balance, 0);
approx(proj[0].deposits, 0);
approx(proj[12].balance, 12_000_000);
approx(proj[12].deposits, 12_000_000);
approx(proj[12].returns, 0);
// Dengan return: returns = balance - deposits.
const proj2 = projection(0, 1_000_000, r, 12);
assert.ok(proj2[12].returns > 0);
approx(proj2[12].deposits, 12_000_000);

// --- samplePoints: keeps endpoints, caps length ---
const long = projection(0, 100_000, r, 500);
const sampled = samplePoints(long, 120);
assert.ok(sampled.length <= 120);
assert.strictEqual(sampled[0].period, 0);
assert.strictEqual(sampled[sampled.length - 1].period, 500);
assert.strictEqual(samplePoints(projection(0, 100_000, 0, 10), 120).length, 11);

// --- milestones: 25/50/75/100% ---
const ms = milestones(40_000_000, 0, 1_000_000, 0);
assert.deepStrictEqual(ms.map((m) => m.period), [10, 20, 30, 40]);
assert.deepStrictEqual(ms.map((m) => m.pct), [25, 50, 75, 100]);

// --- milestonesWithInflation: inflasi memperlama tiap milestone, 0% = tanpa inflasi ---
const msInfl = milestonesWithInflation(40_000_000, 0, 1_000_000, 0, 5, 'monthly');
const msFlat = milestonesWithInflation(40_000_000, 0, 1_000_000, 0, 0, 'monthly');
assert.deepStrictEqual(msFlat.map((m) => m.period), [10, 20, 30, 40]);
assert.ok(msInfl[3].period > msFlat[3].period, `100% milestone harus lebih lama dengan inflasi`);

console.log('savings-math.check.ts OK — compounding, inflation, required deposit, reach periods, milestones');
