'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatRupiah, MONTH_NAMES } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_LABELS, TransactionNoteRow, type NoteableTransaction } from '@/components/ui/TransactionNoteRow';
import { Input } from '@/components/ui/Input';
import { StatTile } from '@/components/ui/StatTile';
import { ChevronLeft, ChevronRight, Inbox, Search, TrendingDown, TrendingUp, X } from 'lucide-react';

/** Debounce a fast-changing value (search input) so we don't fire a request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

interface CategoryTotal {
  category: string;
  total: number;
}

interface MonthlyReport {
  year: number;
  month: number;
  totalSpent: number;
  byCategory: CategoryTotal[];
  byDay: { date: string; totalSpent: number }[];
  transactions: NoteableTransaction[];
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

const monthlyFetcher = (path: string) => api.get<MonthlyReport>(path);
const summaryFetcher = (path: string) => api.get<AllTimeSummary>(path);
const dayFetcher = (path: string) => api.get<DayDetail>(path);
const transactionListFetcher = (path: string) => api.get<TransactionListResponse>(path);

const formatMonthLabel = (yyyyMM: string) => {
  const [y, m] = yyyyMM.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-standard bg-surface-overlay px-3 py-2 text-small shadow-medium">
      <p className="font-bold text-ink">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums text-ink-muted">
          {formatRupiah(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const [tab, setTab] = useState<'monthly' | 'all'>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const goPrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Analisis pengeluaran</p>
        <h1 className="font-title text-title font-bold text-ink">Laporan</h1>
      </header>

      <div className="flex flex-col gap-4 px-4">
        {/* Tab switcher */}
        <div className="flex gap-1 rounded-full-pill bg-surface p-1">
          {(['monthly', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full-pill py-2 text-label font-bold transition-colors duration-base ease-standard ${
                tab === t ? 'bg-brand text-base' : 'text-ink-muted'
              }`}
            >
              {t === 'monthly' ? 'Bulanan' : 'All Time'}
            </button>
          ))}
        </div>

        {tab === 'monthly' ? (
          <MonthlyTab year={year} month={month} onPrev={goPrevMonth} onNext={goNextMonth} onSelectDay={setSelectedDay} />
        ) : (
          <AllTimeTab />
        )}
      </div>

      {selectedDay && <DayDetailSheet date={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}

function MonthlyTab({
  year,
  month,
  onPrev,
  onNext,
  onSelectDay,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (date: string) => void;
}) {
  const { data, error, isLoading } = useSWR(`/transactions/monthly?year=${year}&month=${month}`, monthlyFetcher);

  if (isLoading) return <ReportSkeleton />;
  if (error || !data) return <p className="text-label text-status-over">Gagal memuat laporan.</p>;

  const categoryData = data.byCategory.map((c) => ({
    ...c,
    label: CATEGORY_LABELS[c.category] ?? c.category,
  }));

  return (
    <>
      {/* Month nav */}
      <div className="flex items-center justify-between rounded-comfortable bg-surface p-2">
        <button
          onClick={onPrev}
          aria-label="Bulan sebelumnya"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-label font-bold text-ink">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          onClick={onNext}
          aria-label="Bulan berikutnya"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <section className="rounded-medium bg-surface p-5">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Total bulan ini</p>
        <p className="font-title text-amount font-extrabold tabular-nums text-ink">{formatRupiah(data.totalSpent)}</p>

        <p className="mt-5 text-small font-bold uppercase tracking-caps text-ink-muted">Tren harian</p>
        <p className="mb-2 text-micro text-ink-subtle">Klik satu batang buat lihat detail transaksi hari itu</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data.byDay} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(-2)}
              tick={{ fill: '#7c7c7c', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
            <Bar
              dataKey="totalSpent"
              radius={[3, 3, 0, 0]}
              fill="#1ed760"
              cursor="pointer"
              onClick={(d: any) => onSelectDay(d.date)}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {categoryData.length > 0 && (
        <section className="rounded-medium bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Per kategori</p>
          <CategoryBarChart data={categoryData} />
        </section>
      )}
    </>
  );
}

function AllTimeTab() {
  const { data, error, isLoading } = useSWR('/transactions/summary?range=all', summaryFetcher);

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
            <ul className="flex flex-col gap-1">
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

      <div className="grid grid-cols-2 gap-2.5">
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
            <ul className="flex flex-col gap-1">
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
    <div className="flex flex-col gap-4">
      <div className="h-40 animate-pulse rounded-medium bg-track" />
      <div className="h-32 animate-pulse rounded-medium bg-track" />
    </div>
  );
}
