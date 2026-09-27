/** Self-check plan-simulator.ts — fungsi murni, tanpa DB. Jalankan: npx ts-node plan-simulator.check.ts */
import { simulatePlan, whatIfPurchase, PlanBaseline } from './plan-simulator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

const neutralBaseline: PlanBaseline = {
  weeklyIncome: { conservative: 0, expected: 0, max: 0 },
  weeklySpendByCategory: {},
};

// Kasus eksplisit dari epic: target 2jt, nabung 100rb/minggu -> 20 minggu.
{
  const result = simulatePlan(
    { weeks: 25, incomeScenario: 'expected', savePerWeek: 100_000, goal: { target: 2_000_000 } },
    neutralBaseline,
  );
  assert(result.summary.weeksToGoal === 20, `weeksToGoal harus 20, dapat ${result.summary.weeksToGoal}`);
  assert(result.series.length === 25, `series harus 25 minggu, dapat ${result.series.length}`);
  assert(result.series[19].goalProgress === 100, `goalProgress minggu ke-20 harus 100, dapat ${result.series[19].goalProgress}`);
}

// Income > spend tanpa saving eksplisit -> saldo naik terus, tidak ada shortfall.
{
  const baseline: PlanBaseline = {
    weeklyIncome: { conservative: 200_000, expected: 300_000, max: 400_000 },
    weeklySpendByCategory: { MAKANAN: 150_000, TRANSPORT: 50_000 },
  };
  const result = simulatePlan({ weeks: 10, incomeScenario: 'expected' }, baseline);
  assert(result.summary.firstShortfallWeek === null, 'tidak boleh ada shortfall kalau income > spend');
  assert(result.summary.finalBalance === 10 * (300_000 - 200_000), `finalBalance salah: ${result.summary.finalBalance}`);
}

// spendChanges per kategori: -50% MAKANAN mengurangi total spend sesuai porsi kategori itu saja.
{
  const baseline: PlanBaseline = {
    weeklyIncome: { conservative: 0, expected: 0, max: 0 },
    weeklySpendByCategory: { MAKANAN: 200_000, TRANSPORT: 50_000 },
  };
  const withoutCut = simulatePlan({ weeks: 1, incomeScenario: 'expected' }, baseline);
  const withCut = simulatePlan(
    { weeks: 1, incomeScenario: 'expected', spendChanges: [{ category: 'MAKANAN', pct: -50 }] },
    baseline,
  );
  assert(withoutCut.series[0].spend === 250_000, `baseline spend salah: ${withoutCut.series[0].spend}`);
  assert(withCut.series[0].spend === 150_000, `spend setelah potong 50% MAKANAN salah: ${withCut.series[0].spend}`);
}

// oneOffs bikin shortfall terdeteksi di minggu yang benar, tidak sebelum/sesudahnya.
{
  const baseline: PlanBaseline = {
    weeklyIncome: { conservative: 100_000, expected: 100_000, max: 100_000 },
    weeklySpendByCategory: { LAINNYA: 50_000 },
  };
  const result = simulatePlan(
    { weeks: 5, incomeScenario: 'expected', oneOffs: [{ week: 3, amount: 500_000, label: 'Gadget' }] },
    baseline,
  );
  assert(result.summary.firstShortfallWeek === 'Minggu 3', `shortfall harus di Minggu 3, dapat ${result.summary.firstShortfallWeek}`);
  assert(result.series[3].balance > result.series[2].balance, 'saldo harus pulih naik lagi setelah minggu shortfall');
}

// whatIfPurchase cash vs installment: goal mundur lebih sedikit (atau sama) dengan cicilan panjang
// dibanding tunai langsung, karena dampaknya disebar ke banyak minggu bukan sekali gebuk.
{
  const baseline: PlanBaseline = {
    weeklyIncome: { conservative: 300_000, expected: 300_000, max: 300_000 },
    weeklySpendByCategory: { LAINNYA: 100_000 },
  };
  const goal = { target: 4_000_000 };
  const cash = whatIfPurchase(
    { amount: 3_000_000, label: 'Laptop', method: 'cash', weeks: 30, goal, incomeScenario: 'expected', savePerWeek: 150_000 },
    baseline,
  );
  const installment = whatIfPurchase(
    { amount: 3_000_000, label: 'Laptop', method: 'installment', months: 6, weeks: 30, goal, incomeScenario: 'expected', savePerWeek: 150_000 },
    baseline,
  );
  assert(cash.weeksDelay !== null && cash.weeksDelay >= 0, `cash.weeksDelay harus >= 0, dapat ${cash.weeksDelay}`);
  assert(
    installment.weeksDelay !== null && cash.weeksDelay !== null && installment.weeksDelay <= cash.weeksDelay,
    `cicilan seharusnya tidak lebih memundurkan goal daripada tunai (cash=${cash.weeksDelay}, installment=${installment.weeksDelay})`,
  );
  assert(Math.abs(installment.totalCost - 3_000_000) < 1, 'installment tanpa bunga totalCost harus = amount');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
