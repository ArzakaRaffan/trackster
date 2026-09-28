'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'motion/react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatRupiah, formatRupiahCompact, DAY_NAMES } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/components/ui/TransactionNoteRow';
import { AnimatedTabContent } from '@/components/ui/AnimatedTabContent';
import { TRANSITION_SLOW } from '@/lib/motion';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

type Range = '7d' | '30d' | '90d' | 'all';
type TimeBucket = 'pagi' | 'siang' | 'sore' | 'malam' | 'larut';

interface PeriodTotals {
  spend: number;
  spendRoutine: number;
  spendBig: number;
  txCount: number;
  avgRoutinePerDay: number;
  income: number;
  net: number;
  savingsRate: number | null;
}

interface TxRow {
  id: number;
  amount: number;
  description: string;
  category: string;
  occurredAt: string;
}

interface PeriodStats {
  range: { start: string; end: string; days: number; dataStartsAt: string | null };
  totals: PeriodTotals;
  previous?: PeriodTotals & { start: string; end: string };
  byCategory: { category: string; total: number; count: number; prevTotal?: number }[];
  byMerchant: { merchantKey: string; displayName: string; total: number; count: number; avgTicket: number; perWeek: number }[];
  byDay: { date: string; spend: number; spendRoutine: number; budget: number; income: number }[];
  timeHeatmap: { dayOfWeek: number; bucket: TimeBucket; count: number; total: number }[];
  bigPurchases: TxRow[];
  anomalies: { tx: TxRow; reason: string }[];
  habits: { merchantKey: string; displayName: string; count: number; total: number; perWeek: number; annualized: number }[];
  budget: { daysWithBudget: number; daysOver: number; adherencePct: number | null; streakUnder: number; worstWeekday: number | null };
  dataQuality: { lainnyaPct: number; pendingIncomeCount: number; unparsedEmailCount: number };
}

