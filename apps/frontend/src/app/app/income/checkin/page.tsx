'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChevronLeft, Minus, Plus } from 'lucide-react';

type IncomeKind = 'FIXED' | 'SESSION' | 'DEDUCTION' | 'VARIABLE' | 'IRREGULAR';

interface CheckinStreamDraft {
  id: number;
  name: string;
  kind: IncomeKind;
  sessionRate: number | null;
  sessionExtra: number | null;
  maxUnits: number | null;
  deductionPerUnit: number | null;
  amount: number | null;
  scheduled: boolean;
  alreadyFilled: boolean;
  recordedAmount: number;
  expected: number;
  max: number;
}

interface CheckinDraft {
  weekStart: string;
  weekEndLabel: string;
  streams: CheckinStreamDraft[];
  totalExpected: number;
  totalRecorded: number;
}

const fetcher = (path: string) => api.get<CheckinDraft>(path);

const KIND_LABEL: Record<IncomeKind, string> = {
  FIXED: 'Tetap',
  SESSION: 'Per sesi',
  DEDUCTION: 'Potongan absen',
  VARIABLE: 'Variabel bulanan',
  IRREGULAR: 'Tak tentu',
};

function Stepper({ value, onChange, min = 0, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-ink disabled:opacity-40"
        aria-label="Kurangi"
      >
        <Minus size={16} />
      </button>
      <span className="w-8 text-center text-body font-bold tabular-nums text-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        disabled={max != null && value >= max}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-ink disabled:opacity-40"
        aria-label="Tambah"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

interface EntryState {
  units: number;
  extraUnits: number;
  amount: string;
}

function emptyEntry(): EntryState {
  return { units: 0, extraUnits: 0, amount: '' };
}

function computeAmount(stream: CheckinStreamDraft, entry: EntryState): number {
  switch (stream.kind) {
    case 'FIXED':
      return stream.amount ?? 0;
    case 'SESSION':
      return entry.units * (stream.sessionRate ?? 0) + Math.min(entry.extraUnits, entry.units) * (stream.sessionExtra ?? 0);
    case 'DEDUCTION':
      return Math.max(0, (stream.amount ?? 0) - entry.units * (stream.deductionPerUnit ?? 0));
    case 'VARIABLE':
    case 'IRREGULAR':
      return parseFloat(entry.amount) || 0;
  }
}

function CheckinPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const week = searchParams.get('week') ?? undefined;

  const path = week ? `/income/checkin?week=${week}` : '/income/checkin';
  const { data: draft, mutate } = useSWR(path, fetcher);

  const [entries, setEntries] = useState<Record<number, EntryState>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const editableStreams = useMemo(
    () => (draft?.streams ?? []).filter((s) => !s.alreadyFilled && (s.scheduled || s.kind === 'IRREGULAR')),
    [draft],
  );

  const getEntry = (id: number) => entries[id] ?? emptyEntry();
  const setEntry = (id: number, patch: Partial<EntryState>) => setEntries((prev) => ({ ...prev, [id]: { ...getEntry(id), ...patch } }));

  const handleSubmit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = editableStreams
        .map((s) => {
          const entry = getEntry(s.id);
          if (s.kind === 'IRREGULAR') {
            const amount = parseFloat(entry.amount) || 0;
            return amount > 0 ? { streamId: s.id, amount } : null;
          }
          if (s.kind === 'VARIABLE') {
            return { streamId: s.id, amount: parseFloat(entry.amount) || 0 };
          }
          if (s.kind === 'SESSION') {
            return { streamId: s.id, units: entry.units, extraUnits: Math.min(entry.extraUnits, entry.units) };
          }
          if (s.kind === 'DEDUCTION') {
            return { streamId: s.id, units: entry.units };
          }
          return { streamId: s.id }; // FIXED
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (payload.length === 0) {
        setDone(true);
        return;
      }

      await api.post('/income/checkin', { week: draft.weekStart, entries: payload });
      await mutate();
      setEntries({});
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <Link href="/app/income" aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Jaring pengaman mingguan</p>
          <h1 className="font-title text-title font-bold text-ink">Check-in Pemasukan</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {!draft ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-comfortable bg-track" />
            ))}
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-1 rounded-medium bg-surface p-5">
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                Minggu {new Date(`${draft.weekStart}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(`${draft.weekEndLabel}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </p>
              <p className="text-small text-ink-muted">
                Perkiraan {formatRupiah(draft.totalExpected)} · Tercatat {formatRupiah(draft.totalRecorded)}
              </p>
            </section>

            {draft.streams
              .filter((s) => s.scheduled || s.kind === 'IRREGULAR')
              .map((s) => {
                if (s.alreadyFilled) {
                  return (
                    <section key={s.id} className="flex items-center justify-between gap-3 rounded-medium bg-surface p-4 opacity-70">
                      <div>
                        <p className="text-body font-bold text-ink">{s.name}</p>
                        <p className="text-small text-ink-muted">{KIND_LABEL[s.kind]}</p>
                      </div>
                      <p className="text-body font-bold tabular-nums text-status-under">✓ {formatRupiah(s.recordedAmount)}</p>
                    </section>
                  );
                }

                const entry = getEntry(s.id);
                const computed = computeAmount(s, entry);

                return (
                  <section key={s.id} className="flex flex-col gap-3 rounded-medium bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-body font-bold text-ink">{s.name}</p>
                      <span className="whitespace-nowrap rounded-subtle bg-track px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-ink-muted">
                        {KIND_LABEL[s.kind]}
                      </span>
                    </div>

                    {s.kind === 'FIXED' && <p className="text-small text-ink-muted">Otomatis tercatat {formatRupiah(s.amount ?? 0)} saat disimpan.</p>}

                    {s.kind === 'DEDUCTION' && (
                      <div className="flex items-center justify-between">
                        <span className="text-small font-bold text-ink-muted">Berapa hari absen?</span>
                        <Stepper value={entry.units} onChange={(v) => setEntry(s.id, { units: v })} max={s.maxUnits ?? undefined} />
                      </div>
                    )}

                    {s.kind === 'SESSION' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-small font-bold text-ink-muted">Jumlah sesi</span>
                          <Stepper value={entry.units} onChange={(v) => setEntry(s.id, { units: v, extraUnits: Math.min(entry.extraUnits, v) })} max={s.maxUnits ?? undefined} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-small font-bold text-ink-muted">Sesi offline (dapat transport)</span>
                          <Stepper value={entry.extraUnits} onChange={(v) => setEntry(s.id, { extraUnits: v })} max={entry.units} />
                        </div>
                      </>
                    )}

                    {(s.kind === 'VARIABLE' || s.kind === 'IRREGULAR') && (
                      <Input
                        label={s.kind === 'VARIABLE' ? 'Nominal bulan ini' : 'Nominal (opsional)'}
                        type="number"
                        inputMode="numeric"
                        prefix="Rp"
                        placeholder={s.kind === 'VARIABLE' ? String(s.expected) : '0'}
                        value={entry.amount}
                        onChange={(e) => setEntry(s.id, { amount: e.target.value })}
                      />
                    )}

                    {s.kind !== 'IRREGULAR' && s.kind !== 'VARIABLE' && (
                      <p className="text-small tabular-nums text-ink-muted">Tercatat: {formatRupiah(computed)}</p>
                    )}
                  </section>
                );
              })}

            {editableStreams.length === 0 ? (
              <p className="rounded-comfortable bg-surface p-4 text-center text-small text-ink-muted">Semua sumber minggu ini sudah tercatat.</p>
            ) : (
              <Button variant="primary" fullWidth onClick={handleSubmit} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan semua'}
              </Button>
            )}

            {done && (
              <div className="flex flex-col gap-2 rounded-comfortable bg-status-under-bg p-4 text-center">
                <p className="text-body font-bold text-status-under">Tersimpan!</p>
                <Button variant="dark" fullWidth onClick={() => router.push('/app/income')}>
                  Lihat Pemasukan
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <Suspense>
      <CheckinPageInner />
    </Suspense>
  );
}
