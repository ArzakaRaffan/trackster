'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRupiah, formatRupiahCompact } from '@/lib/format';

interface SimulationWeek {
  week: string;
  income: number;
  spend: number;
  saved: number;
  balance: number;
  goalProgress?: number;
}

interface SimulationSummary {
  weeksToGoal: number | null;
  finalBalance: number;
  minBalance: number;
  firstShortfallWeek: string | null;
}

export interface SimulationCardData {
  type: 'simulation';
  title: string;
  series: SimulationWeek[];
  compareSeries?: SimulationWeek[];
  summary: SimulationSummary;
  assumptions: string[];
  extra?: { weeksDelay: number | null; totalCost: number };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-standard bg-surface-overlay px-3 py-2 text-small shadow-medium">
      <p className="font-bold text-ink">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="tabular-nums text-ink-muted">
          {p.name}: {formatRupiah(p.value)}
        </p>
      ))}
    </div>
  );
}

export function SimulationCard({ card }: { card: SimulationCardData }) {
  const chartData = card.series.map((w, i) => ({
    week: w.week.replace('Minggu ', 'M'),
    Saldo: w.balance,
    ...(card.compareSeries ? { 'Tanpa beli': card.compareSeries[i]?.balance ?? null } : {}),
  }));

  return (
    <div className="mt-2 rounded-panel bg-surface p-4 shadow-hairline">
      <p className="font-title text-small font-bold text-ink">{card.title}</p>

      <div className="mt-2 -mx-1">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => formatRupiahCompact(v)} tick={{ fontSize: 10 }} width={48} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="Saldo" stroke="#1ed760" strokeWidth={2} dot={false} />
            {card.compareSeries && (
              <Line type="monotone" dataKey="Tanpa beli" stroke="#8a8a8a" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-micro text-ink-muted">Saldo akhir</p>
          <p className="text-small font-bold tabular-nums text-ink">{formatRupiahCompact(card.summary.finalBalance)}</p>
        </div>
        <div>
          <p className="text-micro text-ink-muted">Saldo terendah</p>
          <p className="text-small font-bold tabular-nums text-ink">{formatRupiahCompact(card.summary.minBalance)}</p>
        </div>
        <div>
          <p className="text-micro text-ink-muted">Capai goal</p>
          <p className="text-small font-bold tabular-nums text-ink">
            {card.summary.weeksToGoal != null ? `Minggu ${card.summary.weeksToGoal}` : '—'}
          </p>
        </div>
      </div>

      {card.summary.firstShortfallWeek && (
        <p className="mt-2 text-micro font-bold text-status-over">
          Saldo minus mulai {card.summary.firstShortfallWeek}
        </p>
      )}

      {card.extra && (
        <p className="mt-2 text-micro text-ink-muted">
          Total biaya {formatRupiah(card.extra.totalCost)}
          {card.extra.weeksDelay != null && `, goal mundur ${card.extra.weeksDelay} minggu`}
        </p>
      )}

      <ul className="mt-3 space-y-1 border-t border-line-subtle pt-2">
        {card.assumptions.map((a, i) => (
          <li key={i} className="text-micro leading-relaxed text-ink-subtle">
            · {a}
          </li>
        ))}
      </ul>
    </div>
  );
}
