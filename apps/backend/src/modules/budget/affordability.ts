// "Bisa beli ini?" — jawaban deterministik sebelum belanja (Telegram /bisa). Murni, tanpa DB.

export type AffordSummary = {
  budget: number; // jatah hari ini
  remaining: number; // sisa jatah hari ini (belanja rutin)
  totalSpent: number; // semua belanja hari ini
  cycle: { mode: string; remaining: number; daysLeft: number } | null; // mode dinamis
};

export type Affordability =
  | { verdict: 'TODAY'; leftToday: number } // masih masuk jatah hari ini
  | { verdict: 'SPREAD'; perDayBefore: number; perDayAfter: number; days: number } // dinamis: jatah hari berikutnya turun
  | { verdict: 'OVER_TODAY'; overBy: number } // FIXED: lewat jatah hari ini
  | { verdict: 'SHORT'; shortBy: number; days: number }; // dinamis: uang siklus/saldo tidak cukup

const round500 = (n: number) => Math.round(n / 500) * 500;

export function affordability(s: AffordSummary, amount: number): Affordability {
  if (amount <= s.remaining) return { verdict: 'TODAY', leftToday: s.remaining - amount };
  if (!s.cycle) return { verdict: 'OVER_TODAY', overBy: amount - Math.max(0, s.remaining) };
  // Dinamis: sisa uang siklus setelah belanja hari ini, dibagi ke hari-hari setelah hari ini.
  const left = s.cycle.remaining - s.totalSpent;
  const days = Math.max(1, s.cycle.daysLeft - 1);
  if (amount > left) return { verdict: 'SHORT', shortBy: amount - Math.max(0, left), days };
  return { verdict: 'SPREAD', perDayBefore: round500(left / days), perDayAfter: round500((left - amount) / days), days };
}
