/** Budget advisor engine - pure functions, deterministic, testable without DB.
 * E05-S1: saran budget 3 opsi berbasis forecast pemasukan + histori pengeluaran rutin. */

export type BudgetOption = 'hemat' | 'seimbang' | 'longgar';

export interface DailyWeight {
  dayOfWeek: number; // 0=Minggu..6=Sabtu
  weight: number;    // ternormalisasi: sum = 1.0
}

export interface BudgetOptionResult {
  option: BudgetOption;
  totalWeekly: number;
  dailyAmounts: number[];  // index 0=Minggu..6=Sabtu
  weeklySavings: number;
  realismFlag: string | null; // null = oke; string = pesan peringatan
}

export interface BudgetSuggestionInput {
  /** Forecast pemasukan minggu ini (E03). */
  expectedIncome: number;
  conservativeIncome: number;
  /** Komitmen mingguan: kontribusi goal + langganan jatuh tempo minggu ini. */
  commitments: number;
  /** Median pengeluaran rutin per hari-dalam-minggu dari 8 minggu terakhir.
   * Jika kurang dari 8 minggu data, pakai yang ada. Index 0=Min..6=Sab. */
  medianRoutineByDow: number[];
  /** Rata-rata pengeluaran rutin harian (8 minggu) — untuk realism check. */
  avgRoutinePerDay: number;
}

export interface BudgetSuggestion {
  input: BudgetSuggestionInput;
  options: BudgetOptionResult[];
  weekStart: string; // 'YYYY-MM-DD'
}

/** Bulatkan ke kelipatan 500 terdekat. */
export function round500(n: number): number {
  return Math.round(n / 500) * 500;
}

/** Hitung bobot per hari dari median rutin 8 minggu.
 * Min bobot 40% dari rata-rata (supaya weekend tidak 0). */
export function computeDailyWeights(medianRoutineByDow: number[]): number[] {
  const avg = medianRoutineByDow.reduce((s, v) => s + v, 0) / 7;
  const minWeight = avg * 0.4;
  const adjusted = medianRoutineByDow.map(v => Math.max(v, minWeight));
  const total = adjusted.reduce((s, v) => s + v, 0);
  // ternormalisasi: sum = 1.0
  return adjusted.map(v => total > 0 ? v / total : 1 / 7);
}

/** Hitung satu opsi budget. */
export function computeOption(
  option: BudgetOption,
  input: BudgetSuggestionInput,
): BudgetOptionResult {
  const { expectedIncome, conservativeIncome, commitments, medianRoutineByDow, avgRoutinePerDay } = input;
  
  // Pemasukan yang dipakai & target tabungan per opsi
  const incomeUsed = option === 'hemat' ? conservativeIncome : expectedIncome;
  const reservePct = option === 'hemat' ? 0.15 : option === 'seimbang' ? 0.10 : 0.05;
  const goalContribPct = option === 'longgar' ? 0.5 : 1.0; // longgar: 50% goal contribution
  
  const effectiveCommitments = commitments * goalContribPct;
  const reserve = incomeUsed * reservePct;
  const spendable = Math.max(0, incomeUsed - effectiveCommitments - reserve);
  const weeklySavings = incomeUsed - spendable;
  
  const weights = computeDailyWeights(medianRoutineByDow);
  const dailyAmounts = weights.map(w => round500(spendable * w));
  
  // Adjust rounding error: total harus = spendable (approx, karena round500)
  const totalDaily = dailyAmounts.reduce((s, v) => s + v, 0);
  const totalWeekly = totalDaily; // total harian yang ke user
  
  // Realism check: kalau median rutin 8 minggu > opsi * 1.5 -> flag
  const medianRoutineWeekly = avgRoutinePerDay * 7;
  const realismFlag = medianRoutineWeekly > totalWeekly * 1.5
    ? `Budget ini jauh di bawah kebiasaanmu (rata-rata Rp ${Math.round(avgRoutinePerDay).toLocaleString('id-ID')}/hari — total ${Math.round(medianRoutineWeekly).toLocaleString('id-ID')}/minggu). Kemungkinan jebol.`
    : null;
  
  return { option, totalWeekly, dailyAmounts, weeklySavings, realismFlag };
}

/** Hitung semua 3 opsi. */
export function computeBudgetSuggestions(
  input: BudgetSuggestionInput,
  weekStart: string,
): BudgetSuggestion {
  return {
    input,
    weekStart,
    options: (['hemat', 'seimbang', 'longgar'] as BudgetOption[]).map(opt => computeOption(opt, input)),
  };
}
