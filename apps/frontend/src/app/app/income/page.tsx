'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { formatRupiah, DAY_NAMES } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SourceTag } from '@/components/ui/SourceTag';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { StatTile } from '@/components/ui/StatTile';
import { TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import { ChevronLeft, Inbox, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';

type IncomeKind = 'FIXED' | 'SESSION' | 'DEDUCTION' | 'VARIABLE' | 'IRREGULAR';
type IncomeCadence = 'WEEKLY' | 'MONTHLY' | 'NONE';
type StreamStatus = 'RECEIVED' | 'PARTIAL' | 'PENDING' | 'MISSED';

interface Income {
  id: number;
  amount: number;
  description: string;
  source: 'BCA' | 'JAGO' | 'GOPAY';
  receivedAt: string;
  status?: 'CONFIRMED' | 'PENDING' | 'INTERNAL';
  stream?: { id: number; name: string } | null;
}

interface IncomeStream {
  id: number;
  name: string;
  kind: IncomeKind;
  cadence: IncomeCadence;
  source: 'BCA' | 'JAGO' | 'GOPAY';
  payDayOfWeek: number | null;
  payDayOfMonth: number | null;
  amount: number | null;
  sessionRate: number | null;
  sessionExtra: number | null;
  maxUnits: number | null;
  deductionPerUnit: number | null;
  typicalUnits: number | null;
  matchKeywords: string[];
  isActive: boolean;
}

interface StreamForecast {
  id: number;
  name: string;
  kind: IncomeKind;
  conservative: number;
  expected: number;
  max: number;
  received: number;
  status: StreamStatus;
}

interface WeekForecast {
  weekStart: string;
  streams: StreamForecast[];
  totals: { conservative: number; expected: number; max: number; received: number };
  upsideMonthly: number;
}

type Period = 'week' | 'month' | 'all';

const fetcher = (path: string) => api.get<Income[]>(path);
const streamsFetcher = (path: string) => api.get<IncomeStream[]>(path);
const weekForecastFetcher = (path: string) => api.get<WeekForecast>(path);
const horizonFetcher = (path: string) => api.get<WeekForecast[]>(path);

const todayISO = () => new Date().toISOString().slice(0, 10);

function startOfWeekISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function startOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const KIND_LABEL: Record<IncomeKind, string> = {
  FIXED: 'Tetap',
  SESSION: 'Per sesi',
  DEDUCTION: 'Potongan absen',
  VARIABLE: 'Variabel bulanan',
  IRREGULAR: 'Tak tentu',
};

const CADENCE_LABEL: Record<IncomeCadence, string> = {
  WEEKLY: 'Mingguan',
  MONTHLY: 'Bulanan',
  NONE: 'Tidak terjadwal',
};

const STATUS_LABEL: Record<StreamStatus, string> = {
  RECEIVED: 'Sudah masuk',
  PARTIAL: 'Sebagian',
  PENDING: 'Menunggu',
  MISSED: 'Terlewat',
};

const STATUS_TONE: Record<StreamStatus, string> = {
  RECEIVED: 'bg-status-under-bg text-status-under',
  PARTIAL: 'bg-status-near-bg text-status-near',
  PENDING: 'bg-track text-ink-muted',
  MISSED: 'bg-status-over-bg text-status-over',
};

function streamSummary(s: IncomeStream): string {
  switch (s.kind) {
    case 'FIXED':
      return `${formatRupiah(s.amount ?? 0)}/${s.cadence === 'MONTHLY' ? 'bulan' : 'minggu'}`;
    case 'SESSION':
      return `${formatRupiah(s.sessionRate ?? 0)}/sesi + ${formatRupiah(s.sessionExtra ?? 0)} offline · maks ${s.maxUnits ?? 0}x/minggu`;
    case 'DEDUCTION':
      return `maks ${formatRupiah(s.amount ?? 0)} · −${formatRupiah(s.deductionPerUnit ?? 0)}/absen`;
    case 'VARIABLE':
      return `~${formatRupiah(s.amount ?? 0)}/bulan (estimasi)`;
    case 'IRREGULAR':
      return 'Tak terjadwal — dihitung terpisah';
  }
}

interface StreamFormState {
  name: string;
  kind: IncomeKind;
  cadence: IncomeCadence;
  source: 'BCA' | 'JAGO';
  payDayOfWeek: string;
  payDayOfMonth: string;
  amount: string;
  sessionRate: string;
  sessionExtra: string;
  maxUnits: string;
  deductionPerUnit: string;
  typicalUnits: string;
  matchKeywords: string;
  isActive: boolean;
}

const emptyStreamForm: StreamFormState = {
  name: '',
  kind: 'FIXED',
  cadence: 'WEEKLY',
  source: 'BCA',
  payDayOfWeek: '',
  payDayOfMonth: '',
  amount: '',
  sessionRate: '',
  sessionExtra: '',
  maxUnits: '',
  deductionPerUnit: '',
  typicalUnits: '',
  matchKeywords: '',
  isActive: true,
};

function streamToForm(s: IncomeStream): StreamFormState {
  return {
    name: s.name,
    kind: s.kind,
    cadence: s.cadence,
    source: s.source === 'GOPAY' ? 'BCA' : s.source,
    payDayOfWeek: s.payDayOfWeek != null ? String(s.payDayOfWeek) : '',
    payDayOfMonth: s.payDayOfMonth != null ? String(s.payDayOfMonth) : '',
    amount: s.amount != null ? String(s.amount) : '',
    sessionRate: s.sessionRate != null ? String(s.sessionRate) : '',
    sessionExtra: s.sessionExtra != null ? String(s.sessionExtra) : '',
    maxUnits: s.maxUnits != null ? String(s.maxUnits) : '',
    deductionPerUnit: s.deductionPerUnit != null ? String(s.deductionPerUnit) : '',
    typicalUnits: s.typicalUnits != null ? String(s.typicalUnits) : '',
    matchKeywords: s.matchKeywords.join(', '),
    isActive: s.isActive,
  };
}

function formToPayload(f: StreamFormState) {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  return {
    name: f.name.trim(),
    kind: f.kind,
    cadence: f.cadence,
    source: f.source,
    payDayOfWeek: f.cadence === 'WEEKLY' ? num(f.payDayOfWeek) : undefined,
    payDayOfMonth: f.cadence === 'MONTHLY' ? num(f.payDayOfMonth) : undefined,
    amount: ['FIXED', 'DEDUCTION', 'VARIABLE'].includes(f.kind) ? num(f.amount) : undefined,
    sessionRate: f.kind === 'SESSION' ? num(f.sessionRate) : undefined,
    sessionExtra: f.kind === 'SESSION' ? num(f.sessionExtra) : undefined,
    maxUnits: f.kind === 'SESSION' || f.kind === 'DEDUCTION' ? num(f.maxUnits) : undefined,
    deductionPerUnit: f.kind === 'DEDUCTION' ? num(f.deductionPerUnit) : undefined,
    typicalUnits: f.kind === 'SESSION' || f.kind === 'DEDUCTION' ? num(f.typicalUnits) : undefined,
    matchKeywords: f.matchKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    isActive: f.isActive,
  };
}

interface FormState {
  amount: string;
  description: string;
  source: 'BCA' | 'JAGO';
  receivedAt: string;
}

const emptyForm: FormState = { amount: '', description: '', source: 'BCA', receivedAt: todayISO() };

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'all', label: 'Semua' },
];

