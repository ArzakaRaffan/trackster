'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import {
  ChevronLeft,
  Plus,
  Target,
  PiggyBank,
  Archive,
  Calculator,
  X,
  Check,
  Calendar,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  currentAmount: number;
  progress: number;
  createdAt: string;
}

interface SimulationResult {
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  cutPercent: number;
  historicalMonthlySavings: number;
  adjustedMonthlySavings: number;
  currentMonthsRemaining: number | null;
  adjustedMonthsRemaining: number | null;
  monthsSaved: number;
  message?: string;
}

const fetcher = (path: string) => api.get<Goal[]>(path);

export default function GoalsPage() {
  const { data: goals, error, isLoading, mutate } = useSWR('/goal', fetcher);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [contributeModalOpen, setContributeModalOpen] = useState<Goal | null>(null);
  const [simulatingGoal, setSimulatingGoal] = useState<Goal | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const [contributeAmount, setContributeAmount] = useState('');
  const [contributeNote, setContributeNote] = useState('');
  const [savingContribution, setSavingContribution] = useState(false);

  // Simulation state
  const [cutPercent, setCutPercent] = useState(20);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;

    setSavingGoal(true);
    try {
      await api.post('/goal', {
        name: name.trim(),
        targetAmount: parseFloat(targetAmount) || 0,
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
      });
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setCreateModalOpen(false);
      await mutate();
    } finally {
      setSavingGoal(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeModalOpen || !contributeAmount) return;

    setSavingContribution(true);
    try {
      await api.post(`/goal/${contributeModalOpen.id}/contribute`, {
        amount: parseFloat(contributeAmount) || 0,
        note: contributeNote.trim() || undefined,
      });
      setContributeAmount('');
      setContributeNote('');
      setContributeModalOpen(null);
      await mutate();
    } finally {
      setSavingContribution(false);
    }
  };

  const handleArchive = async (id: number) => {
    if (!confirm('Arsipkan target tabungan ini?')) return;
    await api.patch(`/goal/${id}/archive`, {});
    await mutate();
  };

  const runSimulation = async (goalId: number, percent: number) => {
    setSimLoading(true);
    try {
      const res = await api.post<SimulationResult>(`/goal/${goalId}/simulate`, { cutPercent: percent });
      setSimResult(res);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/app/more" aria-label="Kembali" className="text-ink-muted hover:text-ink">
            <ChevronLeft size={22} />
          </Link>
          <div>
            <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Perencanaan</p>
            <h1 className="font-title text-title font-bold text-ink">Target Tabungan (Kantong)</h1>
          </div>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-base transition-colors hover:bg-brand-hover"
          aria-label="Tambah Goal"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-2">
        {isLoading ? (
          <div className="rounded-medium bg-surface p-6 text-center text-ink-muted">Memuat target tabungan...</div>
        ) : error ? (
          <div className="rounded-medium bg-surface p-6 text-center text-status-over">Gagal memuat target tabungan.</div>
        ) : !goals || goals.length === 0 ? (
          <div className="rounded-medium bg-surface p-8 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Target size={24} />
            </span>
            <p className="text-body font-bold text-ink">Belum ada target tabungan</p>
            <p className="mt-1 text-small text-ink-muted">
              Bikin kantong tabungan baru untuk gadget, liburan, atau dana darurat.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-standard bg-brand px-4 py-2 text-small font-bold text-base hover:bg-brand-hover transition-colors"
            >
              <Plus size={16} /> Buat Target Baru
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const remaining = Math.max(0, Number(goal.targetAmount) - goal.currentAmount);
              const isFinished = goal.progress >= 100;

              return (
                <section key={goal.id} className="rounded-medium bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-title text-title font-bold text-ink">{goal.name}</h2>
                      {goal.targetDate && (
                        <p className="mt-0.5 flex items-center gap-1 text-micro text-ink-muted">
                          <Calendar size={12} /> Target:{' '}
                          {new Date(goal.targetDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-micro font-bold ${
                        isFinished ? 'bg-status-under-bg text-status-under' : 'bg-surface-interactive text-ink-muted'
                      }`}
                    >
                      {Math.round(goal.progress)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface-interactive">
                      <div
                        className="h-full rounded-full bg-brand transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                      />
                    </div>
                  </div>

                  {/* Numbers */}
                  <div className="mt-3 flex items-center justify-between text-small">
                    <div>
                      <p className="text-micro text-ink-muted">Terkumpul</p>
                      <p className="font-bold text-ink">{formatRupiah(goal.currentAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-micro text-ink-muted">{isFinished ? 'Status' : 'Sisa Target'}</p>
                      <p className={`font-bold ${isFinished ? 'text-status-under' : 'text-ink-secondary'}`}>
                        {isFinished ? 'Tercapai' : formatRupiah(remaining)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-line-subtle">
                    <button
                      onClick={() => {
                        setContributeModalOpen(goal);
                        setContributeAmount('');
                        setContributeNote('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full-pill bg-brand text-base px-3.5 py-1.5 text-small font-bold hover:brightness-108 transition-all active:scale-[.97]"
                    >
                      <PiggyBank size={15} /> Nabung
                    </button>
                    <button
                      onClick={() => {
                        setSimulatingGoal(goal);
                        setCutPercent(20);
                        runSimulation(goal.id, 20);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full-pill bg-surface-interactive text-ink-muted px-3.5 py-1.5 text-small font-bold hover:text-ink hover:bg-surface-alt transition-colors"
                    >
                      <Calculator size={15} /> Simulasi Cepat
                    </button>
                    <button
                      onClick={() => handleArchive(goal.id)}
                      className="ml-auto inline-flex items-center gap-1 rounded-full text-ink-subtle p-1.5 text-small hover:text-status-over transition-colors"
                      title="Arsipkan"
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah Goal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-panel bg-surface p-5 shadow-heavy animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Target baru</p>
                <h3 className="font-title text-heading font-bold text-ink">Target Tabungan</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-interactive text-ink-muted hover:text-ink"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-small font-bold uppercase tracking-caps text-ink-muted mb-1.5">Nama Target</label>
                <input
                  type="text"
                  placeholder="Misal: Laptop Baru, Liburan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-ink-subtle"
                />
              </div>
              <div>
                <label className="block text-small font-bold uppercase tracking-caps text-ink-muted mb-1.5">Target Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="5000000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                  min="1"
                  className="w-full rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body tabular-nums text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-ink-subtle"
                />
              </div>
              <div>
                <label className="block text-small font-bold uppercase tracking-caps text-ink-muted mb-1.5">Target Tanggal (Opsional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-full-pill px-4 py-2 text-small text-ink-muted hover:text-ink transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingGoal}
                  className="rounded-full-pill bg-brand px-5 py-2 text-small font-bold text-base hover:brightness-108 disabled:opacity-50 transition-all active:scale-[.97]"
                >
                  {savingGoal ? 'Menyimpan...' : 'Simpan Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Tabungan (Contribute) */}
      {contributeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-panel bg-surface p-5 shadow-heavy animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Setor / Tarik</p>
                <h3 className="font-title text-heading font-bold text-ink">{contributeModalOpen.name}</h3>
              </div>
              <button
                onClick={() => setContributeModalOpen(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-interactive text-ink-muted hover:text-ink"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleContribute} className="space-y-4">
              <div>
                <label className="block text-small font-bold uppercase tracking-caps text-ink-muted mb-1.5">Jumlah (Rp)</label>
                <input
                  type="number"
                  placeholder="Positif = nabung, negatif = tarik"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  required
                  className="w-full rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body tabular-nums text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-ink-subtle"
                />
              </div>
              <div>
                <label className="block text-small font-bold uppercase tracking-caps text-ink-muted mb-1.5">Catatan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Misal: Sisihan gaji, bonus"
                  value={contributeNote}
                  onChange={(e) => setContributeNote(e.target.value)}
                  className="w-full rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-ink-subtle"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setContributeModalOpen(null)}
                  className="rounded-full-pill px-4 py-2 text-small text-ink-muted hover:text-ink transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingContribution}
                  className="rounded-full-pill bg-brand px-5 py-2 text-small font-bold text-base hover:brightness-108 disabled:opacity-50 transition-all active:scale-[.97]"
                >
                  {savingContribution ? 'Menyimpan...' : 'Catat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal What-if Simulator */}
      {simulatingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-panel bg-surface p-5 shadow-heavy animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Simulasi target</p>
                <h3 className="font-title text-heading font-bold text-ink">{simulatingGoal.name}</h3>
              </div>
              <button
                onClick={() => setSimulatingGoal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-interactive text-ink-muted hover:text-ink"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-small font-bold text-ink">Potong Pengeluaran Bulanan:</label>
                  <span className="text-label font-bold text-brand">{cutPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={cutPercent}
                  onChange={(e) => {
                    const p = parseInt(e.target.value, 10);
                    setCutPercent(p);
                    runSimulation(simulatingGoal.id, p);
                  }}
                  className="w-full accent-brand cursor-pointer"
                />
                <div className="flex justify-between text-micro text-ink-muted mt-1">
                  <span>5%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>

              {simLoading ? (
                <div className="rounded-comfortable bg-surface-interactive p-4 text-center text-small text-ink-muted">
                  Menghitung simulasi...
                </div>
              ) : simResult ? (
                <div className="rounded-comfortable bg-surface-interactive p-4 space-y-3">
                  <div className="flex items-center gap-2 text-brand font-bold text-body">
                    <Sparkles size={18} />
                    <span>
                      {simResult.monthsSaved > 0
                        ? `Tercapai ${simResult.monthsSaved} bulan lebih cepat`
                        : 'Simulasi waktu capaian'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-small border-t border-line-subtle">
                    <div>
                      <p className="text-micro text-ink-muted">Estimasi Saat Ini</p>
                      <p className="font-bold text-ink">
                        {simResult.currentMonthsRemaining !== null
                          ? `${simResult.currentMonthsRemaining} bulan`
                          : 'Belum ada tabungan rutin'}
                      </p>
                    </div>
                    <div>
                      <p className="text-micro text-ink-muted">Dengan Potong {cutPercent}%</p>
                      <p className="font-bold text-brand">
                        {simResult.adjustedMonthsRemaining !== null
                          ? `${simResult.adjustedMonthsRemaining} bulan`
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <p className="text-micro text-ink-subtle pt-1">
                    Berdasarkan rata-rata pengeluaran dan pemasukan 30 hari terakhir.
                  </p>
                </div>
              ) : null}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSimulatingGoal(null)}
                  className="rounded-full-pill bg-surface-interactive px-4 py-2 text-small font-bold text-ink hover:bg-surface-alt transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
