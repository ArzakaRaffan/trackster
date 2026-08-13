'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { AlertTriangle, Bell, Inbox, Mail, Plus, RefreshCw } from 'lucide-react';
import { TransactionNoteRow } from '@/components/ui/TransactionNoteRow';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { BudgetProgress } from '@/components/ui/BudgetProgress';

interface Transaction {
  id: number;
  amount: number;
  description: string;
  source: 'BCA' | 'JAGO' | 'GOPAY';
  occurredAt: string;
  note?: string | null;
  category?: string;
  displayDescription?: string;
}

interface TodaySummary {
  date: string;
  budget: number;
  totalSpent: number;
  remaining: number;
  isOverBudget: boolean;
  transactions: Transaction[];
}

const fetcher = (path: string) => api.get<TodaySummary>(path);

const rp = (n: number) => 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

export default function TodayPage() {
  const { data, error, isLoading, mutate } = useSWR('/budget/today', fetcher, {
    refreshInterval: 60_000, // auto-refresh tiap 1 menit
  });

  if (isLoading) return <TodaySkeleton />;
  if (error)
    return (
      <div className="px-4 pb-navbar pt-6">
        <p className="text-label text-status-over">Gagal memuat data. Cek koneksi ke backend.</p>
      </div>
    );
  if (!data) return null;

  const ratio = data.budget > 0 ? data.totalSpent / data.budget : 0;
  const status = data.isOverBudget ? 'over' : ratio >= 0.8 ? 'near' : 'under';

  return (
    <div className="pb-navbar animate-fade-in-up">
      {/* Sticky blurred top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">{dateLabel(data.date)}</p>
          <h1 className="font-title text-title font-bold text-ink">Hari Ini</h1>
        </div>
        <button
          onClick={() => mutate()}
          aria-label="Sinkron email"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors duration-base ease-standard hover:text-ink"
        >
          <RefreshCw size={18} />
        </button>
        <button
          aria-label="Notifikasi"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-interactive text-ink"
        >
          <Bell size={18} />
        </button>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {/* Money hero */}
        <section className="rounded-medium bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <AmountDisplay
              label="Terpakai hari ini"
              value={data.totalSpent}
              size="hero"
              tone={data.isOverBudget ? 'over' : 'base'}
            />
            <span
              className={`shrink-0 rounded-full px-2 py-[3px] text-badge font-semibold ${
                status === 'over'
                  ? 'bg-status-over-bg text-status-over'
                  : status === 'near'
                    ? 'bg-status-near-bg text-status-near'
                    : 'bg-status-under-bg text-status-under'
              }`}
            >
              {data.isOverBudget ? 'Over budget' : 'Aman'}
            </span>
          </div>

          <div className="mt-4">
            <BudgetProgress spent={data.totalSpent} budget={data.budget} isOverBudget={data.isOverBudget} height={16} />
          </div>

          <div className="mt-4 flex gap-5">
            <AmountDisplay label="Budget" value={data.budget} size="body" tone="muted" />
            <AmountDisplay
              label={data.isOverBudget ? 'Lewat' : 'Sisa'}
              value={data.isOverBudget ? data.totalSpent - data.budget : data.remaining}
              size="body"
              tone={data.isOverBudget ? 'over' : 'under'}
            />
          </div>
        </section>

        {/* Over-budget alert */}
        {data.isOverBudget && (
          <div className="flex items-start gap-3 rounded-comfortable bg-status-over-bg p-4 shadow-[inset_0_0_0_1px_#f3727f]">
            <AlertTriangle size={18} className="mt-px shrink-0 text-status-over" />
            <div className="min-w-0">
              <p className="text-label font-bold text-status-over">Lewat budget harian</p>
              <p className="text-small leading-relaxed text-ink-secondary">
                Kamu {rp(data.totalSpent - data.budget)} di atas budget. Alert Telegram sudah dikirim.
              </p>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="flex items-baseline gap-3">
          <h2 className="flex-1 text-heading font-semibold text-ink">Transaksi</h2>
          <span className="text-small tabular-nums text-ink-muted">{data.transactions.length} transaksi</span>
        </div>

        {data.transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-comfortable p-8 text-center shadow-hairline">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Inbox size={22} />
            </span>
            <p className="text-body font-bold text-ink">Belum ada transaksi</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">
              Begitu ada email notifikasi dari BCA atau Jago, transaksinya muncul di sini otomatis.
            </p>
          </div>
        ) : (
          <ul className="rounded-comfortable bg-surface p-2">
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
        )}

        <p className="flex items-center gap-2.5 text-small text-ink-subtle">
          <Mail size={14} /> Sinkron otomatis dari email BCA dan Jago
        </p>
      </div>

      {/* FAB */}
      <button
        aria-label="Tambah transaksi manual"
        className="fixed bottom-[88px] right-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-base transition-transform duration-fast ease-standard active:scale-95 lg:bottom-6"
      >
        <Plus size={26} />
      </button>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="px-4 pb-navbar pt-6">
      <div className="flex flex-col gap-3">
        <div className="h-14 w-56 animate-pulse rounded-comfortable bg-track" />
        <div className="h-4 animate-pulse rounded-pill bg-track" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-standard bg-track" />
        ))}
      </div>
    </div>
  );
}
