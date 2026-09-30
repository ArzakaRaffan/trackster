'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { AnimatePresence, motion } from 'motion/react';
import { toPng } from 'html-to-image';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { formatRupiah, formatRupiahCompact, MONTH_NAMES } from '@/lib/format';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  TransactionNoteRow,
  type NoteableTransaction,
} from '@/components/ui/TransactionNoteRow';
import { Input } from '@/components/ui/Input';
import { StatTile } from '@/components/ui/StatTile';
import { AnimatedTabContent } from '@/components/ui/AnimatedTabContent';
import { EASE_ENTER, TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Search,
  Share2,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

type Period = 'week' | 'month' | '6m' | 'all';

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
  period: 'week' | 'month';
  start: string;
  end: string;
  closed: boolean;
  stats: PeriodStats;
  narrative: string | null;
  generatedAt: string | null;
}

interface MonthAggregate {
  month: string; // 'YYYY-MM'
  spend: number;
  spendRoutine: number;
  income: number;
  net: number;
  savingsRate: number | null;
  txCount: number;
  isLive: boolean;
  narrative: string | null;
}

interface AggregateReport {
  period: '6m' | 'all';
  months: MonthAggregate[];
  totals: { spend: number; income: number; net: number; avgMonthlySpend: number; avgMonthlyIncome: number };
  dataStartsAt: string | null;
  bestMonth: MonthAggregate | null;
  worstMonth: MonthAggregate | null;
}

interface RecordsResult {
  biggestTransaction: { id: number; amount: number; description: string; date: string; category: string } | null;
  mostVisitedMerchant: { merchantKey: string; displayName: string; count: number; total: number } | null;
  bestSavingsRateMonth: { month: string; savingsRate: number } | null;
  longestUnderBudgetStreak: number;
  totalTransactions: number;
  totalSpend: number;
  dataStartsAt: string | null;
}