const SHORT_DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const RANGE_LABEL: Record<Range, string> = { '7d': '7H', '30d': '30H', '90d': '90H', all: 'Semua' };
const BUCKETS: { key: TimeBucket; label: string }[] = [
  { key: 'pagi', label: 'Pagi' },
  { key: 'siang', label: 'Siang' },
  { key: 'sore', label: 'Sore' },
  { key: 'malam', label: 'Malam' },
  { key: 'larut', label: 'Larut' },
];

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-standard bg-surface-overlay px-3 py-2 text-small shadow-medium">
      {label && <p className="font-bold text-ink">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="tabular-nums text-ink-muted">
          {formatRupiah(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const [range, setRange] = useState<Range>('30d');
  const { data, error, isLoading, mutate } = useSWR(`/analytics/stats?range=${range}`, (p: string) => api.get<PeriodStats>(p));

  const markRoutine = async (id: number) => {
    await api.patch(`/transactions/${id}/big`, { isBig: false });
    mutate();
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Pola pengeluaran</p>
        <h1 className="font-title text-title font-bold text-ink">Analisis</h1>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <div className="flex gap-1 rounded-full-pill bg-surface p-1">
          {(['7d', '30d', '90d', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 rounded-full-pill py-2 text-label font-bold transition-colors duration-base ease-standard ${
                range === r ? 'bg-brand text-base' : 'text-ink-muted'
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>

        {data?.previous ? (
          <p className="px-1 text-micro text-ink-muted">vs {data.range.days} hari sebelumnya</p>
        ) : (
          <p className="px-1 text-micro text-ink-subtle">Belum ada data pembanding untuk periode ini</p>
        )}

        {isLoading ? (
          <InsightsSkeleton />
        ) : error || !data ? (
          <p className="text-label text-status-over">Gagal memuat analisis.</p>
        ) : (
          <AnimatedTabContent tabKey={range}>
            <InsightCardSection range={range} />
            <KpiGrid stats={data} />
            <HabitsCard habits={data.habits} />
            <CategoryCard categories={data.byCategory} />
            <TimeHeatmapCard heatmap={data.timeHeatmap} />
            {(range === '90d' || range === 'all') && <TrendCard byDay={data.byDay} />}
            <BigPurchasesCard items={data.bigPurchases} onMarkRoutine={markRoutine} />
            <AnomaliesCard items={data.anomalies} />
            <BudgetCard budget={data.budget} />
            <DataQualityFooter dq={data.dataQuality} />
            <HealthScoreCard />
          </AnimatedTabContent>
        )}
      </div>
    </div>
  );
}

function InsightCardSection({ range }: { range: Range }) {
  const { data, isLoading } = useSWR(`/ai/insight-card?range=${range}`, (p: string) => api.get<{ points: string[] }>(p));
  if (isLoading) return <div className="h-24 animate-pulse rounded-comfortable bg-track" />;
  if (!data || data.points.length === 0) return null;
  return (
    <section className="rounded-comfortable bg-surface-interactive p-5">
      <h2 className="text-small font-bold uppercase tracking-caps text-ink-muted">3 hal yang perlu kamu tahu</h2>
      <ul className="mt-2.5 flex flex-col gap-2">
        {data.points.map((p, i) => (
          <li key={i} className="flex gap-2 text-small leading-relaxed text-ink">
            <span className="text-brand">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KpiTile({ label, value, delta, invert }: { label: string; value: string; delta?: number | null; invert?: boolean }) {
  let deltaEl = null;
  if (delta != null) {
    const up = delta > 0;
    const flat = delta === 0;
    const good = invert ? up : !up;
    const tone = flat ? 'text-ink-muted' : good ? 'text-status-under' : 'text-status-over';
    const Icon = up ? TrendingUp : TrendingDown;
    deltaEl = (
      <div className={`mt-1 flex items-center gap-1 text-micro font-bold ${tone}`}>
        {!flat && <Icon size={12} />}
        <span>{flat ? '0%' : `${up ? '+' : ''}${delta.toFixed(0)}%`}</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-comfortable bg-surface p-3.5">
      <span className="truncate text-small font-bold uppercase tracking-caps text-ink-muted">{label}</span>
      <span className="font-title text-heading font-bold leading-tight tabular-nums text-ink">{value}</span>
      {deltaEl}
    </div>
  );
}

function KpiGrid({ stats }: { stats: PeriodStats }) {
  const { totals, previous } = stats;
  const showNet = totals.income > 0 || (previous?.income ?? 0) > 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <KpiTile
        label="Keluar rutin"
        value={formatRupiahCompact(totals.spendRoutine)}
        delta={previous ? pctChange(totals.spendRoutine, previous.spendRoutine) : null}
      />
      <KpiTile
        label="Pembelian besar"
        value={formatRupiahCompact(totals.spendBig)}
        delta={previous ? pctChange(totals.spendBig, previous.spendBig) : null}
      />
      <KpiTile
        label="Rata-rata rutin/hari"
        value={formatRupiahCompact(totals.avgRoutinePerDay)}
        delta={previous ? pctChange(totals.avgRoutinePerDay, previous.avgRoutinePerDay) : null}
      />
      {showNet && (
        <KpiTile
          label="Net"
          value={formatRupiahCompact(totals.net)}
          delta={previous ? pctChange(totals.net, previous.net) : null}
          invert
        />
      )}
    </div>
  );
}

function HabitsCard({ habits }: { habits: PeriodStats['habits'] }) {
  const top = habits.slice(0, 5);
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Kebiasaan</h2>
      {top.length === 0 ? (
        <p className="mt-2 text-small text-ink-muted">Belum ada kebiasaan rutin terdeteksi di periode ini.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {top.map((h) => (
            <div key={h.merchantKey} className="flex items-baseline justify-between gap-3 text-small">
              <p className="min-w-0 truncate font-bold text-ink">{h.displayName}</p>
              <p className="shrink-0 tabular-nums text-ink-muted">
                {h.count}× · {formatRupiahCompact(h.total)} · ≈ {formatRupiahCompact(h.annualized)}/thn
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryCard({ categories }: { categories: PeriodStats['byCategory'] }) {
  const top = categories.filter((c) => c.total > 0).slice(0, 8);
  const max = Math.max(1, ...top.map((c) => Math.max(c.total, c.prevTotal ?? 0)));
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Kategori</h2>
      {top.length === 0 ? (
        <p className="mt-2 text-small text-ink-muted">Belum ada data di rentang ini.</p>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION_SLOW}
          className="mt-3 flex flex-col gap-3"
        >
          {top.map((c) => (
            <div key={c.category}>
              <div className="flex items-baseline justify-between text-small">
                <span className="text-ink-muted">{CATEGORY_LABELS[c.category] ?? c.category}</span>
                <span className="tabular-nums font-bold text-ink">{formatRupiah(c.total)}</span>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                <div className="h-2 overflow-hidden rounded-pill bg-track">
                  <div
                    className="h-full rounded-pill transition-[width] duration-slow ease-expressive"
                    style={{ width: `${(c.total / max) * 100}%`, backgroundColor: CATEGORY_COLORS[c.category] ?? '#94a3b8' }}
                  />
                </div>
                {c.prevTotal != null && (
                  <div className="h-1.5 overflow-hidden rounded-pill bg-track">
                    <div className="h-full rounded-pill bg-ink-subtle/50" style={{ width: `${(c.prevTotal / max) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </section>
  );
}

function TimeHeatmapCard({ heatmap }: { heatmap: PeriodStats['timeHeatmap'] }) {
  const map = new Map(heatmap.map((d) => [`${d.dayOfWeek}-${d.bucket}`, d]));
  const max = Math.max(1, ...heatmap.map((d) => d.total));
  let worst: (typeof heatmap)[number] | null = null;
  for (const d of heatmap) if (!worst || d.total > worst.total) worst = d;

  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Pola waktu</h2>
      <div className="mt-3 grid grid-cols-[36px_repeat(7,1fr)] items-center gap-1">
        <div />
        {SHORT_DAY.map((d) => (
          <div key={d} className="text-center text-micro text-ink-muted">
            {d}
          </div>
        ))}
        {BUCKETS.flatMap((b) => [
          <div key={`label-${b.key}`} className="text-micro text-ink-muted">
            {b.label}
          </div>,
          ...SHORT_DAY.map((_, dow) => {
            const total = map.get(`${dow}-${b.key}`)?.total ?? 0;
            return (
              <div
                key={`${b.key}-${dow}`}
                title={formatRupiahCompact(total)}
                className={`aspect-square rounded-subtle ${total > 0 ? '' : 'bg-track'}`}
                style={total > 0 ? { backgroundColor: `rgba(30,215,96,${0.15 + 0.7 * (total / max)})` } : undefined}
              />
            );
          }),
        ])}
      </div>
      {worst && worst.total > 0 && (
        <p className="mt-3 text-small text-ink-muted">
          Paling boros: {DAY_NAMES[worst.dayOfWeek]} {BUCKETS.find((b) => b.key === worst!.bucket)?.label.toLowerCase()}
        </p>
      )}
    </section>
  );
}

function TrendCard({ byDay }: { byDay: PeriodStats['byDay'] }) {
  const weeks: { label: string; routine: number; big: number }[] = [];
  for (let i = 0; i < byDay.length; i += 7) {
    const chunk = byDay.slice(i, i + 7);
    const routine = chunk.reduce((s, d) => s + d.spendRoutine, 0);
    const big = chunk.reduce((s, d) => s + (d.spend - d.spendRoutine), 0);
    weeks.push({ label: chunk[0]?.date.slice(5) ?? '', routine, big });
  }
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Tren mingguan</h2>
      <p className="mt-1 text-small text-ink-muted">Rutin (hijau) vs pembelian besar (merah), per minggu</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={weeks} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#7c7c7c', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
          <Bar dataKey="routine" stackId="s" fill="#1ed760" />
          <Bar dataKey="big" stackId="s" fill="#f3727f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function BigPurchasesCard({ items, onMarkRoutine }: { items: TxRow[]; onMarkRoutine: (id: number) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Pembelian besar</h2>
      <div className="mt-3 flex flex-col gap-3">
        {items.slice(0, 8).map((tx) => (
          <div key={tx.id} className="flex items-center justify-between gap-3 text-small">
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{tx.description}</p>
              <p className="text-micro text-ink-muted">
                {new Date(tx.occurredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ·{' '}
                {CATEGORY_LABELS[tx.category] ?? tx.category}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums font-bold text-ink">{formatRupiah(tx.amount)}</span>
              <button
                onClick={() => onMarkRoutine(tx.id)}
                className="whitespace-nowrap rounded-full-pill bg-surface-interactive px-2.5 py-1 text-micro font-bold text-ink-muted transition-colors duration-base ease-standard hover:bg-surface-alt"
              >
                Tandai rutin
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnomaliesCard({ items }: { items: PeriodStats['anomalies'] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Tidak biasa</h2>
      <div className="mt-3 flex flex-col gap-3">
        {items.slice(0, 8).map(({ tx, reason }) => (
          <div key={tx.id} className="flex items-center justify-between gap-3 text-small">
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{tx.description}</p>
              <p className="text-micro text-ink-muted">{reason}</p>
            </div>
            <span className="shrink-0 tabular-nums font-bold text-ink">{formatRupiah(tx.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BudgetCard({ budget }: { budget: PeriodStats['budget'] }) {
  const overRatio = budget.daysWithBudget > 0 ? budget.daysOver / budget.daysWithBudget : 0;
  const good = overRatio < 0.3;
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="flex items-center gap-2 text-heading font-semibold text-ink">
        <AlertTriangle size={18} className={good ? 'text-status-under' : 'text-status-over'} /> Kepatuhan budget
      </h2>
      {budget.daysWithBudget === 0 ? (
        <p className="mt-2 text-small text-ink-muted">Belum ada hari berbudget di periode ini.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between">
            <p className={`font-title text-amount font-extrabold tabular-nums ${good ? 'text-status-under' : 'text-status-over'}`}>
              {budget.daysOver}
            </p>
            <p className="pb-1 text-small text-ink-muted">
              dari {budget.daysWithBudget} hari berbudget over ({(overRatio * 100).toFixed(0)}%)
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-pill bg-track">
            <div
              className={`h-full rounded-pill transition-[width] duration-slow ease-expressive ${good ? 'bg-status-under' : 'bg-status-over'}`}
              style={{ width: `${overRatio * 100}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-small text-ink-muted">
            <span>
              Streak di bawah budget: <b className="text-ink">{budget.streakUnder}</b> hari
            </span>
            {budget.worstWeekday != null && (
              <span>
                Terburuk: <b className="text-ink">{DAY_NAMES[budget.worstWeekday]}</b>
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function DataQualityFooter({ dq }: { dq: PeriodStats['dataQuality'] }) {
  const issues: string[] = [];
  if (dq.lainnyaPct >= 10) issues.push(`${dq.lainnyaPct.toFixed(0)}% masih "Lainnya" — rapikan kategori`);
  if (dq.pendingIncomeCount > 0) issues.push(`${dq.pendingIncomeCount} pemasukan belum dikonfirmasi`);
  if (dq.unparsedEmailCount > 0) issues.push(`${dq.unparsedEmailCount} email gagal dibaca`);
  if (issues.length === 0) return null;
  return <p className="px-1 text-micro text-ink-subtle">{issues.join(' · ')}</p>;
}

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-comfortable bg-track" />
      ))}
    </div>
  );
}

interface HealthScoreItem {
  id: number;
  weekStart: string;
  score: number;
  budgetAdherencePct: number;
  savingsRatePct: number;
  aiCommentary: string | null;
  createdAt: string;
}

function HealthScoreCard() {
  const { data: history, isLoading } = useSWR<HealthScoreItem[]>('/ai/health-score/history', api.get);

  if (isLoading || !history || history.length === 0) return null;

  const latest = history[0];
  const score = latest.score;
  const tone = score >= 80 ? 'text-status-under' : score >= 60 ? 'text-status-near' : 'text-status-over';
  const badgeBg =
    score >= 80 ? 'bg-status-under-bg text-status-under' : score >= 60 ? 'bg-status-near-bg text-status-near' : 'bg-status-over-bg text-status-over';

  return (
    <section className="rounded-medium bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Financial Health Score</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-title text-amount-hero font-black tabular-nums ${tone}`}>{score}</span>
            <span className="text-small text-ink-muted">/ 100</span>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-micro font-bold ${badgeBg}`}>
          {score >= 80 ? 'Sangat Sehat' : score >= 60 ? 'Cukup Baik' : 'Perlu Perhatian'}
        </span>
      </div>

      {latest.aiCommentary && (
        <p className="mt-3 text-small text-ink-secondary italic leading-relaxed bg-surface-interactive p-3.5 rounded-comfortable">
          &ldquo;{latest.aiCommentary}&rdquo;
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-line-subtle text-small">
        <div>
          <p className="text-micro text-ink-muted">Disiplin Budget</p>
          <p className="font-bold text-ink">{Number(latest.budgetAdherencePct).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-micro text-ink-muted">Tingkat Tabungan</p>
          <p className="font-bold text-ink">{Number(latest.savingsRatePct).toFixed(0)}%</p>
        </div>
      </div>
    </section>
  );
}
