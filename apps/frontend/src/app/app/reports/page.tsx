'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion } from 'motion/react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatRupiah, formatRupiahCompact, MONTH_NAMES } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_LABELS, TransactionNoteRow, type NoteableTransaction } from '@/components/ui/TransactionNoteRow';
import { Input } from '@/components/ui/Input';
import { StatTile } from '@/components/ui/StatTile';
import { AnimatedTabContent } from '@/components/ui/AnimatedTabContent';
import { TRANSITION_SLOW } from '@/lib/motion';
import { ArrowRight, ChevronLeft, ChevronRight, Inbox, Search, TrendingDown, TrendingUp, X } from 'lucide-react';

/** Debounce a fast-changing value (search input) so we don't fire a request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

type Period = 'week' | 'month';

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

interface PeriodStats {
  range: { start: string; end: string; days: number; dataStartsAt: string | null };
  totals: PeriodTotals;
  previous?: PeriodTotals & { start: string; end: string };
  byCategory: { category: string; total: number; count: number; prevTotal?: number }[];
  byMerchant: { merchantKey: string; displayName: string; total: number; count: number; avgTicket: number; perWeek: number }[];
  byDay: { date: string; spend: number; spendRoutine: number; budget: number; income: number }[];
  budget: { daysWithBudget: number; daysOver: number; adherencePct: number | null; streakUnder: number; worstWeekday: number | null };
  dataQuality: { lainnyaPct: number; pendingIncomeCount: number; unparsedEmailCount: number };
}

interface ReportResponse {
  period: Period;
  start: string;
  end: string;
  closed: boolean;
  stats: PeriodStats;
  narrative: string | null;
  generatedAt: string | null;
}

interface CategoryTotal {
  category: string;
  total: number;
}

interface AllTimeSummary {
  totalSpent: number;
  byCategory: CategoryTotal[];
  highestMonth: { month: string; total: number } | null;
  lowestMonth: { month: string; total: number } | null;
}

interface DayDetail {
  date: string;
  totalSpent: number;
  transactions: NoteableTransaction[];
}

interface TransactionListResponse {
  data: NoteableTransaction[];
  total: number;
  page: number;
  limit: number;
}

const CATEGORY_FILTER_OPTIONS = Object.keys(CATEGORY_LABELS);
const SOURCE_FILTER_OPTIONS = ['ALL', 'BCA', 'JAGO'] as const;

const reportFetcher = (path: string) => api.get<ReportResponse>(path);
const summaryFetcher = (path: string) => api.get<AllTimeSummary>(path);
const dayFetcher = (path: string) => api.get<DayDetail>(path);
const transactionListFetcher = (path: string) => api.get<TransactionListResponse>(path);

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function wibDateKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** `end` eksklusif (dari backend). Label "23–29 Sep 2026" (minggu) atau "September 2026" (bulan). */
function formatPeriodLabel(period: Period, startIso: string, endIso: string): string {
  const start = new Date(new Date(startIso).getTime() + 7 * 3600_000);
  const endInclusive = new Date(new Date(endIso).getTime() + 7 * 3600_000 - 86_400_000);
  if (period === 'month') return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  const sameMonth = start.getUTCMonth() === endInclusive.getUTCMonth();
  const startLabel = sameMonth ? `${start.getUTCDate()}` : `${start.getUTCDate()} ${MONTH_NAMES[start.getUTCMonth()]}`;
  return `${startLabel}–${endInclusive.getUTCDate()} ${MONTH_NAMES[endInclusive.getUTCMonth()]} ${endInclusive.getUTCFullYear()}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-standard bg-surface-overlay px-3 py-2 text-small shadow-medium">
      {label && <p className="font-bold text-ink">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums text-ink-muted">
          {formatRupiah(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-small text-ink-muted">Memuat...</div>}>
      <ReportsPageInner />
    </Suspense>
  );
}

function ReportsPageInner() {
  const searchParams = useSearchParams();
  const initialPeriod = searchParams.get('period') === 'month' ? 'month' : searchParams.get('period') === 'all' ? 'all' : 'week';
  const initialDate = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<Period | 'all'>(initialPeriod as Period | 'all');
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Analisis pengeluaran</p>
        <h1 className="font-title text-title font-bold text-ink">Laporan</h1>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <div className="flex gap-1 rounded-full-pill bg-surface p-1">
          {([
            { key: 'week', label: 'Minggu' },
            { key: 'month', label: 'Bulan' },
            { key: 'all', label: 'Semua transaksi' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                if (t.key !== 'all') setAnchorDate(new Date().toISOString().slice(0, 10));
              }}
              className={`flex-1 rounded-full-pill py-2 text-label font-bold transition-colors duration-base ease-standard ${
                tab === t.key ? 'bg-brand text-base' : 'text-ink-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatedTabContent tabKey={tab}>
          {tab === 'all' ? (
            <AllTimeTab />
          ) : (
            <PeriodReportTab period={tab} anchorDate={anchorDate} onAnchorChange={setAnchorDate} onSelectDay={setSelectedDay} />
          )}
        </AnimatedTabContent>
      </div>

      {selectedDay && <DayDetailSheet date={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}

function PeriodReportTab({
  period,
  anchorDate,
  onAnchorChange,
  onSelectDay,
}: {
  period: Period;
  anchorDate: string;
  onAnchorChange: (date: string) => void;
  onSelectDay: (date: string) => void;
}) {
  const { data, error, isLoading } = useSWR(`/reports?period=${period}&date=${anchorDate}`, reportFetcher);

  if (isLoading || !data) return <ReportSkeleton />;
  if (error) return <p className="text-label text-status-over">Gagal memuat laporan.</p>;

  const { stats, narrative, closed } = data;
  const { totals, previous } = stats;
  const showNet = totals.income > 0 || (previous?.income ?? 0) > 0;
  const isFuture = new Date(data.end).getTime() > Date.now();

  const goPrev = () => onAnchorChange(wibDateKey(new Date(new Date(data.start).getTime() - 86_400_000).toISOString()));
  const goNext = () => onAnchorChange(wibDateKey(data.end));

  const categoryData = stats.byCategory.map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] ?? c.category }));
  const topMerchants = stats.byMerchant.slice(0, 5);

  return (
    <>
      <div className="flex items-center justify-between rounded-comfortable bg-surface p-2">
        <button onClick={goPrev} aria-label="Periode sebelumnya" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:text-ink">
          <ChevronLeft size={18} />
        </button>
        <span className="text-label font-bold text-ink">{formatPeriodLabel(period, data.start, data.end)}</span>
        <button
          onClick={goNext}
          disabled={isFuture}
          aria-label="Periode berikutnya"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:text-ink disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Hero */}
      <section className="rounded-medium bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Net</p>
          {totals.savingsRate != null && <p className="text-small text-ink-muted">Savings rate {totals.savingsRate.toFixed(0)}%</p>}
        </div>
        <p className={`font-title text-amount-hero font-black tabular-nums ${totals.net >= 0 ? 'text-status-under' : 'text-status-over'}`}>
          {totals.net >= 0 ? '+' : ''}
          {formatRupiah(totals.net)}
        </p>
        {showNet && (
          <p className="mt-1 text-small text-ink-muted">
            Masuk {formatRupiahCompact(totals.income)} · Keluar {formatRupiahCompact(totals.spend)}
          </p>
        )}
      </section>

      {narrative ? (
        <section className="rounded-comfortable bg-surface-interactive p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Ringkasan dari Track</p>
          <p className="mt-2 whitespace-pre-line text-small leading-relaxed text-ink">{narrative}</p>
        </section>
      ) : !closed ? (
        <p className="px-1 text-micro text-ink-subtle">Periode masih berjalan — narasi & snapshot muncul setelah periode ini tutup.</p>
      ) : null}

      {previous ? (
        <p className="px-1 text-micro text-ink-muted">
          vs periode sebelumnya: keluar rutin {previous.spendRoutine > 0 ? `${pctChange(totals.spendRoutine, previous.spendRoutine) >= 0 ? '↑' : '↓'}${Math.abs(pctChange(totals.spendRoutine, previous.spendRoutine)).toFixed(0)}%` : '—'}
          {' · '}
          pemasukan {previous.income > 0 ? `${totals.income >= previous.income ? '↑' : '↓'}${formatRupiahCompact(Math.abs(totals.income - previous.income))}` : '—'}
        </p>
      ) : (
        <p className="px-1 text-micro text-ink-subtle">Belum ada data pembanding untuk periode ini</p>
      )}

      {/* Chart harian */}
      <section className="rounded-medium bg-surface p-5">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Tren harian</p>
        <p className="mb-2 text-micro text-ink-subtle">Klik satu batang buat lihat detail transaksi hari itu</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.byDay} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(-2)} tick={{ fill: '#7c7c7c', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === 'month' ? 3 : 0} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
            <Bar dataKey="spend" radius={[3, 3, 0, 0]} fill="#1ed760" cursor="pointer" onClick={(d: any) => onSelectDay(d.date)} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {categoryData.length > 0 && (
        <section className="rounded-comfortable bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Kategori</p>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={TRANSITION_SLOW} className="mt-3 flex flex-col gap-3">
            {categoryData.filter((c) => c.total > 0).map((c) => {
              const max = Math.max(1, ...categoryData.map((x) => Math.max(x.total, x.prevTotal ?? 0)));
              return (
                <div key={c.category}>
                  <div className="flex items-baseline justify-between text-small">
                    <span className="text-ink-muted">{c.label}</span>
                    <span className="tabular-nums font-bold text-ink">{formatRupiah(c.total)}</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="h-2 overflow-hidden rounded-pill bg-track">
                      <div className="h-full rounded-pill transition-[width] duration-slow ease-expressive" style={{ width: `${(c.total / max) * 100}%`, backgroundColor: CATEGORY_COLORS[c.category] ?? '#94a3b8' }} />
                    </div>
                    {c.prevTotal != null && (
                      <div className="h-1.5 overflow-hidden rounded-pill bg-track">
                        <div className="h-full rounded-pill bg-ink-subtle/50" style={{ width: `${(c.prevTotal / max) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </section>
      )}

      {topMerchants.length > 0 && (
        <section className="rounded-comfortable bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Top merchant</p>
          <div className="mt-3 flex flex-col gap-3">
            {topMerchants.map((m) => (
              <div key={m.merchantKey} className="flex items-baseline justify-between gap-3 text-small">
                <p className="min-w-0 truncate font-bold text-ink">{m.displayName}</p>
                <p className="shrink-0 tabular-nums text-ink-muted">{m.count}× · {formatRupiah(m.total)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.budget.daysWithBudget > 0 && (
        <section className="rounded-comfortable bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Kepatuhan budget</p>
          <p className="mt-2 text-small text-ink-muted">
            <b className={stats.budget.daysOver === 0 ? 'text-status-under' : 'text-status-over'}>{stats.budget.daysOver}</b> dari {stats.budget.daysWithBudget} hari berbudget over
          </p>
        </section>
      )}

      <SubscriptionsSection />
    </>
  );
}

function AllTimeTab() {
  const { data, error, isLoading } = useSWR('/transactions/summary?range=all', summaryFetcher);
  const [resultsParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('ALL');
  const [source, setSource] = useState<(typeof SOURCE_FILTER_OPTIONS)[number]>('ALL');
  const search = useDebouncedValue(searchInput, 400);

  const listParams = new URLSearchParams({ limit: '50' });
  if (search) listParams.set('search', search);
  if (category !== 'ALL') listParams.set('category', category);
  if (source !== 'ALL') listParams.set('source', source);

  const {
    data: listData,
    isLoading: listLoading,
    mutate: mutateList,
  } = useSWR(`/transactions?${listParams.toString()}`, transactionListFetcher);

  if (isLoading) return <ReportSkeleton />;
  if (error || !data) return <p className="text-label text-status-over">Gagal memuat laporan.</p>;

  const categoryData = data.byCategory.map((c) => ({
    ...c,
    label: CATEGORY_LABELS[c.category] ?? c.category,
  }));

  return (
    <>
      {/* Search & filter */}
      <section className="flex flex-col gap-2.5 rounded-comfortable bg-surface p-4">
        <Input
          placeholder="Cari transaksi, catatan, atau nama alias..."
          prefix={<Search size={16} />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <span className="relative flex items-center">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none rounded-full-pill bg-surface-interactive py-1.5 pl-3 pr-7 text-small font-bold text-ink outline-none"
            >
              <option value="ALL">Semua kategori</option>
              {CATEGORY_FILTER_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 text-micro text-ink-muted">▾</span>
          </span>
          {SOURCE_FILTER_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`rounded-full-pill px-3 py-1.5 text-small font-bold transition-colors duration-base ease-standard ${
                source === s ? 'bg-brand text-base' : 'bg-surface-interactive text-ink-muted'
              }`}
            >
              {s === 'ALL' ? 'Semua bank' : s === 'JAGO' ? 'Jago' : s}
            </button>
          ))}
        </div>
      </section>

      {(search || category !== 'ALL' || source !== 'ALL') && (
        <section className="rounded-comfortable bg-surface p-2">
          <p className="px-2 pb-1 pt-1 text-small text-ink-muted">
            {listLoading ? 'Mencari...' : `${listData?.total ?? 0} hasil`}
          </p>
          {!listLoading && listData?.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Inbox size={20} className="text-ink-muted" />
              <p className="text-small text-ink-muted">Tidak ada transaksi yang cocok.</p>
            </div>
          ) : (
            <ul ref={resultsParent} className="flex flex-col gap-1">
              {listData?.data.map((t) => (
                <TransactionNoteRow
                  key={t.id}
                  transaction={t}
                  onSaved={(id, note) =>
                    mutateList(
                      (current) =>
                        current && { ...current, data: current.data.map((tx) => (tx.id === id ? { ...tx, note } : tx)) },
                      { revalidate: false },
                    )
                  }
                  onCategorySaved={(id, cat) =>
                    mutateList(
                      (current) =>
                        current && {
                          ...current,
                          data: current.data.map((tx) => (tx.id === id ? { ...tx, category: cat } : tx)),
                        },
                      { revalidate: false },
                    )
                  }
                  onAliasSaved={(id, displayName) =>
                    mutateList(
                      (current) =>
                        current && {
                          ...current,
                          data: current.data.map((tx) => (tx.id === id ? { ...tx, displayDescription: displayName } : tx)),
                        },
                      { revalidate: false },
                    )
                  }
                  onDeleted={() => mutateList()}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-medium bg-surface p-5">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Total sepanjang waktu</p>
        <p className="font-title text-amount-hero font-extrabold tabular-nums text-ink">{formatRupiah(data.totalSpent)}</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Bulan tertinggi"
          value={data.highestMonth ? formatRupiah(data.highestMonth.total) : '—'}
          tone="over"
        />
        <StatTile
          label="Bulan terendah"
          value={data.lowestMonth ? formatRupiah(data.lowestMonth.total) : '—'}
          tone="under"
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5 -mt-2">
        <p className="flex items-center gap-1.5 px-1 text-small text-ink-muted">
          <TrendingUp size={13} /> {data.highestMonth ? formatMonthLabel(data.highestMonth.month) : '-'}
        </p>
        <p className="flex items-center gap-1.5 px-1 text-small text-ink-muted">
          <TrendingDown size={13} /> {data.lowestMonth ? formatMonthLabel(data.lowestMonth.month) : '-'}
        </p>
      </div>

      {categoryData.length > 0 && (
        <section className="rounded-medium bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Per kategori</p>
          <CategoryBarChart data={categoryData} />
        </section>
      )}
    </>
  );
}

const formatMonthLabel = (yyyyMM: string) => {
  const [y, m] = yyyyMM.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

function CategoryBarChart({ data }: { data: (CategoryTotal & { label: string })[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={84}
          tick={{ fill: '#b3b3b3', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((c) => (
            <Cell key={c.category} fill={CATEGORY_COLORS[c.category] ?? '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DayDetailSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, isLoading, mutate } = useSWR(`/transactions/day/${date}`, dayFetcher);
  const [listParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  return (
    <div className="fixed inset-0 z-30 flex animate-fade-in items-end justify-center bg-base/70 backdrop-blur-sm lg:items-center">
      <div className="max-h-[80vh] w-full max-w-content animate-slide-up overflow-y-auto rounded-t-panel bg-surface p-5 shadow-heavy lg:rounded-panel">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Detail transaksi</p>
            <h2 className="font-title text-heading font-bold text-ink">{date}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-interactive text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-standard bg-track" />
            ))}
          </div>
        ) : data.transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-comfortable p-8 text-center shadow-hairline">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Inbox size={22} />
            </span>
            <p className="text-body font-bold text-ink">Belum ada transaksi</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">
              Nggak ada transaksi tercatat di tanggal ini.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-small tabular-nums text-ink-muted">
              {data.transactions.length} transaksi · {formatRupiah(data.totalSpent)}
            </p>
            <ul ref={listParent} className="flex flex-col gap-1">
              {data.transactions.map((t) => (
                <TransactionNoteRow
                  key={t.id}
                  transaction={t}
                  onSaved={(id, note) =>
                    mutate(
                      (current) =>
                        current && {
                          ...current,
                          transactions: current.transactions.map((tx) => (tx.id === id ? { ...tx, note } : tx)),
                        },
                      { revalidate: false },
                    )
                  }
                  onCategorySaved={(id, category) =>
                    mutate(
                      (current) =>
                        current && {
                          ...current,
                          transactions: current.transactions.map((tx) => (tx.id === id ? { ...tx, category } : tx)),
                        },
                      { revalidate: false },
                    )
                  }
                  onAliasSaved={(id, displayName) =>
                    mutate(
                      (current) =>
                        current && {
                          ...current,
                          transactions: current.transactions.map((tx) =>
                            tx.id === id ? { ...tx, displayDescription: displayName } : tx,
                          ),
                        },
                      { revalidate: false },
                    )
                  }
                  onDeleted={() => mutate()}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-40 animate-pulse rounded-medium bg-track" />
      <div className="h-32 animate-pulse rounded-medium bg-track" />
    </div>
  );
}

interface SubscriptionItem {
  id: number;
  name: string;
  amount: number;
  cycle: 'MONTHLY' | 'YEARLY';
  nextDueDate: string;
  isActive: boolean;
}

function SubscriptionsSection() {
  const { data: subs, isLoading } = useSWR<SubscriptionItem[]>('/subscriptions', (url: string) =>
    api.get<SubscriptionItem[]>(url),
  );

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-medium bg-track" />;
  }

  const active = (subs ?? []).filter((s) => s.isActive);

  if (active.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-medium bg-surface p-5 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
          <Inbox size={18} />
        </span>
        <p className="text-small font-bold text-ink">Langganan</p>
        <p className="max-w-[280px] text-micro leading-relaxed text-ink-muted">
          Belum ada langganan aktif. Tambah manual di halaman Langganan; reminder jalan lewat Google Calendar.
        </p>
        <Link href="/app/subscriptions" className="mt-1 text-micro font-bold text-brand">
          Kelola langganan
        </Link>
      </section>
    );
  }

  const totalMonthlyBurn = active.reduce(
    (sum, s) => sum + (s.cycle === 'YEARLY' ? s.amount / 12 : s.amount),
    0,
  );

  return (
    <section className="rounded-medium bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Langganan aktif</p>
          <p className="font-title text-amount font-extrabold tabular-nums text-ink">
            {formatRupiah(Math.round(totalMonthlyBurn))}
            <span className="text-small font-normal text-ink-muted">/bln</span>
          </p>
        </div>
        <Link
          href="/app/subscriptions"
          className="flex items-center gap-1 rounded-full-pill bg-surface-interactive px-3 py-1.5 text-micro font-bold text-ink-muted transition-colors hover:text-ink hover:bg-surface-alt"
        >
          <span>Kelola ({active.length})</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      <ul className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">
        {active.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-3">
            <div className="min-w-0 flex-1 pr-3">
              <p className="font-bold text-ink truncate">{s.name}</p>
              <p className="text-micro text-ink-muted">
                {s.cycle === 'YEARLY' ? 'Tahunan' : 'Bulanan'} · Jatuh tempo{' '}
                {new Date(s.nextDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <p className="font-bold text-ink tabular-nums shrink-0">{formatRupiah(s.amount)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
