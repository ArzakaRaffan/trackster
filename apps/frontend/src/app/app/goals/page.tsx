'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import {
  Archive,
  Calculator,
  Calendar,
  ChevronLeft,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EASE_ENTER, TRANSITION_FAST } from '@/lib/motion';

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

  const [contributeMode, setContributeMode] = useState<'in' | 'out'>('in');
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributeNote, setContributeNote] = useState('');
  const [savingContribution, setSavingContribution] = useState(false);

  // Simulation state
  const [cutPercent, setCutPercent] = useState(20);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (!createModalOpen && !contributeModalOpen && !simulatingGoal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setCreateModalOpen(false);
      setContributeModalOpen(null);
      setSimulatingGoal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createModalOpen, contributeModalOpen, simulatingGoal]);

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
      const abs = Math.abs(parseFloat(contributeAmount) || 0);
      await api.post(`/goal/${contributeModalOpen.id}/contribute`, {
        amount: contributeMode === 'out' ? -abs : abs,
        note: contributeNote.trim() || undefined,
      });
      setContributeAmount('');
      setContributeNote('');
      setContributeMode('in');
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

  const totalSaved = (goals ?? []).reduce((sum, g) => sum + Number(g.currentAmount), 0);

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/app/more" aria-label="Kembali" className="text-text-subtle hover:text-text">
            <ChevronLeft size={22} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-title text-[32px] font-bold tracking-[-0.02em] text-text">Target Tabungan</h1>
            <p className="text-[15px] text-text-subtle">Perencanaan kantong</p>
          </div>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
          Target baru
        </Button>
      </header>

      {!isLoading && goals && goals.length > 0 && (
        <section className="rounded-card-lg bg-card p-6 shadow-card">
          <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Total terkumpul</p>
          <p className="font-title text-amount-hero font-black tracking-amount tabular-nums text-text">
            {formatRupiah(totalSaved)}
          </p>
        </section>
      )}

      {isLoading ? (
        <div className="rounded-card bg-card p-6 text-center text-text-subtle shadow-card">Memuat target tabungan...</div>
      ) : error ? (
        <div className="rounded-card bg-card p-6 text-center text-status-over shadow-card">Gagal memuat target tabungan.</div>
      ) : !goals || goals.length === 0 ? (
        <div className="rounded-card bg-card p-8 text-center shadow-card">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral text-text-subtle">
            <Target size={24} />
          </span>
          <p className="text-body font-bold text-text">Belum ada target tabungan</p>
          <p className="mt-1 text-small text-text-subtle">
            Bikin kantong tabungan baru untuk gadget, liburan, atau dana darurat.
          </p>
          <div className="mt-4">
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
              Buat Target Baru
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const remaining = Math.max(0, Number(goal.targetAmount) - goal.currentAmount);
            const isFinished = goal.progress >= 100;

            return (
              <section key={goal.id} className="rounded-card bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-title text-title font-bold text-text">{goal.name}</h2>
                    {goal.targetDate && (
                      <p className="mt-0.5 flex items-center gap-1 text-micro text-text-subtle">
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
                    className={`rounded-pill px-2.5 py-0.5 text-micro font-bold ${
                      isFinished ? 'bg-status-under-bg text-status-under' : 'bg-neutral text-text-subtle'
                    }`}
                  >
                    {Math.round(goal.progress)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="h-3 w-full overflow-hidden rounded-pill bg-track">
                    <div
                      className="h-full rounded-pill bg-brand transition-all duration-slow ease-expressive"
                      style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                    />
                  </div>
                </div>

                {/* Numbers */}
                <div className="mt-3 flex items-center justify-between text-small">
                  <div>
                    <p className="text-micro text-text-subtle">Terkumpul</p>
                    <p className="font-bold text-text">{formatRupiah(goal.currentAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-micro text-text-subtle">{isFinished ? 'Status' : 'Sisa Target'}</p>
                    <p className={`font-bold ${isFinished ? 'text-status-under' : 'text-text'}`}>
                      {isFinished ? 'Tercapai' : formatRupiah(remaining)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<PiggyBank size={15} />}
                    onClick={() => {
                      setContributeModalOpen(goal);
                      setContributeAmount('');
                      setContributeNote('');
                      setContributeMode('in');
                    }}
                  >
                    Nabung
                  </Button>
                  <Button
                    variant="dark"
                    size="sm"
                    icon={<Calculator size={15} />}
                    onClick={() => {
                      setSimulatingGoal(goal);
                      setCutPercent(20);
                      runSimulation(goal.id, 20);
                    }}
                  >
                    Simulasi Cepat
                  </Button>
                  <button
                    onClick={() => handleArchive(goal.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-pill p-1.5 text-small text-text-subtle hover:text-status-over"
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

      {/* Modal Tambah Goal */}
      <AnimatePresence>
        {createModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FAST}
            onClick={() => setCreateModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.form
              onSubmit={handleCreateGoal}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              className="flex w-full max-w-[480px] flex-col gap-3 rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Target baru</p>
                  <h3 className="font-title text-heading font-bold text-text">Target Tabungan</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral text-text-subtle hover:text-text"
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>
              <Input label="Nama Target" placeholder="Misal: Laptop Baru, Liburan" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="Target Nominal (Rp)"
                type="number"
                placeholder="5000000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
                min="1"
              />
              <Input label="Target Tanggal (Opsional)" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              <Button type="submit" variant="primary" fullWidth disabled={savingGoal}>
                {savingGoal ? 'Menyimpan...' : 'Simpan Target'}
              </Button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Catat Tabungan (Contribute) */}
      <AnimatePresence>
        {contributeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FAST}
            onClick={() => setContributeModalOpen(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.form
              onSubmit={handleContribute}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              className="flex w-full max-w-[480px] flex-col gap-3 rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Setor / Tarik</p>
                  <h3 className="font-title text-heading font-bold text-text">{contributeModalOpen.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setContributeModalOpen(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral text-text-subtle hover:text-text"
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-1 rounded-full-pill bg-neutral p-1">
                {(['in', 'out'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setContributeMode(m)}
                    className={`flex-1 rounded-full-pill px-3 py-1.5 text-small font-bold transition-colors duration-fast ease-standard ${
                      contributeMode === m ? 'bg-card text-text shadow-card' : 'text-text-subtle hover:text-text'
                    }`}
                  >
                    {m === 'in' ? 'Nabung' : 'Tarik'}
                  </button>
                ))}
              </div>

              <Input
                label="Jumlah (Rp)"
                type="number"
                placeholder="500000"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                required
                min="1"
              />
              <Input
                label="Catatan (Opsional)"
                placeholder="Misal: Sisihan gaji, bonus"
                value={contributeNote}
                onChange={(e) => setContributeNote(e.target.value)}
              />
              <Button type="submit" variant="primary" fullWidth disabled={savingContribution}>
                {savingContribution ? 'Menyimpan...' : contributeMode === 'in' ? 'Catat Nabung' : 'Catat Tarik'}
              </Button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal What-if Simulator */}
      <AnimatePresence>
        {simulatingGoal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FAST}
            onClick={() => setSimulatingGoal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              className="flex max-h-[85vh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Simulasi target</p>
                  <h3 className="font-title text-heading font-bold text-text">{simulatingGoal.name}</h3>
                </div>
                <button
                  onClick={() => setSimulatingGoal(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral text-text-subtle hover:text-text"
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-small font-bold text-text">Potong Pengeluaran Bulanan:</label>
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
                    className="w-full cursor-pointer accent-brand"
                  />
                  <div className="mt-1 flex justify-between text-micro text-text-subtle">
                    <span>5%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>

                {simLoading ? (
                  <div className="rounded-medium bg-neutral p-4 text-center text-small text-text-subtle">
                    Menghitung simulasi...
                  </div>
                ) : simResult ? (
                  <div className="space-y-3 rounded-medium bg-neutral p-4">
                    <div className="flex items-center gap-2 text-brand font-bold text-body">
                      <Sparkles size={18} />
                      <span>
                        {simResult.monthsSaved > 0
                          ? `Tercapai ${simResult.monthsSaved} bulan lebih cepat`
                          : 'Simulasi waktu capaian'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-border pt-2 text-small">
                      <div>
                        <p className="text-micro text-text-subtle">Estimasi Saat Ini</p>
                        <p className="font-bold text-text">
                          {simResult.currentMonthsRemaining !== null
                            ? `${simResult.currentMonthsRemaining} bulan`
                            : 'Belum ada tabungan rutin'}
                        </p>
                      </div>
                      <div>
                        <p className="text-micro text-text-subtle">Dengan Potong {cutPercent}%</p>
                        <p className="font-bold text-brand">
                          {simResult.adjustedMonthsRemaining !== null
                            ? `${simResult.adjustedMonthsRemaining} bulan`
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <p className="text-micro text-text-subtlest">
                      Berdasarkan rata-rata pengeluaran dan pemasukan 30 hari terakhir.
                    </p>
                  </div>
                ) : null}

                <Button variant="dark" fullWidth onClick={() => setSimulatingGoal(null)}>
                  Tutup
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
