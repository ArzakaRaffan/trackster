export type IncomeScenario = 'conservative' | 'expected' | 'max';

export interface SpendChange {
  /** Kategori spesifik (mis. "MAKANAN"). Kalau kosong, berlaku ke total pengeluaran rutin. */
  category?: string;
  /** -20 = kurangi 20% dari baseline kategori/total itu. */
  pct?: number;
  /** Delta nominal tetap per minggu (boleh negatif). */
  weeklyAmount?: number;
}

export interface OneOff {
  /** 1-based, minggu ke berapa dalam horizon simulasi. */
  week: number;
  amount: number;
  label: string;
}

export interface SimulatePlanInput {
  weeks: number;
  incomeScenario: IncomeScenario;
  extraIncomePerWeek?: number;
  spendChanges?: SpendChange[];
  oneOffs?: OneOff[];
  savePerWeek?: number;
  goal?: { target: number; current?: number };
}

export interface PlanBaseline {
  weeklyIncome: Record<IncomeScenario, number>;
  /** Pengeluaran rutin mingguan (median 8 minggu terakhir, tanpa pembelian besar), per kategori. */
  weeklySpendByCategory: Record<string, number>;
  startingBalance?: number;
}

export interface SimulationWeek {
  week: string;
  income: number;
  spend: number;
  saved: number;
  balance: number;
  goalProgress?: number;
}

export interface SimulationResult {
  series: SimulationWeek[];
  summary: {
    weeksToGoal: number | null;
    finalBalance: number;
    minBalance: number;
    firstShortfallWeek: string | null;
  };
  assumptions: string[];
}

const MAX_WEEKS = 104;
const round = (n: number) => Math.round(n);
const fmtRp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

/** Terapkan spendChanges ke baseline kategori. Perubahan tanpa `category` berlaku ke total
 * (bukan diulang per kategori), biar tidak double-count kalau baseline punya banyak kategori. */
function applySpendChanges(
  weeklySpendByCategory: Record<string, number>,
  changes: SpendChange[] = [],
): number {
  const byCategory = { ...weeklySpendByCategory };
  let flatDelta = 0;

  for (const change of changes) {
    if (change.category) {
      const current = byCategory[change.category] ?? 0;
      let next = current;
      if (change.pct != null) next += current * (change.pct / 100);
      if (change.weeklyAmount != null) next += change.weeklyAmount;
      byCategory[change.category] = Math.max(0, next);
    } else {
      const total = Object.values(byCategory).reduce((s, n) => s + n, 0);
      if (change.pct != null) flatDelta += total * (change.pct / 100);
      if (change.weeklyAmount != null) flatDelta += change.weeklyAmount;
    }
  }

  const total = Object.values(byCategory).reduce((s, n) => s + n, 0);
  return Math.max(0, total + flatDelta);
}

/** Engine simulasi, fungsi murni — tidak menyentuh DB/waktu-sekarang. `baseline` dihitung di
 * `PlanSimulatorService` dari data nyata (forecast pemasukan + median pengeluaran rutin). */
