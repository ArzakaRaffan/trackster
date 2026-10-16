import { IncomeCadence, IncomeKind, Source } from '@prisma/client';
import { merchantKey } from '../../common/merchant-key';
import { recentRun } from '../subscription/recurring-detect';

// Saran sumber pemasukan dari uang masuk rutin yang belum tertaut sumber (mis. transfer gaji dari PT yang sama tiap tgl 25).
// Mingguan: ≥4 kali berturut-turut berjarak 5–9 hari, terakhir ≤14 hari. Bulanan: ≥3 kali berjarak 25–35 hari, terakhir ≤45 hari.
// Nominal stabil (±10%) → FIXED, selain itu VARIABLE (nominal = median). User yang memutuskan (form terisi), tidak dibuat otomatis.

export type DetectIncome = { description: string; amount: number; receivedAt: Date; source: Source };
export type StreamSuggestion = {
  key: string;
  name: string;
  kind: IncomeKind;
  cadence: IncomeCadence;
  payDayOfWeek: number | null;
  payDayOfMonth: number | null;
  amount: number;
  source: Source;
  keyword: string; // untuk matchKeywords → pemasukan berikutnya tertaut otomatis
  count: number;
  lastDate: string;
};

const DAY = 86_400_000;
const wibKey = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const keyDate = (k: string) => new Date(`${k}T00:00:00Z`);
const mode = (xs: number[]) => {
  const c = new Map<number, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const RULES = [
  { cadence: IncomeCadence.WEEKLY, gapMin: 5, gapMax: 9, minRun: 4, staleDays: 14 },
  { cadence: IncomeCadence.MONTHLY, gapMin: 25, gapMax: 35, minRun: 3, staleDays: 45 },
] as const;

export function detectIncomeStreams(
  incomes: DetectIncome[],
  streams: { name: string; matchKeywords: string[] }[],
  todayKey: string,
): StreamSuggestion[] {
  const groups = new Map<string, DetectIncome[]>();
  for (const i of incomes) {
    const k = merchantKey(i.description);
    if (!k || i.amount <= 0) continue;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const out: StreamSuggestion[] = [];
  for (const [key, list] of groups) {
    const taken = streams.some(
      (s) =>
        merchantKey(s.name) === key ||
        s.matchKeywords.some((kw) => kw.trim() && list[0].description.toUpperCase().includes(kw.trim().toUpperCase())),
    );
    if (taken) continue;

    const byDay = new Map<string, number>();
    for (const i of list) byDay.set(wibKey(i.receivedAt), (byDay.get(wibKey(i.receivedAt)) ?? 0) + i.amount);
    const days = [...byDay.keys()].sort();
    for (const r of RULES) {
      const run = recentRun(days, r.gapMin, r.gapMax);
      if (run < r.minRun) continue;
      const runDays = days.slice(-run);
      const lastDate = runDays[runDays.length - 1];
      if ((keyDate(todayKey).getTime() - keyDate(lastDate).getTime()) / DAY > r.staleDays) continue;
      const amounts = runDays.map((d) => byDay.get(d)!);
      const latest = list.filter((i) => wibKey(i.receivedAt) === lastDate).pop()!;
      out.push({
        key,
        name: latest.description,
        kind: Math.max(...amounts) <= Math.min(...amounts) * 1.1 ? IncomeKind.FIXED : IncomeKind.VARIABLE,
        cadence: r.cadence,
        payDayOfWeek: r.cadence === IncomeCadence.WEEKLY ? mode(runDays.map((d) => keyDate(d).getUTCDay())) : null,
        payDayOfMonth: r.cadence === IncomeCadence.MONTHLY ? mode(runDays.map((d) => keyDate(d).getUTCDate())) : null,
        amount: Math.round(median(amounts)),
        source: latest.source,
        keyword: latest.description.trim(),
        count: run,
        lastDate,
      });
      break; // mingguan diperiksa dulu: kalau cocok, tidak juga dianggap bulanan
    }
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 3);
}
