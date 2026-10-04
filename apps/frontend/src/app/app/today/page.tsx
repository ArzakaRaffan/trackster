'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { AlertTriangle, Bell, ChevronDown, ChevronLeft, Mail, Plus, RefreshCw, X } from 'lucide-react';
import { TransactionNoteRow, CATEGORY_LABELS } from '@/components/ui/TransactionNoteRow';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { BudgetProgress } from '@/components/ui/BudgetProgress';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PendingReimbursements } from '@/components/ui/PendingReimbursements';
import { EmptyState } from '@/components/EmptyState';
import { EASE_ENTER, TRANSITION_BASE } from '@/lib/motion';
import { formatRupiah } from '@/lib/format';

const CATEGORIES = [
  'MAKANAN', 'TRANSPORT', 'BELANJA', 'TAGIHAN', 'HIBURAN', 'KESEHATAN',
  'TRANSFER', 'TOPUP', 'PENDIDIKAN', 'PERAWATAN', 'INVESTASI', 'ROKOK', 'LAINNYA',
] as const;

interface ExpenseFormState {
  amount: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  source: 'BCA' | 'JAGO';
  occurredAt: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const emptyExpenseForm: ExpenseFormState = {
  amount: '',
  description: '',
  category: 'LAINNYA',
  source: 'BCA',
  occurredAt: todayISO(),
};

interface Transaction {
  id: number;
  amount: number;
  description: string;
  source: 'BCA' | 'JAGO' | 'GOPAY';
  occurredAt: string;
  note?: string | null;
  category?: string;
  displayDescription?: string;
  aiCaption?: string | null;
  reimbursedAmount?: number | string;
}


interface RunwayForecast {
  burnRatePerDay: number;
  currentBalance: number;
  remainingDays: number;
  projectedEndOfMonthBalance: number;
  isProjectedShortfall: boolean;
}

interface TodaySummary {
  date: string;
  budget: number;
  rollover?: number;
  totalSpent: number;
  remaining: number;
  isOverBudget: boolean;
  totalIncome: number;
  netAmount: number;
  isNetPositive: boolean;
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
  const { data: runway } = useSWR<RunwayForecast>('/budget/runway', (url: string) => api.get<RunwayForecast>(url), {
    refreshInterval: 60_000,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(emptyExpenseForm);
  const [saving, setSaving] = useState(false);
  const [runwayOpen, setRunwayOpen] = useState(false);

  const openForm = () => {
    setForm(emptyExpenseForm);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.post('/transactions', {
        amount: parseFloat(form.amount) || 0,
        description: form.description,
        category: form.category,
        source: form.source,
        occurredAt: new Date(form.occurredAt).toISOString(),
      });
      await mutate();
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

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
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      {/* Top bar */}
      <header className="flex items-center gap-3">
        <Link href="/app" aria-label="Kembali ke dashboard" className="text-text-subtle hover:text-text">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Hari Ini</h1>
          <p className="text-[15px] text-text-subtle">{dateLabel(data.date)}</p>
        </div>
        <button
          onClick={() => mutate()}
          aria-label="Sinkron email"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-subtle transition-colors duration-base ease-standard hover:bg-hover hover:text-text"
        >
          <RefreshCw size={18} />
        </button>
        <button
          aria-label="Notifikasi"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral text-text"
        >
          <Bell size={18} />
        </button>
      </header>

      {/* Money hero */}
      <section className="rounded-card-lg bg-card p-6 shadow-card">
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

        <div className="mt-5">
          <BudgetProgress spent={data.totalSpent} budget={data.budget} isOverBudget={data.isOverBudget} height={10} />
        </div>

        <div className="mt-5 flex gap-8">
          <AmountDisplay label="Budget" value={data.budget} size="body" tone="muted" />
          {!!data.rollover && (
            <AmountDisplay label="Dari sisa kemarin" value={data.rollover} size="body" tone="muted" />
          )}
          <AmountDisplay
            label={data.isOverBudget ? 'Lewat' : 'Sisa'}
            value={data.isOverBudget ? data.totalSpent - data.budget : data.remaining}
            size="body"
            tone={data.isOverBudget ? 'over' : 'under'}
          />
        </div>
      </section>

      {/* Runway: 1 baris collapsible */}
      {runway && (
        <section className="rounded-card-lg bg-card shadow-card">
          <button
            type="button"
            onClick={() => setRunwayOpen((v) => !v)}
            aria-expanded={runwayOpen}
            className="flex min-h-[48px] w-full items-center gap-3 px-6 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-small font-bold uppercase tracking-caps text-text-subtle">
                Runway akhir bulan
              </span>
              <span
                className={`block text-body font-bold tabular-nums ${
                  runway.isProjectedShortfall ? 'text-status-over' : 'text-text'
                }`}
              >
                {formatRupiah(runway.projectedEndOfMonthBalance)}
              </span>
            </span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-text-subtle transition-transform duration-base ease-standard ${
                runwayOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
            style={{ gridTemplateRows: runwayOpen ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4 text-small">
                <div>
                  <p className="text-micro text-text-subtle">Burn Rate (7 Hari)</p>
                  <p className="font-bold text-text">{formatRupiah(runway.burnRatePerDay)}/hari</p>
                </div>
                <div>
                  <p className="text-micro text-text-subtle">Sisa Hari Bulan Ini</p>
                  <p className="font-bold text-text">{runway.remainingDays} hari</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Over-budget alert */}
      {data.isOverBudget && (
        <div className="flex items-start gap-3 rounded-card bg-danger-subtle p-4 shadow-[inset_0_0_0_1px_theme(colors.danger.DEFAULT)]">
          <AlertTriangle size={18} className="mt-px shrink-0 text-danger" />
          <div className="min-w-0">
            <p className="text-label font-bold text-danger">Lewat budget harian</p>
            <p className="text-small leading-relaxed text-text-subtle">
              Kamu {rp(data.totalSpent - data.budget)} di atas budget. Alert Telegram sudah dikirim.
            </p>
          </div>
        </div>
      )}

      <PendingReimbursements />

      {/* Transactions */}
      <div className="flex items-baseline gap-3">
        <h2 className="flex-1 text-heading font-bold text-text">Transaksi</h2>
        <span className="text-small tabular-nums text-text-subtle">{data.transactions.length} transaksi</span>
      </div>

      {data.transactions.length === 0 ? (
        <EmptyState
          mood="idle"
          title="Belum ada transaksi"
          description="Begitu ada email notifikasi dari BCA atau Jago, transaksinya muncul di sini otomatis."
        />
      ) : (
        <ul className="rounded-card bg-card p-2 shadow-card">
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
      )}

      <p className="flex items-center gap-2.5 text-small text-text-subtlest">
        <Mail size={14} /> Sinkron otomatis dari email BCA dan Jago
      </p>

      {/* FAB */}
      <button
        onClick={openForm}
        aria-label="Tambah transaksi manual"
        className="fixed bottom-[88px] right-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand transition-transform duration-fast ease-standard active:scale-95 lg:bottom-6 lg:right-6"
      >
        <Plus size={26} />
      </button>

      {/* Manual expense modal */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_BASE}
            onClick={() => setFormOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Tambah pengeluaran manual"
          >
            <motion.section
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-y-auto rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Manual</p>
                  <h2 className="font-title text-heading font-bold text-text">Catat pengeluaran</h2>
                </div>
                <button
                  onClick={() => setFormOpen(false)}
                  aria-label="Tutup"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral text-text-subtle hover:text-text"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <Input
                  label="Nominal"
                  type="number"
                  inputMode="numeric"
                  prefix="Rp"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
                <Input
                  label="Deskripsi"
                  placeholder="Jajan, parkir, dll"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <label className="flex flex-col gap-2">
                  <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Kategori</span>
                  <span className="relative flex items-center">
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseFormState['category'] }))}
                      className="w-full appearance-none rounded-medium bg-neutral px-3.5 py-3 pr-9 text-body text-text shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 text-small text-text-subtle">▾</span>
                  </span>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Sumber</span>
                  <span className="relative flex items-center">
                    <select
                      value={form.source}
                      onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as 'BCA' | 'JAGO' }))}
                      className="w-full appearance-none rounded-medium bg-neutral px-3.5 py-3 pr-9 text-body text-text shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
                    >
                      <option value="BCA">BCA</option>
                      <option value="JAGO">Jago</option>
                    </select>
                    <span className="pointer-events-none absolute right-3.5 text-small text-text-subtle">▾</span>
                  </span>
                </label>
                <Input
                  label="Tanggal"
                  type="date"
                  value={form.occurredAt}
                  onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
                />
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleSubmit}
                  disabled={saving || !form.amount || !form.description}
                >
                  {saving ? 'Menyimpan...' : 'Tambah pengeluaran'}
                </Button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
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