export default function IncomePage() {
  const [period, setPeriod] = useState<Period>('month');

  const listPath = useMemo(() => {
    if (period === 'all') return '/income';
    const start = period === 'week' ? startOfWeekISO() : startOfMonthISO();
    return `/income?startDate=${start}`;
  }, [period]);

  const { data, error, isLoading, mutate } = useSWR(listPath, fetcher);
  const { data: week, mutate: mutateWeek } = useSWR('/income/forecast/week', weekForecastFetcher);
  const { data: horizon } = useSWR('/income/forecast/horizon?weeks=4', horizonFetcher);
  const { data: streams, mutate: mutateStreams } = useSWR('/income-streams', streamsFetcher);
  const { data: pending, mutate: mutatePending } = useSWR('/income?status=PENDING', fetcher);
  const [listParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });
  const [pendingParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const [pendingStreamPick, setPendingStreamPick] = useState<Record<number, string>>({});
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const refreshAfterResolve = () => Promise.all([mutatePending(), mutate(), mutateWeek()]);

  const handleConfirmStream = async (incomeId: number) => {
    const streamId = pendingStreamPick[incomeId];
    if (!streamId) return;
    setResolvingId(incomeId);
    try {
      await api.patch(`/income/${incomeId}/resolve`, { streamId: Number(streamId) });
      await refreshAfterResolve();
    } finally {
      setResolvingId(null);
    }
  };

  const handleMarkInternal = async (incomeId: number) => {
    setResolvingId(incomeId);
    try {
      await api.patch(`/income/${incomeId}/resolve`, { notIncome: true });
      await refreshAfterResolve();
    } finally {
      setResolvingId(null);
    }
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [streamFormOpen, setStreamFormOpen] = useState(false);
  const [editingStreamId, setEditingStreamId] = useState<number | null>(null);
  const [streamForm, setStreamForm] = useState<StreamFormState>(emptyStreamForm);
  const [savingStream, setSavingStream] = useState(false);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (income: Income) => {
    setEditingId(income.id);
    setForm({
      amount: String(income.amount),
      description: income.description,
      source: income.source === 'GOPAY' ? 'BCA' : income.source,
      receivedAt: income.receivedAt.slice(0, 10),
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const body = {
        amount: parseFloat(form.amount) || 0,
        description: form.description,
        source: form.source,
        receivedAt: new Date(form.receivedAt).toISOString(),
      };
      if (editingId) {
        await api.put(`/income/${editingId}`, body);
      } else {
        await api.post('/income', body);
      }
      await Promise.all([mutate(), mutateWeek()]);
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/income/${id}`);
    mutate();
    mutateWeek();
  };

  const openCreateStreamForm = () => {
    setEditingStreamId(null);
    setStreamForm(emptyStreamForm);
    setStreamFormOpen(true);
  };

  const openEditStreamForm = (s: IncomeStream) => {
    setEditingStreamId(s.id);
    setStreamForm(streamToForm(s));
    setStreamFormOpen(true);
  };

  const closeStreamForm = () => {
    setStreamFormOpen(false);
    setEditingStreamId(null);
  };

  const handleStreamSubmit = async () => {
    setSavingStream(true);
    try {
      const body = formToPayload(streamForm);
      if (editingStreamId) {
        await api.put(`/income-streams/${editingStreamId}`, body);
      } else {
        await api.post('/income-streams', body);
      }
      await Promise.all([mutateStreams(), mutateWeek()]);
      closeStreamForm();
    } finally {
      setSavingStream(false);
    }
  };

  const handleDeleteStream = async (id: number) => {
    await api.delete(`/income-streams/${id}`);
    mutateStreams();
    mutateWeek();
  };

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: Income[]; sum: number }[] = [];
    const index = new Map<string, number>();
    for (const row of data ?? []) {
      const d = new Date(row.receivedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      if (!index.has(key)) {
        index.set(key, groups.length);
        groups.push({ key, label, items: [], sum: 0 });
      }
      const g = groups[index.get(key)!];
      g.items.push(row);
      g.sum += Number(row.amount);
    }
    return groups;
  }, [data]);

  const monthlyTotals = useMemo(() => {
    if (!horizon) return null;
    return horizon.reduce(
      (acc, w) => ({
        conservative: acc.conservative + w.totals.conservative,
        expected: acc.expected + w.totals.expected,
        max: acc.max + w.totals.max,
      }),
      { conservative: 0, expected: 0, max: 0 },
    );
  }, [horizon]);

  const weekReceivedRatio = week && week.totals.expected > 0 ? Math.min(1, week.totals.received / week.totals.expected) : 0;
  const activeStreams = (streams ?? []).filter((s) => s.isActive && s.kind !== 'IRREGULAR');
  const irregularStreams = (streams ?? []).filter((s) => s.kind === 'IRREGULAR');
  const inactiveStreams = (streams ?? []).filter((s) => !s.isActive);

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <Link href="/app/more" aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Kelola arus masuk</p>
          <h1 className="font-title text-title font-bold text-ink">Pemasukan</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {/* Hero: minggu ini */}
        {week && (
          <section className="flex flex-col gap-3 rounded-medium bg-surface p-5">
            <div>
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                Minggu ini ({new Date(week.weekStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
              </p>
              <div className="flex items-baseline gap-1.5">
                <AnimatedAmount
                  value={week.totals.received}
                  className="font-title text-amount font-black tracking-[-1px] tabular-nums text-status-under"
                />
                <span className="text-small text-ink-muted">masuk dari perkiraan {formatRupiah(week.totals.expected)}</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-track">
              <div
                className="h-full rounded-full bg-status-under transition-[width] duration-slow ease-expressive"
                style={{ width: `${Math.round(weekReceivedRatio * 100)}%` }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {week.streams
                .filter((s) => s.kind !== 'IRREGULAR')
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-standard px-1 py-1.5">
                    <span className="min-w-0 truncate text-small font-bold text-ink">{s.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-small tabular-nums text-ink-muted">
                        {formatRupiah(s.received)}
                        {s.expected > 0 ? ` / ${formatRupiah(s.expected)}` : ''}
                      </span>
                      <span className={`whitespace-nowrap rounded-subtle px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps ${STATUS_TONE[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
            <Link
              href="/app/income/checkin"
              className="flex items-center justify-center rounded-comfortable bg-surface-interactive px-4 py-2.5 text-small font-bold text-ink hover:bg-surface-alt"
            >
              Check-in pemasukan minggu ini
            </Link>
          </section>
        )}

        {/* Perlu dicek: income PENDING dari auto-capture (E02-S1) — bukan cocok stream & bukan internal */}
        {pending && pending.length > 0 && (
          <section className="flex flex-col gap-3 rounded-medium bg-surface p-5">
            <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
              Perlu dicek ({pending.length})
            </p>
            <div ref={pendingParent} className="flex flex-col gap-3">
              {pending.map((income) => (
                <div key={income.id} className="flex flex-col gap-2 rounded-comfortable bg-surface-interactive p-3.5">
                  <p className="text-small leading-relaxed text-ink">
                    <span className="font-bold tabular-nums text-status-under">+{formatRupiah(income.amount)}</span> dari{' '}
                    <span className="font-bold">{income.description}</span> — ini pemasukan apa?
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pendingStreamPick[income.id] ?? ''}
                      onChange={(e) => setPendingStreamPick((m) => ({ ...m, [income.id]: e.target.value }))}
                      className="min-w-0 flex-1 appearance-none rounded-subtle bg-surface px-3 py-2 text-small text-ink shadow-field outline-none"
                    >
                      <option value="">Pilih sumber…</option>
                      {(streams ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="dark"
                      onClick={() => handleConfirmStream(income.id)}
                      disabled={resolvingId === income.id || !pendingStreamPick[income.id]}
                    >
                      Simpan
                    </Button>
                    <button
                      onClick={() => handleMarkInternal(income.id)}
                      disabled={resolvingId === income.id}
                      className="text-small font-bold text-ink-muted hover:text-ink"
                    >
                      Bukan pemasukan (internal)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Perkiraan: konservatif / ekspektasi / maks */}
        {week && (
          <section className="flex flex-col gap-3 rounded-medium bg-surface p-5">
            <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Perkiraan minggu ini</p>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Konservatif" value={formatRupiah(week.totals.conservative)} tone="muted" size="body" />
              <StatTile label="Ekspektasi" value={formatRupiah(week.totals.expected)} tone="under" size="body" />
              <StatTile label="Maks" value={formatRupiah(week.totals.max)} tone="base" size="body" />
            </div>
            <p className="text-small leading-relaxed text-ink-muted">
              Konservatif = skenario terburuk (absen/sesi paling sedikit). Maks = semua sumber penuh. Ekspektasi = perkiraan paling realistis.
            </p>
            {monthlyTotals && (
              <>
                <div className="my-1 h-px bg-line" />
                <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Perkiraan ~4 minggu ke depan</p>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="Konservatif" value={formatRupiah(monthlyTotals.conservative)} tone="muted" size="body" />
                  <StatTile label="Ekspektasi" value={formatRupiah(monthlyTotals.expected)} tone="under" size="body" />
                  <StatTile label="Maks" value={formatRupiah(monthlyTotals.max)} tone="base" size="body" />
                </div>
              </>
            )}
            {week.upsideMonthly > 0 && (
              <div className="flex items-start gap-2.5 rounded-comfortable bg-surface-interactive p-3.5">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
                <p className="text-small leading-relaxed text-ink-muted">
                  Ada tambahan rata-rata <span className="font-bold text-ink">{formatRupiah(week.upsideMonthly)}/bulan</span> dari pemasukan tak terduga
                  ({irregularStreams.map((s) => s.name).join(', ') || 'project'}) — tidak dihitung di angka di atas karena tidak bisa diandalkan.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Kelola sumber pemasukan */}
        <section className="flex flex-col gap-3 rounded-medium bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Sumber pemasukan</p>
            <button onClick={openCreateStreamForm} className="flex items-center gap-1 text-small font-bold text-brand hover:brightness-110">
              <Plus size={14} /> Tambah
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {[...activeStreams, ...irregularStreams, ...inactiveStreams].map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-standard px-2 py-2.5 transition-colors duration-fast ease-standard hover:bg-white/[0.07] ${
                  !s.isActive ? 'opacity-50' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body font-bold text-ink">{s.name}</span>
                    <span className="whitespace-nowrap rounded-subtle bg-track px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-ink-muted">
                      {KIND_LABEL[s.kind]}
                    </span>
                    {!s.isActive && <span className="whitespace-nowrap text-micro font-bold uppercase tracking-caps text-ink-subtle">nonaktif</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-small text-ink-muted">{streamSummary(s)}</span>
                </span>
                <button
                  onClick={() => openEditStreamForm(s)}
                  aria-label="Edit sumber"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteStream(s.id)}
                  aria-label="Hapus sumber"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {streams && streams.length === 0 && <p className="px-2 py-3 text-small text-ink-muted">Belum ada sumber pemasukan.</p>}
          </div>

          <AnimatePresence initial={false}>
            {streamFormOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={TRANSITION_SLOW}
                className="overflow-hidden rounded-comfortable bg-surface-interactive"
              >
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-label font-bold text-ink">{editingStreamId ? 'Edit sumber' : 'Tambah sumber'}</h2>
                    <button onClick={closeStreamForm} aria-label="Tutup" className="text-ink-muted hover:text-ink">
                      <X size={18} />
                    </button>
                  </div>

                  <Input
                    label="Nama"
                    placeholder="Les Privat, Gaji, dll"
                    value={streamForm.name}
                    onChange={(e) => setStreamForm((f) => ({ ...f, name: e.target.value }))}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Jenis</span>
                      <select
                        value={streamForm.kind}
                        onChange={(e) => {
                          const kind = e.target.value as IncomeKind;
                          setStreamForm((f) => ({
                            ...f,
                            kind,
                            cadence: kind === 'VARIABLE' ? 'MONTHLY' : kind === 'IRREGULAR' ? 'NONE' : 'WEEKLY',
                          }));
                        }}
                        className="w-full appearance-none rounded-comfortable bg-surface px-3.5 py-3 text-body text-ink shadow-field outline-none"
                      >
                        {(Object.keys(KIND_LABEL) as IncomeKind[]).map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Jadwal</span>
                      <select
                        value={streamForm.cadence}
                        onChange={(e) => setStreamForm((f) => ({ ...f, cadence: e.target.value as IncomeCadence }))}
                        disabled={streamForm.kind === 'IRREGULAR' || streamForm.kind === 'VARIABLE'}
                        className="w-full appearance-none rounded-comfortable bg-surface px-3.5 py-3 text-body text-ink shadow-field outline-none disabled:opacity-50"
                      >
                        {(Object.keys(CADENCE_LABEL) as IncomeCadence[]).map((c) => (
                          <option key={c} value={c}>
                            {CADENCE_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Rekening tujuan</span>
                    <select
                      value={streamForm.source}
                      onChange={(e) => setStreamForm((f) => ({ ...f, source: e.target.value as 'BCA' | 'JAGO' }))}
                      className="w-full appearance-none rounded-comfortable bg-surface px-3.5 py-3 text-body text-ink shadow-field outline-none"
                    >
                      <option value="BCA">BCA</option>
                      <option value="JAGO">Jago</option>
                    </select>
                  </label>

                  {streamForm.cadence === 'WEEKLY' && (
                    <label className="flex flex-col gap-2">
                      <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Hari biasa diterima</span>
                      <select
                        value={streamForm.payDayOfWeek}
                        onChange={(e) => setStreamForm((f) => ({ ...f, payDayOfWeek: e.target.value }))}
                        className="w-full appearance-none rounded-comfortable bg-surface px-3.5 py-3 text-body text-ink shadow-field outline-none"
                      >
                        <option value="">— tidak tentu —</option>
                        {DAY_NAMES.map((d, i) => (
                          <option key={i} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {streamForm.cadence === 'MONTHLY' && (
                    <Input
                      label="Tanggal biasa diterima (1-31)"
                      type="number"
                      inputMode="numeric"
                      value={streamForm.payDayOfMonth}
                      onChange={(e) => setStreamForm((f) => ({ ...f, payDayOfMonth: e.target.value }))}
                    />
                  )}

                  {(streamForm.kind === 'FIXED' || streamForm.kind === 'DEDUCTION' || streamForm.kind === 'VARIABLE') && (
                    <Input
                      label={streamForm.kind === 'DEDUCTION' ? 'Nominal maks (tanpa absen)' : streamForm.kind === 'VARIABLE' ? 'Estimasi nominal bulanan' : 'Nominal'}
                      type="number"
                      inputMode="numeric"
                      prefix="Rp"
                      value={streamForm.amount}
                      onChange={(e) => setStreamForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  )}

                  {streamForm.kind === 'SESSION' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Rate per sesi"
                          type="number"
                          inputMode="numeric"
                          prefix="Rp"
                          value={streamForm.sessionRate}
                          onChange={(e) => setStreamForm((f) => ({ ...f, sessionRate: e.target.value }))}
                        />
                        <Input
                          label="Ekstra sesi offline"
                          type="number"
                          inputMode="numeric"
                          prefix="Rp"
                          value={streamForm.sessionExtra}
                          onChange={(e) => setStreamForm((f) => ({ ...f, sessionExtra: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Maks sesi/minggu"
                          type="number"
                          inputMode="numeric"
                          value={streamForm.maxUnits}
                          onChange={(e) => setStreamForm((f) => ({ ...f, maxUnits: e.target.value }))}
                        />
                        <Input
                          label="Biasanya berapa sesi"
                          type="number"
                          inputMode="numeric"
                          value={streamForm.typicalUnits}
                          onChange={(e) => setStreamForm((f) => ({ ...f, typicalUnits: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  {streamForm.kind === 'DEDUCTION' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Potongan per hari absen"
                        type="number"
                        inputMode="numeric"
                        prefix="Rp"
                        value={streamForm.deductionPerUnit}
                        onChange={(e) => setStreamForm((f) => ({ ...f, deductionPerUnit: e.target.value }))}
                      />
                      <Input
                        label="Hari kerja/minggu"
                        type="number"
                        inputMode="numeric"
                        value={streamForm.maxUnits}
                        onChange={(e) => setStreamForm((f) => ({ ...f, maxUnits: e.target.value }))}
                      />
                    </div>
                  )}

                  <Input
                    label="Kata kunci pengirim (opsional, pisah koma)"
                    placeholder="mis. NAMA ORTU"
                    value={streamForm.matchKeywords}
                    onChange={(e) => setStreamForm((f) => ({ ...f, matchKeywords: e.target.value }))}
                    hint="Dipakai nanti buat auto-link notifikasi masuk ke sumber ini."
                  />

                  <label className="flex items-center justify-between rounded-comfortable bg-surface px-3.5 py-3">
                    <span className="text-small font-bold text-ink">Aktif</span>
                    <input
                      type="checkbox"
                      checked={streamForm.isActive}
                      onChange={(e) => setStreamForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="h-5 w-5 accent-brand"
                    />
                  </label>

                  <Button variant="primary" fullWidth onClick={handleStreamSubmit} disabled={savingStream || !streamForm.name}>
                    {savingStream ? 'Menyimpan...' : editingStreamId ? 'Simpan perubahan' : 'Tambah sumber'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Entri manual */}
        <div className="flex gap-1 rounded-comfortable bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`flex-1 rounded-subtle px-2 py-2 text-small font-bold transition-colors ${
                period === p.id ? 'bg-surface-interactive text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {formOpen ? (
            <motion.section
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={TRANSITION_SLOW}
              className="overflow-hidden rounded-comfortable bg-surface"
            >
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-label font-bold text-ink">{editingId ? 'Edit pemasukan' : 'Tambah pemasukan manual'}</h2>
                  <button onClick={closeForm} aria-label="Tutup" className="text-ink-muted hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
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
                  placeholder="Gaji, transfer, freelance…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <label className="flex flex-col gap-2">
                  <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Sumber</span>
                  <span className="relative flex items-center">
                    <select
                      value={form.source}
                      onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as 'BCA' | 'JAGO' }))}
                      className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-3 pr-9 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
                    >
                      <option value="BCA">BCA</option>
                      <option value="JAGO">Jago</option>
                    </select>
                    <span className="pointer-events-none absolute right-3.5 text-small text-ink-muted">▾</span>
                  </span>
                </label>
                <Input
                  label="Tanggal"
                  type="date"
                  value={form.receivedAt}
                  onChange={(e) => setForm((f) => ({ ...f, receivedAt: e.target.value }))}
                />
                <Button variant="primary" fullWidth onClick={handleSubmit} disabled={saving || !form.amount || !form.description}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah pemasukan'}
                </Button>
              </div>
            </motion.section>
          ) : (
            <motion.div key="trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TRANSITION_BASE}>
              <Button variant="dark" fullWidth icon={<Plus size={18} />} onClick={openCreateForm}>
                Tambah pemasukan manual
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <h2 className="text-heading font-semibold text-ink">Riwayat</h2>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-comfortable bg-track" />
            ))}
          </div>
        ) : error ? (
          <p className="text-label text-status-over">Gagal memuat data.</p>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-comfortable p-8 text-center shadow-hairline">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Inbox size={22} />
            </span>
            <p className="text-body font-bold text-ink">Belum ada pemasukan</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">Catat gaji, transfer masuk, atau freelance yang nggak lewat notifikasi email.</p>
          </div>
        ) : (
          <div ref={listParent} className="flex flex-col gap-3">
            {grouped.map((g) => (
              <section key={g.key} className="rounded-comfortable bg-surface p-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-small font-bold uppercase tracking-caps text-ink-muted">{g.label}</p>
                  <p className="text-small font-bold tabular-nums text-status-under">+{formatRupiah(g.sum)}</p>
                </div>
                <ul>
                  {g.items.map((income) => (
                    <li
                      key={income.id}
                      className="flex min-h-[56px] items-center gap-3 rounded-standard px-3 py-2.5 transition-colors duration-fast ease-standard hover:bg-white/[0.07]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-bold text-ink">{income.description}</span>
                        <span className="mt-0.75 flex flex-wrap items-center gap-2">
                          <SourceTag source={income.source} size="sm" />
                          {income.stream && (
                            <span className="whitespace-nowrap rounded-subtle bg-track px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-ink-muted">
                              {income.stream.name}
                            </span>
                          )}
                          {income.status && income.status !== 'CONFIRMED' && (
                            <span className="whitespace-nowrap rounded-subtle bg-status-near-bg px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-status-near">
                              {income.status}
                            </span>
                          )}
                          <span className="text-small tabular-nums text-ink-muted">
                            {new Date(income.receivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-body font-bold tabular-nums text-status-under">+{formatRupiah(income.amount)}</span>
                      <button
                        onClick={() => openEditForm(income)}
                        aria-label="Edit"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(income.id)}
                        aria-label="Hapus"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