interface CategoryTotal {
  category: string;
  total: number;
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

// ─── Fetchers ────────────────────────────────────────────────────────────────

const CATEGORY_FILTER_OPTIONS = Object.keys(CATEGORY_LABELS);
const SOURCE_FILTER_OPTIONS = ['ALL', 'BCA', 'JAGO'] as const;

const reportFetcher = (path: string) => api.get<ReportResponse>(path);
const aggregateFetcher = (path: string) => api.get<AggregateReport>(path);
const recordsFetcher = (path: string) => api.get<RecordsResult>(path);
const dayFetcher = (path: string) => api.get<DayDetail>(path);
const transactionListFetcher = (path: string) => api.get<TransactionListResponse>(path);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function wibDateKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

function formatPeriodLabel(period: 'week' | 'month', startIso: string, endIso: string): string {
  const start = new Date(new Date(startIso).getTime() + 7 * 3600_000);
  const endInclusive = new Date(new Date(endIso).getTime() + 7 * 3600_000 - 86_400_000);
  if (period === 'month') return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  const sameMonth = start.getUTCMonth() === endInclusive.getUTCMonth();
  const startLabel = sameMonth ? `${start.getUTCDate()}` : `${start.getUTCDate()} ${MONTH_NAMES[start.getUTCMonth()]}`;
  return `${startLabel}–${endInclusive.getUTCDate()} ${MONTH_NAMES[endInclusive.getUTCMonth()]} ${endInclusive.getUTCFullYear()}`;
}

function formatMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// ─── Shared chart components ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-standard bg-overlay px-3 py-2 text-small shadow-medium">
      {label && <p className="font-bold text-text">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums text-text-subtle">
          {formatRupiah(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Share card component (ref-able, no sensitive data by default) ─────────────

function ShareCard({
  cardRef,
  period,
  label,
  totals,
  topCategories,
  dataStartsAt,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  period: Period;
  label: string;
  totals: { spend: number; income: number; net: number; savingsRate: number | null };
  topCategories: { category: string; total: number }[];
  dataStartsAt?: string | null;
}) {
  const top3 = topCategories.slice(0, 3);
  const maxCat = Math.max(...top3.map((c) => c.total), 1);
  return (
    <div
      ref={cardRef as React.RefObject<HTMLDivElement>}
      className="w-80 rounded-2xl bg-[#0a0a0a] p-6 text-white"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#666]">Trackster · {label}</p>
      <p
        className={`mb-4 font-bold tabular-nums ${totals.net >= 0 ? 'text-[#1ed760]' : 'text-[#ff4d4d]'}`}
        style={{ fontSize: 32 }}
      >
        {totals.net >= 0 ? '+' : ''}
        {formatRupiah(totals.net)}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[#666]">Keluar</p>
          <p className="font-bold">{formatRupiahCompact(totals.spend)}</p>
        </div>
        <div>
          <p className="text-[#666]">Masuk</p>
          <p className="font-bold">{formatRupiahCompact(totals.income)}</p>
        </div>
        {totals.savingsRate != null && (
          <div>
            <p className="text-[#666]">Savings rate</p>
            <p className="font-bold text-[#1ed760]">{totals.savingsRate.toFixed(0)}%</p>
          </div>
        )}
      </div>
      {top3.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#666]">Top kategori</p>
          {top3.map((c) => (
            <div key={c.category}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span>{CATEGORY_LABELS[c.category] ?? c.category}</span>
                <span className="tabular-nums">{formatRupiahCompact(c.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#222]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.total / maxCat) * 100}%`, backgroundColor: CATEGORY_COLORS[c.category] ?? '#94a3b8' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {dataStartsAt && (
        <p className="mt-4 text-[10px] text-[#444]">Data mulai {dataStartsAt}</p>
      )}
    </div>
  );
}

// ─── Share & Export button row ─────────────────────────────────────────────────

function ExportRow({
  period,
  label,
  totals,
  topCategories,
  fromDate,
  toDate,
  dataStartsAt,
}: {
  period: Period;
  label: string;
  totals: { spend: number; income: number; net: number; savingsRate: number | null };
  topCategories: { category: string; total: number }[];
  fromDate: string;
  toDate: string;
  dataStartsAt?: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showCard, setShowCard] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!showCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCard(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCard]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(cardRef.current!, { pixelRatio: 2, backgroundColor: '#0a0a0a' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `trackster-${label.replace(/\s/g, '-')}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Laporan ${label} — Trackster` });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = file.name;
        link.click();
      }
    } finally {
      setSharing(false);
    }
  }, [label]);

  const handleDownloadCsv = () => {
    const url = `/api/reports/export.csv?from=${fromDate}&to=${toDate}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowCard(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-card bg-neutral py-3 text-small font-bold text-text-subtle transition-colors hover:text-text"
        >
          <Share2 size={15} />
          Bagikan gambar
        </button>
        <button
          onClick={handleDownloadCsv}
          className="flex flex-1 items-center justify-center gap-2 rounded-card bg-neutral py-3 text-small font-bold text-text-subtle transition-colors hover:text-text"
        >
          <Download size={15} />
          Unduh CSV
        </button>
      </div>

      <AnimatePresence>
        {showCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_BASE}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowCard(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-[480px] flex-col items-center gap-3 overflow-y-auto rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="flex w-full items-center justify-between">
                <h2 className="text-heading font-bold text-text">Bagikan gambar</h2>
                <button
                  onClick={() => setShowCard(false)}
                  aria-label="Tutup"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:bg-hover hover:text-text"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="self-start text-micro text-text-subtlest">
                Preview kartu — tidak ada saldo atau nama merchant sensitif
              </p>
              <ShareCard
                cardRef={cardRef}
                period={period}
                label={label}
                totals={totals}
                topCategories={topCategories}
                dataStartsAt={dataStartsAt}
              />
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex w-full items-center justify-center gap-2 rounded-pill bg-brand py-3 text-small font-bold text-on-brand transition-colors duration-fast ease-standard hover:bg-brand-hover disabled:opacity-50"
              >
                <Share2 size={15} />
                {sharing ? 'Membuat gambar...' : 'Bagikan / Simpan'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-small text-text-subtle">Memuat...</div>}>
      <ReportsPageInner />
    </Suspense>
  );
}

function ReportsPageInner() {
  const searchParams = useSearchParams();
  const rawPeriod = searchParams.get('period');
  const initialPeriod: Period =
    rawPeriod === 'month' ? 'month' :
    rawPeriod === '6m' ? '6m' :
    rawPeriod === 'all' ? 'all' :
    'week';
  const initialDate = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<Period>(initialPeriod);
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-page/[0.9] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Analisis pengeluaran</p>
        <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Laporan</h1>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {/* Period tabs */}
        <div className="flex gap-1 rounded-pill bg-neutral p-1">
          {(
            [
              { key: 'week', label: 'Minggu' },
              { key: 'month', label: 'Bulan' },
              { key: '6m', label: '6 Bln' },
              { key: 'all', label: 'Semua' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                if (t.key === 'week' || t.key === 'month') {
                  setAnchorDate(new Date().toISOString().slice(0, 10));
                }
              }}
              className={`relative flex-1 rounded-pill py-2 text-label font-bold transition-colors duration-base ease-standard ${
                tab === t.key ? 'text-on-brand' : 'text-text-subtle hover:text-text'
              }`}
            >
              {tab === t.key && (
                <motion.span
                  layoutId="reports-period-tab"
                  className="absolute inset-0 rounded-pill bg-brand"
                  transition={TRANSITION_BASE}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>

        <AnimatedTabContent tabKey={tab}>
          {tab === 'week' || tab === 'month' ? (
            <PeriodReportTab period={tab} anchorDate={anchorDate} onAnchorChange={setAnchorDate} onSelectDay={setSelectedDay} />
          ) : tab === '6m' ? (
            <AggregateTab period="6m" />
          ) : (
            <AllTab />
          )}
        </AnimatedTabContent>
      </div>

      {selectedDay && <DayDetailSheet date={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}

// ─── PeriodReportTab (Week + Month) ──────────────────────────────────────────

const PERIOD_SUBTABS = [
  { key: 'kategori', label: 'Kategori' },
  { key: 'merchant', label: 'Top merchant' },
  { key: 'subs', label: 'Langganan' },
] as const;

type PeriodSubtab = (typeof PERIOD_SUBTABS)[number]['key'];

function PeriodReportTab({
  period,
  anchorDate,
  onAnchorChange,
  onSelectDay,
}: {
  period: 'week' | 'month';
  anchorDate: string;
  onAnchorChange: (date: string) => void;
  onSelectDay: (date: string) => void;
}) {
  const { data, error, isLoading } = useSWR(`/reports?period=${period}&date=${anchorDate}`, reportFetcher);
  const [subtab, setSubtab] = useState<PeriodSubtab>('kategori');

  if (isLoading || !data) return <ReportSkeleton />;
  if (error) return <p className="text-label text-status-over">Gagal memuat laporan.</p>;

  const { stats, narrative, closed } = data;
  const { totals, previous } = stats;
  const isFuture = new Date(data.end).getTime() > Date.now();

  const goPrev = () => onAnchorChange(wibDateKey(new Date(new Date(data.start).getTime() - 86_400_000).toISOString()));
  const goNext = () => onAnchorChange(wibDateKey(data.end));

  const categoryData = stats.byCategory.map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] ?? c.category }));
  const topMerchants = stats.byMerchant.slice(0, 5);
  const periodLabel = formatPeriodLabel(period, data.start, data.end);

  // From/to for CSV export
  const fromDate = wibDateKey(data.start);
  const toDate = wibDateKey(new Date(new Date(data.end).getTime() - 86_400_000).toISOString());

  return (
    <>
      <div className="flex items-center justify-between rounded-card bg-card p-2 shadow-card">
        <button onClick={goPrev} aria-label="Periode sebelumnya" className="flex h-9 w-9 items-center justify-center rounded-full text-text-subtle hover:text-text">
          <ChevronLeft size={18} />
        </button>
        <span className="text-label font-bold text-text">{periodLabel}</span>
        <button
          onClick={goNext}
          disabled={isFuture}
          aria-label="Periode berikutnya"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-subtle hover:text-text disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Hero */}
      <section className="rounded-card-lg bg-card p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Net</p>
          {totals.savingsRate != null && (
            <p className="text-small text-text-subtle">
              Savings rate <span className="font-bold tabular-nums text-text">{totals.savingsRate.toFixed(0)}%</span>
            </p>
          )}
        </div>
        <p className={`font-title text-amount-hero font-black tabular-nums tracking-amount ${totals.net >= 0 ? 'text-status-under' : 'text-status-over'}`}>
          {totals.net >= 0 ? '+' : ''}
          {formatRupiah(totals.net)}
        </p>
        {(totals.income > 0 || (previous?.income ?? 0) > 0) && (
          <p className="mt-1 text-small text-text-subtle">
            Masuk {formatRupiahCompact(totals.income)} · Keluar {formatRupiahCompact(totals.spend)}
          </p>
        )}
        {previous ? (
          <p className="mt-2 text-small text-text-subtle">
            vs periode sebelumnya: keluar rutin {previous.spendRoutine > 0 ? `${pctChange(totals.spendRoutine, previous.spendRoutine) >= 0 ? '↑' : '↓'}${Math.abs(pctChange(totals.spendRoutine, previous.spendRoutine)).toFixed(0)}%` : '—'}
            {' · '}
            pemasukan {previous.income > 0 ? `${totals.income >= previous.income ? '↑' : '↓'}${formatRupiahCompact(Math.abs(totals.income - previous.income))}` : '—'}
          </p>
        ) : (
          <p className="mt-2 text-small text-text-subtlest">Belum ada data pembanding untuk periode ini</p>
        )}
        {stats.budget.daysWithBudget > 0 && (
          <p className="mt-2 text-small text-text-subtle">
            Kepatuhan budget:{' '}
            <span className={`font-bold ${stats.budget.daysOver === 0 ? 'text-status-under' : 'text-status-over'}`}>
              {stats.budget.daysOver}
            </span>{' '}
            dari {stats.budget.daysWithBudget} hari berbudget over
          </p>
        )}
      </section>

      {narrative ? (
        <section className="rounded-card bg-card p-5 shadow-card">
          <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Ringkasan dari Track</p>
          <p className="mt-2 line-clamp-2 whitespace-pre-line text-small leading-relaxed text-text">{narrative}</p>
        </section>
      ) : !closed ? (
        <p className="px-1 text-micro text-text-subtlest">Periode masih berjalan — narasi & snapshot muncul setelah periode ini tutup.</p>
      ) : null}

      {/* Chart harian */}
      <section className="rounded-card bg-card p-5 shadow-card">
        <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Tren harian</p>
        <p className="mb-2 text-micro text-text-subtlest">Klik satu batang buat lihat detail transaksi hari itu</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.byDay} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(-2)} tick={{ fill: '#8c8c8c', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === 'month' ? 3 : 0} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
            <Bar dataKey="spend" radius={[3, 3, 0, 0]} fill="#1ed760" cursor="pointer" onClick={(d: any) => onSelectDay(d.date)} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tabbed panel: Kategori / Top merchant / Langganan */}
      <section className="rounded-card bg-card p-4 shadow-card">
        <div className="flex gap-1 rounded-pill bg-neutral p-1">
          {PERIOD_SUBTABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubtab(t.key)}
              className={`relative flex-1 rounded-pill py-2 text-label font-bold transition-colors duration-base ease-standard ${
                subtab === t.key ? 'text-on-brand' : 'text-text-subtle hover:text-text'
              }`}
            >
              {subtab === t.key && (
                <motion.span
                  layoutId="reports-period-subtab"
                  className="absolute inset-0 rounded-pill bg-brand"
                  transition={TRANSITION_BASE}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={subtab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={TRANSITION_BASE}
            className="mt-4"
          >
            {subtab === 'kategori' &&
              (categoryData.filter((c) => c.total > 0).length > 0 ? (
                <div className="flex flex-col gap-3">
                  {categoryData.filter((c) => c.total > 0).map((c) => {
                    const max = Math.max(1, ...categoryData.map((x) => Math.max(x.total, x.prevTotal ?? 0)));
                    return (
                      <div key={c.category}>
                        <div className="flex items-baseline justify-between text-small">
                          <span className="text-text-subtle">{c.label}</span>
                          <span className="tabular-nums font-bold text-text">{formatRupiah(c.total)}</span>
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          <div className="h-2 overflow-hidden rounded-pill bg-track">
                            <div className="h-full rounded-pill transition-[width] duration-slow ease-expressive" style={{ width: `${(c.total / max) * 100}%`, backgroundColor: CATEGORY_COLORS[c.category] ?? '#94a3b8' }} />
                          </div>
                          {c.prevTotal != null && (
                            <div className="h-1.5 overflow-hidden rounded-pill bg-track">
                              <div className="h-full rounded-pill bg-text-subtlest/50" style={{ width: `${(c.prevTotal / max) * 100}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-small text-text-subtlest">Belum ada data kategori untuk periode ini.</p>
              ))}

            {subtab === 'merchant' &&
              (topMerchants.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {topMerchants.map((m) => (
                    <div key={m.merchantKey} className="flex items-baseline justify-between gap-3 text-small">
                      <p className="min-w-0 truncate font-bold text-text">{m.displayName}</p>
                      <p className="shrink-0 tabular-nums text-text-subtle">{m.count}× · {formatRupiah(m.total)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-small text-text-subtlest">Belum ada merchant tercatat.</p>
              ))}

            {subtab === 'subs' && <SubscriptionsSection />}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Export row */}
      <ExportRow
        period={period}
        label={periodLabel}
        totals={totals}
        topCategories={categoryData}
        fromDate={fromDate}
        toDate={toDate}
      />
    </>
  );
}

// ─── AggregateTab (6m) ────────────────────────────────────────────────────────

function AggregateTab({ period }: { period: '6m' }) {
  const { data, isLoading, error } = useSWR(`/reports/aggregate?period=${period}`, aggregateFetcher);

  if (isLoading || !data) return <ReportSkeleton />;
  if (error) return <p className="text-label text-status-over">Gagal memuat laporan.</p>;

  const { months, totals, dataStartsAt, bestMonth, worstMonth } = data;
  const withData = months.filter((m) => m.txCount > 0 || m.income > 0);

  // Chart: batang bulanan masuk vs keluar
  const chartData = withData.map((m) => ({
    label: formatMonthLabel(m.month).slice(0, 7), // 'Sep 26'
    keluar: m.spend,
    masuk: m.income,
    net: m.net,
  }));

  // Kategori aggregated — dari bulan-bulan (tidak ada di agregat, jadi skip)
  const label = '6 Bulan Terakhir';
  const fromDate = withData[0]?.month ? `${withData[0].month}-01` : '';
  const lastMonth = withData[withData.length - 1];
  const toDate = lastMonth ? `${lastMonth.month}-28` : '';

  return (
    <>
      {dataStartsAt && (
        <p className="px-1 text-micro text-text-subtlest">Data mulai {dataStartsAt}</p>
      )}

      {/* Hero aggregate */}
      <section className="rounded-card-lg bg-card p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Net 6 bulan</p>
        </div>
        <p className={`font-title text-amount-hero font-black tabular-nums tracking-amount ${totals.net >= 0 ? 'text-status-under' : 'text-status-over'}`}>
          {totals.net >= 0 ? '+' : ''}{formatRupiah(totals.net)}
        </p>
        <p className="mt-1 text-small text-text-subtle">
          Masuk {formatRupiahCompact(totals.income)} · Keluar {formatRupiahCompact(totals.spend)}
        </p>
        <p className="text-small text-text-subtle">Rata-rata bulanan: {formatRupiahCompact(totals.avgMonthlySpend)}/bln</p>
      </section>

      {/* Bulan terbaik / terburuk */}
      {(bestMonth || worstMonth) && (
        <div className="grid grid-cols-2 gap-3">
          {bestMonth && (
            <StatTile label="Bulan terbaik" value={formatRupiahCompact(bestMonth.spend)} tone="under" />
          )}
          {worstMonth && (
            <StatTile label="Bulan terboros" value={formatRupiahCompact(worstMonth.spend)} tone="over" />
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 -mt-2">
        {bestMonth && (
          <p className="flex items-center gap-1.5 px-1 text-small text-text-subtle">
            <TrendingDown size={13} /> {formatMonthLabel(bestMonth.month)}
          </p>
        )}
        {worstMonth && (
          <p className="flex items-center gap-1.5 px-1 text-small text-text-subtle">
            <TrendingUp size={13} /> {formatMonthLabel(worstMonth.month)}
          </p>
        )}
      </div>

      {/* Chart bulanan masuk vs keluar */}
      {chartData.length > 0 && (
        <section className="rounded-card bg-card p-5 shadow-card">
          <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Tren bulanan</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#8c8c8c', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
              <Bar dataKey="keluar" name="Keluar" radius={[3, 3, 0, 0]} fill="#1ed760" stackId="a" />
              <Bar dataKey="masuk" name="Masuk" radius={[3, 3, 0, 0]} fill="#3b82f6" stackId="b" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex gap-4 text-micro text-text-subtle">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#1ed760]" />Keluar</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#3b82f6]" />Masuk</span>
          </div>
        </section>
      )}

      {/* Per bulan list */}
      <section className="rounded-card bg-card p-5 shadow-card">
        <p className="mb-3 text-small font-bold uppercase tracking-caps text-text-subtle">Per bulan</p>
        <div className="flex flex-col gap-3">
          {withData.map((m) => (
            <div key={m.month} className="flex items-start justify-between gap-2">
              <div>
                <p className="text-small font-bold text-text">
                  {formatMonthLabel(m.month)}
                  {m.isLive && <span className="ml-1.5 text-micro font-normal text-text-subtle">(berjalan)</span>}
                </p>
                {m.narrative && (
                  <p className="mt-0.5 text-micro leading-relaxed text-text-subtle line-clamp-2">{m.narrative}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums text-small font-bold text-text">{formatRupiahCompact(m.spend)}</p>
                {m.savingsRate != null && (
                  <p className={`text-micro ${m.savingsRate > 0 ? 'text-status-under' : 'text-status-over'}`}>
                    SR {m.savingsRate.toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Export */}
      <ExportRow
        period="6m"
        label={label}
        totals={{ spend: totals.spend, income: totals.income, net: totals.net, savingsRate: null }}
        topCategories={[]}
        fromDate={fromDate}
        toDate={toDate}
      />
    </>
  );
}

// ─── AllTab (Semua) ──────────────────────────────────────────────────────────

function AllTab() {
  const { data, isLoading, error } = useSWR('/reports/aggregate?period=all', aggregateFetcher);
  const { data: records, isLoading: recordsLoading } = useSWR('/reports/records', recordsFetcher);

  // Transaction list search
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('ALL');
  const [source, setSource] = useState<(typeof SOURCE_FILTER_OPTIONS)[number]>('ALL');
  const [resultsParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });
  const search = useDebouncedValue(searchInput, 400);

  const listParams = new URLSearchParams({ limit: '50' });
  if (search) listParams.set('search', search);
  if (category !== 'ALL') listParams.set('category', category);
  if (source !== 'ALL') listParams.set('source', source);

  const { data: listData, isLoading: listLoading, mutate: mutateList } = useSWR(
    `/transactions?${listParams.toString()}`,
    transactionListFetcher,
  );

  if (isLoading || !data) return <ReportSkeleton />;
  if (error || !data) return <p className="text-label text-status-over">Gagal memuat laporan.</p>;

  const { totals, dataStartsAt, bestMonth, worstMonth, months } = data;
  const withData = months.filter((m) => m.txCount > 0 || m.income > 0);

  return (
    <>
      {dataStartsAt && (
        <p className="px-1 text-micro text-text-subtlest">Data mulai {dataStartsAt}</p>
      )}

      {/* Hero */}
      <section className="rounded-card-lg bg-card p-6 shadow-card">
        <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Total sepanjang waktu</p>
        <p className="font-title text-amount-hero font-extrabold tabular-nums tracking-amount text-text">{formatRupiah(totals.spend)}</p>
        {totals.income > 0 && (
          <p className="mt-1 text-small text-text-subtle">
            Masuk {formatRupiahCompact(totals.income)} · Net {formatRupiahCompact(totals.net)}
          </p>
        )}
      </section>

      {/* Bulan terbaik / terburuk */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Bulan terboros" value={worstMonth ? formatRupiah(worstMonth.spend) : '—'} tone="over" />
        <StatTile label="Bulan terendah" value={bestMonth ? formatRupiah(bestMonth.spend) : '—'} tone="under" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 -mt-2">
        <p className="flex items-center gap-1.5 px-1 text-small text-text-subtle">
          <TrendingUp size={13} /> {worstMonth ? formatMonthLabel(worstMonth.month) : '—'}
        </p>
        <p className="flex items-center gap-1.5 px-1 text-small text-text-subtle">
          <TrendingDown size={13} /> {bestMonth ? formatMonthLabel(bestMonth.month) : '—'}
        </p>
      </div>

      {/* Rekor & Milestone */}
      {!recordsLoading && records && (
        <section className="rounded-card bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-warning" />
            <p className="text-small font-bold text-text">Rekor & Milestone</p>
          </div>
          <div className="flex flex-col gap-3">
            {records.biggestTransaction && (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-micro text-text-subtle">Transaksi terbesar</p>
                  <p className="text-small font-bold text-text truncate">{records.biggestTransaction.description}</p>
                  <p className="text-micro text-text-subtle">{records.biggestTransaction.date}</p>
                </div>
                <p className="shrink-0 tabular-nums font-bold text-text">{formatRupiah(records.biggestTransaction.amount)}</p>
              </div>
            )}
            {records.mostVisitedMerchant && (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-micro text-text-subtle">Merchant paling sering</p>
                  <p className="text-small font-bold text-text">{records.mostVisitedMerchant.displayName}</p>
                </div>
                <p className="shrink-0 tabular-nums text-small text-text-subtle">{records.mostVisitedMerchant.count}×</p>
              </div>
            )}
            {records.bestSavingsRateMonth && (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-micro text-text-subtle">Savings rate terbaik</p>
                  <p className="text-small font-bold text-text">{formatMonthLabel(records.bestSavingsRateMonth.month)}</p>
                </div>
                <p className="shrink-0 tabular-nums font-bold text-status-under">
                  {records.bestSavingsRateMonth.savingsRate.toFixed(0)}%
                </p>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-micro text-text-subtle">Total transaksi</p>
                <p className="text-small font-bold text-text">{records.totalTransactions.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Chart tren bulanan */}
      {withData.length > 0 && (
        <section className="rounded-card bg-card p-5 shadow-card">
          <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Tren bulanan</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={withData.map((m) => ({ label: m.month.slice(2), spend: m.spend }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#8c8c8c', fontSize: 10 }} axisLine={false} tickLine={false} interval={withData.length > 6 ? 1 : 0} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
              <Bar dataKey="spend" radius={[3, 3, 0, 0]} fill="#1ed760" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Search & filter */}
      <section className="flex flex-col gap-2.5 rounded-card bg-card p-4 shadow-card">
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
              className="appearance-none rounded-pill bg-neutral py-1.5 pl-3 pr-7 text-small font-bold text-text outline-none"
            >
              <option value="ALL">Semua kategori</option>
              {CATEGORY_FILTER_OPTIONS.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 text-micro text-text-subtle">▾</span>
          </span>
          {SOURCE_FILTER_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`rounded-pill px-3 py-1.5 text-small font-bold transition-colors duration-base ease-standard ${
                source === s ? 'bg-brand text-on-brand' : 'bg-neutral text-text-subtle'
              }`}
            >
              {s === 'ALL' ? 'Semua bank' : s === 'JAGO' ? 'Jago' : s}
            </button>
          ))}
        </div>
      </section>

      {(search || category !== 'ALL' || source !== 'ALL') && (
        <section className="rounded-card bg-card p-2 shadow-card">
          <p className="px-2 pb-1 pt-1 text-small text-text-subtle">
            {listLoading ? 'Mencari...' : `${listData?.total ?? 0} hasil`}
          </p>
          {!listLoading && listData?.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Inbox size={20} className="text-text-subtle" />
              <p className="text-small text-text-subtle">Tidak ada transaksi yang cocok.</p>
            </div>
          ) : (
            <ul ref={resultsParent} className="flex flex-col gap-1">
              {listData?.data.map((t) => (
                <TransactionNoteRow
                  key={t.id}
                  transaction={t}
                  onSaved={(id, note) =>
                    mutateList(
                      (current) => current && { ...current, data: current.data.map((tx) => (tx.id === id ? { ...tx, note } : tx)) },
                      { revalidate: false },
                    )
                  }
                  onCategorySaved={(id, cat) =>
                    mutateList(
                      (current) => current && { ...current, data: current.data.map((tx) => (tx.id === id ? { ...tx, category: cat } : tx)) },
                      { revalidate: false },
                    )
                  }
                  onAliasSaved={(id, displayName) =>
                    mutateList(
                      (current) => current && { ...current, data: current.data.map((tx) => (tx.id === id ? { ...tx, displayDescription: displayName } : tx)) },
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

      {/* Export */}
      <ExportRow
        period="all"
        label="Semua Waktu"
        totals={{ spend: totals.spend, income: totals.income, net: totals.net, savingsRate: null }}
        topCategories={[]}
        fromDate={dataStartsAt ?? ''}
        toDate={new Date().toISOString().slice(0, 10)}
        dataStartsAt={dataStartsAt}
      />
    </>
  );
}

// ─── DayDetailSheet ──────────────────────────────────────────────────────────

function DayDetailSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, isLoading, mutate } = useSWR(`/transactions/day/${date}`, dayFetcher);
  const [listParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex animate-fade-in items-end justify-center bg-page/70 backdrop-blur-sm lg:items-center" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-content animate-slide-up overflow-y-auto rounded-t-panel bg-card p-5 shadow-overlay lg:rounded-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Detail transaksi</p>
            <h2 className="font-title text-heading font-bold text-text">{date}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral text-text-subtle hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-row bg-track" />
            ))}
          </div>
        ) : data.transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card p-8 text-center shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral text-text-subtle">
              <Inbox size={22} />
            </span>
            <p className="text-body font-bold text-text">Belum ada transaksi</p>
            <p className="max-w-[280px] text-small leading-relaxed text-text-subtle">
              Nggak ada transaksi tercatat di tanggal ini.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-small tabular-nums text-text-subtle">
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

// ─── ReportSkeleton ──────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-40 animate-pulse rounded-card bg-track" />
      <div className="h-32 animate-pulse rounded-card bg-track" />
    </div>
  );
}

// ─── SubscriptionsSection ─────────────────────────────────────────────────────

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
    return <div className="h-24 animate-pulse rounded-card bg-track" />;
  }

  const active = (subs ?? []).filter((s) => s.isActive);

  if (active.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-medium bg-neutral p-5 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-hover text-text-subtle">
          <Inbox size={18} />
        </span>
        <p className="text-small font-bold text-text">Langganan</p>
        <p className="max-w-[280px] text-micro leading-relaxed text-text-subtle">
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
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Langganan aktif</p>
          <p className="font-title text-amount font-extrabold tabular-nums text-text">
            {formatRupiah(Math.round(totalMonthlyBurn))}
            <span className="text-small font-normal text-text-subtle">/bln</span>
          </p>
        </div>
        <Link
          href="/app/subscriptions"
          className="flex items-center gap-1 rounded-pill bg-neutral px-3 py-1.5 text-micro font-bold text-text-subtle transition-colors hover:bg-neutral-hover hover:text-text"
        >
          <span>Kelola ({active.length})</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      <ul className="mt-4 divide-y divide-border border-t border-border">
        {active.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-3">
            <div className="min-w-0 flex-1 pr-3">
              <p className="font-bold text-text truncate">{s.name}</p>
              <p className="text-micro text-text-subtle">
                {s.cycle === 'YEARLY' ? 'Tahunan' : 'Bulanan'} · Jatuh tempo{' '}
                {new Date(s.nextDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <p className="font-bold text-text tabular-nums shrink-0">{formatRupiah(s.amount)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
