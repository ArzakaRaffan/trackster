// savings-math.ts — pure functions for the Savings Planner v2 (E08-S2).
// Zero imports on purpose: this file is compiled & tested by the backend's ts-node
// (see savings-math.check.ts), so it must stay dependency-free and tsconfig-agnostic.

export type Frequency = 'weekly' | 'monthly';

export const PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  monthly: 12,
};

export interface ProjectionPoint {
  period: number; // 0 = sekarang
  balance: number; // nilai total (setoran + hasil investasi)
  deposits: number; // total uang yang disetor (existing + deposit*period)
  returns: number; // balance - deposits
}

/** Bunga per periode dari return tahunan efektif: (1 + r)^(1/ppy) - 1. */
export function periodicRate(annualPct: number, frequency: Frequency): number {
  return Math.pow(1 + annualPct / 100, 1 / PERIODS_PER_YEAR[frequency]) - 1;
}

/** Inflasi harga target: nominal hari ini → nominal saat target tercapai. */
export function inflate(nominal: number, annualPct: number, years: number): number {
  return nominal * Math.pow(1 + annualPct / 100, Math.max(years, 0));
}

/** Nilai akhir setelah n periode: setoran tiap akhir periode + saldo awal ikut compounding. */
export function futureValue(existing: number, depositPerPeriod: number, rate: number, periods: number): number {
  const n = Math.max(periods, 0);
  if (rate === 0) return existing + depositPerPeriod * n;
  return existing * Math.pow(1 + rate, n) + depositPerPeriod * ((Math.pow(1 + rate, n) - 1) / rate);
}

/** Mode A ("harus nabung berapa?"): setoran per periode agar tercapai tepat n periode. */
export function requiredDeposit(target: number, existing: number, rate: number, periods: number): number {
  const n = Math.max(periods, 0);
  if (n === 0) return Math.max(target - existing, 0);
  const existingFV = existing * Math.pow(1 + rate, n);
  const remaining = Math.max(target - existingFV, 0);
  if (rate === 0) return remaining / n;
  return (remaining * rate) / (Math.pow(1 + rate, n) - 1);
}

/** Mode B ("kapan tercapai?") tanpa inflasi. Infinity = tidak akan pernah tercapai. */
export function periodsToReach(target: number, existing: number, depositPerPeriod: number, rate: number): number {
  if (existing >= target) return 0;
  if (depositPerPeriod <= 0) return Infinity;
  if (rate === 0) return (target - existing) / depositPerPeriod;
  const num = Math.log((target * rate + depositPerPeriod) / (existing * rate + depositPerPeriod));
  const den = Math.log(1 + rate);
  return num / den;
}

/**
 * Mode B dengan inflasi: target terus naik sambil nabung. Iteratif karena solusi
 * analitiknya rumit (target tumbuh eksponensial tiap periode). maxPeriods = 1200
 * (100 tahun bulanan / ~23 tahun mingguan) — beyond itu dianggap "tidak tercapai".
 * ponytail: naive loop 1..maxPeriods; kalau mau akurasi submilidetik, ganti Newton-Raphson.
 */
export function periodsToReachWithInflation(
  target: number,
  existing: number,
  depositPerPeriod: number,
  rate: number,
  annualInflationPct: number,
  frequency: Frequency,
  maxPeriods = 1200,
): number {
  if (existing >= target) return 0;
  if (depositPerPeriod <= 0) return Infinity;
  const ppy = PERIODS_PER_YEAR[frequency];
  for (let p = 1; p <= maxPeriods; p++) {
    if (futureValue(existing, depositPerPeriod, rate, p) >= inflate(target, annualInflationPct, p / ppy)) return p;
  }
  return Infinity;
}

/** Seri proyeksi 0..n periode untuk grafik. */
export function projection(
  existing: number,
  depositPerPeriod: number,
  rate: number,
  periods: number,
): ProjectionPoint[] {
  const n = Math.max(Math.ceil(periods), 0);
  const points: ProjectionPoint[] = [];
  for (let p = 0; p <= n; p++) {
    const balance = futureValue(existing, depositPerPeriod, rate, p);
    const deposits = existing + depositPerPeriod * p;
    points.push({ period: p, balance, deposits, returns: balance - deposits });
  }
  return points;
}

/** Downsample seri panjang buat grafik (max ~120 titik). */
export function samplePoints(points: ProjectionPoint[], maxPoints = 120): ProjectionPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

/** Titik milestone 25/50/75/100% target → periode ke berapa. Infinity kalau nggak tercapai. */
export function milestones(
  target: number,
  existing: number,
  depositPerPeriod: number,
  rate: number,
): { pct: number; period: number }[] {
  return [25, 50, 75, 100].map((pct) => ({
    pct,
    period: Math.ceil(periodsToReach((target * pct) / 100, existing, depositPerPeriod, rate)),
  }));
}

/** Milestone dengan target yang ikut naik karena inflasi (untuk mode "kapan tercapai"). */
export function milestonesWithInflation(
  target: number,
  existing: number,
  depositPerPeriod: number,
  rate: number,
  annualInflationPct: number,
  frequency: Frequency,
): { pct: number; period: number }[] {
  return [25, 50, 75, 100].map((pct) => ({
    pct,
    period: Math.ceil(
      periodsToReachWithInflation((target * pct) / 100, existing, depositPerPeriod, rate, annualInflationPct, frequency),
    ),
  }));
}
