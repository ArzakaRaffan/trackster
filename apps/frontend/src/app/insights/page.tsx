'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/components/ui/TransactionNoteRow';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

interface TrendData {
  thisWeekTotal: number;
  lastWeekTotal: number;
  percentageChange: number;
}
interface MerchantData {
  description: string;
  totalAmount: number;
  transactionCount: number;
}
interface CategoryInsight {
  category: string;
  totalAmount: number;
  percentage: number;
}
interface DayOfWeekInsight {
  dayOfWeek: number;
  averageAmount: number;
}
interface BudgetAdherence {
  totalDays: number;
  daysOverBudget: number;
  percentageOverBudget: number;
}
interface Insights {
  range: string;
  trend: TrendData;
  topMerchants: MerchantData[];
  categoryBreakdown: CategoryInsight[];
  spendByDayOfWeek: DayOfWeekInsight[];
  budgetAdherence: BudgetAdherence;
}

const SHORT_DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const fetcher = (path: string) => api.get<Insights>(path);

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
  const [range, setRange] = useState<'30d' | 'all'>('30d');
  const { data, error, isLoading } = useSWR(`/transactions/insights?range=${range}`, fetcher);

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Pola pengeluaran</p>
        <h1 className="font-title text-title font-bold text-ink">Analisis</h1>
      </header>

      <div className="flex flex-col gap-4 px-4">
        <div className="flex gap-1 rounded-full-pill bg-surface p-1">
          {(['30d', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 rounded-full-pill py-2 text-label font-bold transition-colors duration-base ease-standard ${
                range === r ? 'bg-brand text-base' : 'text-ink-muted'
              }`}
            >
              {r === '30d' ? '30 Hari' : 'All Time'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <InsightsSkeleton />
        ) : error || !data ? (
          <p className="text-label text-status-over">Gagal memuat analisis.</p>
        ) : (
          <>
            <TrendCard trend={data.trend} />
            <BudgetAdherenceCard adherence={data.budgetAdherence} />
            <CategoryCard categories={data.categoryBreakdown} />
            <DayOfWeekCard days={data.spendByDayOfWeek} />
            <TopMerchantsCard merchants={data.topMerchants} />
          </>
        )}
      </div>
    </div>
  );
}

function TrendCard({ trend }: { trend: TrendData }) {
  const up = trend.percentageChange > 0;
  const flat = trend.percentageChange === 0;
  const tone = flat ? 'text-ink-muted' : up ? 'text-status-over' : 'text-status-under';
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <section className="rounded-medium bg-surface p-5">
      <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Tren minggu ini</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`font-title text-amount font-extrabold tabular-nums ${tone}`}>
          {flat ? '0%' : `${up ? '+' : ''}${trend.percentageChange.toFixed(0)}%`}
        </p>
        {!flat && <Icon size={22} className={tone} />}
      </div>
      <p className="mt-1 text-small text-ink-muted">
        {formatRupiah(trend.thisWeekTotal)} minggu ini vs {formatRupiah(trend.lastWeekTotal)} minggu lalu
      </p>
    </section>
  );
}

function BudgetAdherenceCard({ adherence }: { adherence: BudgetAdherence }) {
  const good = adherence.percentageOverBudget < 30;
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="flex items-center gap-2 text-heading font-semibold text-ink">
        <AlertTriangle size={18} className={good ? 'text-status-under' : 'text-status-over'} /> Kepatuhan budget
      </h2>
      <div className="mt-3 flex items-end justify-between">
        <p className={`font-title text-amount font-extrabold tabular-nums ${good ? 'text-status-under' : 'text-status-over'}`}>
          {adherence.daysOverBudget}
        </p>
        <p className="pb-1 text-small text-ink-muted">
          dari {adherence.totalDays} hari over budget ({adherence.percentageOverBudget.toFixed(0)}%)
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-pill bg-track">
        <div
          className={`h-full rounded-pill transition-[width] duration-slow ease-expressive ${good ? 'bg-status-under' : 'bg-status-over'}`}
          style={{ width: `${adherence.percentageOverBudget}%` }}
        />
      </div>
    </section>
  );
}

function CategoryCard({ categories }: { categories: CategoryInsight[] }) {
  const withSpend = categories.filter((c) => c.totalAmount > 0);
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Breakdown kategori</h2>
      {withSpend.length === 0 ? (
        <p className="mt-2 text-small text-ink-muted">Belum ada data di rentang ini.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={withSpend}
                dataKey="totalAmount"
                nameKey="category"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                strokeWidth={0}
              >
                {withSpend.map((c) => (
                  <Cell key={c.category} fill={CATEGORY_COLORS[c.category] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-col gap-2">
            {categories
              .slice()
              .sort((a, b) => b.totalAmount - a.totalAmount)
              .map((c) => (
                <div key={c.category} className="flex items-center gap-2.5 text-small">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[c.category] ?? '#94a3b8' }}
                  />
                  <span className="flex-1 text-ink-muted">{CATEGORY_LABELS[c.category] ?? c.category}</span>
                  <span className="tabular-nums text-ink-muted">{c.percentage.toFixed(0)}%</span>
                  <span className="w-24 shrink-0 text-right font-bold tabular-nums text-ink">
                    {formatRupiah(c.totalAmount)}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}

function DayOfWeekCard({ days }: { days: DayOfWeekInsight[] }) {
  const chartData = days.map((d) => ({ ...d, label: SHORT_DAY[d.dayOfWeek] }));
  const maxAmount = Math.max(0, ...days.map((d) => d.averageAmount));

  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Pola per hari</h2>
      <p className="mt-1 text-small text-ink-muted">Rata-rata pengeluaran tiap hari-dalam-minggu</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#7c7c7c', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
          <Bar dataKey="averageAmount" radius={[4, 4, 0, 0]}>
            {chartData.map((d) => (
              <Cell key={d.dayOfWeek} fill={d.averageAmount === maxAmount && maxAmount > 0 ? '#1ed760' : '#4d4d4d'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function TopMerchantsCard({ merchants }: { merchants: MerchantData[] }) {
  const maxAmount = Math.max(1, ...merchants.map((m) => m.totalAmount));
  return (
    <section className="rounded-comfortable bg-surface p-5">
      <h2 className="text-heading font-semibold text-ink">Top 5 merchant</h2>
      {merchants.length === 0 ? (
        <p className="mt-2 text-small text-ink-muted">Belum ada data di rentang ini.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {merchants.map((m, i) => (
            <div key={m.description + i}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-label font-bold text-ink">{m.description}</p>
                <p className="shrink-0 text-small tabular-nums text-ink-muted">{formatRupiah(m.totalAmount)}</p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-track">
                  <div
                    className="h-full rounded-pill bg-brand transition-[width] duration-slow ease-expressive"
                    style={{ width: `${(m.totalAmount / maxAmount) * 100}%` }}
                  />
                </div>
                <span className="shrink-0 text-micro text-ink-subtle">{m.transactionCount}x</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-comfortable bg-track" />
      ))}
    </div>
  );
}
