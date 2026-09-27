'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Minus, Plus } from 'lucide-react';

type IncomeKind = 'FIXED' | 'SESSION' | 'DEDUCTION' | 'VARIABLE';

interface CheckinStreamDraft {
  id: number;
  name: string;
  kind: IncomeKind;
  amount: number | null;
  sessionRate: number | null;
  sessionExtra: number | null;
  maxUnits: number | null;
  deductionPerUnit: number | null;
  conservative: number;
  expected: number;
  max: number;
  recordedAmount: number;
  recorded: boolean;
}

interface CheckinDraft {
  weekStart: string;
  weekEnd: string;
  totalExpected: number;
  totalRecorded: number;
  streams: CheckinStreamDraft[];
}

const KIND_LABEL: Record<IncomeKind, string> = {
  FIXED: 'Tetap',
  SESSION: 'Per sesi',
  DEDUCTION: 'Potongan absen',
  VARIABLE: 'Bulanan',
};

interface EntryState {
  units?: number;
  extraUnits?: number;
  amount?: string;
  include: boolean;
}

function previewAmount(stream: CheckinStreamDraft, entry: EntryState): number {
  switch (stream.kind) {
    case 'FIXED':
      return stream.amount ?? 0;
    case 'SESSION': {
      const units = entry.units ?? 0;
      const extraUnits = entry.extraUnits ?? 0;
      return units * (stream.sessionRate ?? 0) + extraUnits * (stream.sessionExtra ?? 0);
    }
    case 'DEDUCTION': {
      const absences = entry.units ?? 0;
      return Math.max(0, (stream.amount ?? 0) - absences * (stream.deductionPerUnit ?? 0));
    }
    case 'VARIABLE':
      return entry.amount ? Number(entry.amount) : (stream.amount ?? 0);
  }
}

function Stepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-comfortable bg-surface-interactive px-2 py-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        aria-label="Kurangi"
      >
        <Minus size={16} />
      </button>
      <span className="w-6 text-center text-body font-bold tabular-nums text-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        aria-label="Tambah"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

function CheckinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const week = searchParams.get('week') ?? undefined;

  const path = week ? `/income/checkin?week=${week}` : '/income/checkin';
  const { data: draft, error, isLoading, mutate } = useSWR<CheckinDraft>(path, (p: string) => api.get<CheckinDraft>(p));

  const [entries, setEntries] = useState<Record<number, EntryState>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const setEntry = (streamId: number, patch: Partial<EntryState>) => {
    setEntries((prev) => ({ ...prev, [streamId]: { ...prev[streamId], ...patch, include: true } }));
  };

  const pendingStreams = useMemo(() => (draft?.streams ?? []).filter((s) => !s.recorded), [draft]);
  const includedCount = pendingStreams.filter((s) => entries[s.id]?.include).length;

  const handleSubmit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        week: draft.weekStart,
        entries: pendingStreams
          .filter((s) => entries[s.id]?.include)
          .map((s) => {
            const e = entries[s.id];
            return {
              streamId: s.id,
              units: e.units,
              extraUnits: e.extraUnits,
              amount: e.amount ? Number(e.amount) : undefined,
            };
          }),
      };
      if (body.entries.length === 0) return;
      await api.post('/income/checkin', body);
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
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Isi cepat, &lt; 30 detik</p>
          <h1 className="font-title text-title font-bold text-ink">Check-in Pemasukan</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-comfortable bg-track" />
            ))}
          </div>
        ) : error || !draft ? (
          <p className="text-label text-status-over">Gagal memuat data.</p>
        ) : (
          <>
            <section className="flex flex-col gap-2 rounded-medium bg-surface p-5">
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                Minggu {new Date(draft.weekStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(draft.weekEnd).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </p>
              <p className="text-small text-ink-muted">
                Perkiraan {formatRupiah(draft.totalExpected)} · Tercatat {formatRupiah(draft.totalRecorded)}
              </p>
            </section>

            {draft.streams
              .filter((s) => s.recorded)
              .map((s) => (
                <section key={s.id} className="flex items-center justify-between gap-2 rounded-comfortable bg-surface p-4 opacity-60">
                  <span className="text-body font-bold text-ink">{s.name}</span>
                  <span className="text-small font-bold tabular-nums text-status-under">✓ {formatRupiah(s.recordedAmount)}</span>
                </section>
              ))}

            {pendingStreams.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-comfortable bg-surface p-8 text-center">
                <p className="text-body font-bold text-ink">Semua sudah tercatat 🎉</p>
                <p className="text-small text-ink-muted">Nggak ada yang perlu diisi minggu ini.</p>
              </div>
            ) : (
              pendingStreams.map((s) => {
                const entry = entries[s.id] ?? { include: false };
                const preview = previewAmount(s, entry);
                return (
                  <section key={s.id} className="flex flex-col gap-3 rounded-medium bg-surface p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body font-bold text-ink">{s.name}</p>
                        <p className="text-small text-ink-muted">
                          {KIND_LABEL[s.kind]} · perkiraan {formatRupiah(s.expected)}
                        </p>
                      </div>
                      <span className="text-body font-bold tabular-nums text-status-under">{formatRupiah(preview)}</span>
                    </div>

                    {s.kind === 'FIXED' && (
                      <Button
                        variant={entry.include ? 'primary' : 'dark'}
                        fullWidth
                        onClick={() => setEntry(s.id, {})}
                      >
                        {entry.include ? '✓ Ditandai sudah masuk' : 'Tandai sudah masuk'}
                      </Button>
                    )}

                    {s.kind === 'SESSION' && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-small font-bold text-ink-muted">Berapa sesi?</span>
                          <Stepper value={entry.units ?? 0} max={s.maxUnits ?? undefined} onChange={(n) => setEntry(s.id, { units: n })} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-small font-bold text-ink-muted">Berapa sesi offline?</span>
                          <Stepper
                            value={entry.extraUnits ?? 0}
                            max={entry.units ?? 0}
                            onChange={(n) => setEntry(s.id, { extraUnits: n })}
                          />
                        </div>
                      </div>
                    )}

                    {s.kind === 'DEDUCTION' && (
                      <div className="flex items-center justify-between">
                        <span className="text-small font-bold text-ink-muted">Berapa hari absen?</span>
                        <Stepper value={entry.units ?? 0} onChange={(n) => setEntry(s.id, { units: n })} />
                      </div>
                    )}

                    {s.kind === 'VARIABLE' && (
                      <Input
                        label="Nominal aktual bulan ini"
                        type="number"
                        inputMode="numeric"
                        prefix="Rp"
                        placeholder={String(s.amount ?? '')}
                        value={entry.amount ?? ''}
                        onChange={(e) => setEntry(s.id, { amount: e.target.value })}
                      />
                    )}
                  </section>
                );
              })
            )}

            {pendingStreams.length > 0 && (
              <Button variant="primary" fullWidth onClick={handleSubmit} disabled={saving || includedCount === 0}>
                {saving ? 'Menyimpan...' : `Simpan ${includedCount > 0 ? `(${includedCount})` : ''}`}
              </Button>
            )}

            {done && (
              <Button variant="outlined" fullWidth onClick={() => router.push('/app/income')}>
                Selesai — lihat Pemasukan
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function IncomeCheckinPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-small text-ink-muted">Memuat...</div>}>
      <CheckinContent />
    </Suspense>
  );
}