export function simulatePlan(input: SimulatePlanInput, baseline: PlanBaseline): SimulationResult {
  const weeks = Math.max(1, Math.min(MAX_WEEKS, Math.round(input.weeks)));
  const income = (baseline.weeklyIncome[input.incomeScenario] ?? 0) + (input.extraIncomePerWeek ?? 0);
  const weeklySpend = applySpendChanges(baseline.weeklySpendByCategory, input.spendChanges);
  const savePerWeek = Math.max(0, input.savePerWeek ?? 0);

  let balance = baseline.startingBalance ?? 0;
  let saved = input.goal?.current ?? 0;
  const goalTarget = input.goal?.target;
  let weeksToGoal: number | null = null;
  let firstShortfallWeek: string | null = null;
  let minBalance = balance;

  const series: SimulationWeek[] = [];
  for (let w = 1; w <= weeks; w++) {
    const oneOffAmount = (input.oneOffs ?? [])
      .filter((o) => o.week === w)
      .reduce((s, o) => s + o.amount, 0);

    balance += income - weeklySpend - savePerWeek - oneOffAmount;
    saved += savePerWeek;
    minBalance = Math.min(minBalance, balance);
    if (balance < 0 && firstShortfallWeek === null) firstShortfallWeek = `Minggu ${w}`;

    const goalProgress = goalTarget ? Math.min(100, (saved / goalTarget) * 100) : undefined;
    if (goalTarget && weeksToGoal === null && saved >= goalTarget) weeksToGoal = w;

    series.push({
      week: `Minggu ${w}`,
      income: round(income),
      spend: round(weeklySpend + oneOffAmount),
      saved: round(savePerWeek),
      balance: round(balance),
      ...(goalProgress != null ? { goalProgress: Math.round(goalProgress * 10) / 10 } : {}),
    });
  }

  const assumptions: string[] = [
    `Pemasukan mingguan (skenario ${input.incomeScenario}): ${fmtRp(income)}`,
    `Pengeluaran rutin mingguan (median 8 minggu terakhir, tanpa pembelian besar): ${fmtRp(weeklySpend)}`,
  ];
  if (savePerWeek > 0) assumptions.push(`Nabung otomatis ${fmtRp(savePerWeek)}/minggu`);

  return {
    series,
    summary: { weeksToGoal, finalBalance: round(balance), minBalance: round(minBalance), firstShortfallWeek },
    assumptions,
  };
}

export interface WhatIfPurchaseInput {
  amount: number;
  label: string;
  method: 'cash' | 'installment';
  months?: number;
  monthlyRate?: number;
  weeks?: number;
  incomeScenario?: IncomeScenario;
  savePerWeek?: number;
  goal?: { target: number; current?: number };
}

export interface WhatIfPurchaseResult {
  without: SimulationResult;
  with: SimulationResult;
  /** Goal mundur berapa minggu dibanding tanpa pembelian ini. null kalau tidak ada goal, atau
   * salah satu skenario tidak mencapai goal dalam horizon simulasi. */
  weeksDelay: number | null;
  totalCost: number;
}

const DEFAULT_HORIZON_WEEKS = 26;

/** Bandingkan simulasi dengan vs tanpa satu pembelian (tunai atau cicilan). Cicilan dimodelkan
 * sebagai deretan `oneOffs` mingguan (bukan spendChange permanen) supaya berhenti begitu lunas. */
export function whatIfPurchase(input: WhatIfPurchaseInput, baseline: PlanBaseline): WhatIfPurchaseResult {
  const weeks = Math.max(1, Math.min(MAX_WEEKS, input.weeks ?? DEFAULT_HORIZON_WEEKS));
  const incomeScenario = input.incomeScenario ?? 'expected';

  const without = simulatePlan({ weeks, incomeScenario, goal: input.goal, savePerWeek: input.savePerWeek }, baseline);

  let oneOffs: OneOff[];
  let totalCost = input.amount;
  if (input.method === 'cash') {
    oneOffs = [{ week: 1, amount: input.amount, label: input.label }];
  } else {
    const months = Math.max(1, Math.round(input.months ?? 1));
    const rate = input.monthlyRate ?? 0;
    totalCost = input.amount * (1 + (rate / 100) * months);
    const installmentWeeks = Math.min(weeks, months * 4);
    const perInstallment = totalCost / installmentWeeks;
    oneOffs = Array.from({ length: installmentWeeks }, (_, i) => ({
      week: i + 1,
      amount: perInstallment,
      label: `${input.label} (cicilan)`,
    }));
  }

  const withPurchase = simulatePlan(
    { weeks, incomeScenario, oneOffs, goal: input.goal, savePerWeek: input.savePerWeek },
    baseline,
  );

  const weeksDelay =
    input.goal && without.summary.weeksToGoal != null && withPurchase.summary.weeksToGoal != null
      ? withPurchase.summary.weeksToGoal - without.summary.weeksToGoal
      : null;

  return { without, with: withPurchase, weeksDelay, totalCost: round(totalCost) };
}
