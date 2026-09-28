'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { DAY_NAMES, formatRupiah, formatRupiahCompact } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { Check, ChevronDown, ChevronUp, AlertTriangle, Sparkles, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyBudget {
  dayOfWeek: number;
  amount: string | number;
}

interface BudgetOptionResult {
  option: 'hemat' | 'seimbang' | 'longgar';
  totalWeekly: number;
  dailyAmounts: number[]; // index 0=Minggu..6=Sabtu
  weeklySavings: number;
  realismFlag: string | null;
}

interface BudgetSuggestionInput {
  expectedIncome: number;
  conservativeIncome: number;
  commitments: number;
  medianRoutineByDow: number[];
  avgRoutinePerDay: number;
}

interface BudgetSuggestion {
  input: BudgetSuggestionInput;
  options: BudgetOptionResult[];
  weekStart: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OPTION_META: Record<string, { label: string; desc: string; color: string; textColor: string }> = {
  hemat: {
    label: 'Hemat',
    desc: 'Kejar goal, dana cadangan 15%',
    color: 'bg-[#1ed760]/10 border border-[#1ed760]/30',
    textColor: 'text-[#1ed760]',
  },
  seimbang: {
    label: 'Seimbang',
    desc: 'Default — cadangan 10%',
    color: 'bg-brand/10 border border-brand/30',
    textColor: 'text-brand',
  },
  longgar: {
    label: 'Longgar',
    desc: 'Ada acara — cadangan 5%',
    color: 'bg-[#ff6b35]/10 border border-[#ff6b35]/30',
    textColor: 'text-[#ff6b35]',
  },
};

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const fetcher = (path: string) => api.get<DailyBudget[]>(path);
const suggestionFetcher = (path: string) => api.get<BudgetSuggestion>(path);

// ─── MiniBar chart per opsi ───────────────────────────────────────────────────

function MiniBarChart({ amounts }: { amounts: number[] }) {
  const max = Math.max(...amounts, 1);
  return (
    <div className="mt-2 flex items-end gap-0.5" style={{ height: 32 }}>
      {amounts.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
          <div
            className="w-full rounded-sm bg-current opacity-60 transition-all duration-slow"
            style={{ height: `${Math.max(4, (v / max) * 28)}px` }}
          />
          <span className="text-[9px] leading-none opacity-50">{DAY_SHORT[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Option Card ──────────────────────────────────────────────────────────────

function OptionCard({
  opt,
  selected,
  onSelect,
}: {
  opt: BudgetOptionResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = OPTION_META[opt.option];
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-comfortable p-4 text-left transition-all duration-base ${
        selected ? meta.color + ' shadow-medium' : 'bg-surface-interactive'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-label font-bold ${selected ? meta.textColor : 'text-ink'}`}>{meta.label}</p>
          <p className="text-micro text-ink-muted">{meta.desc}</p>
        </div>
        {selected && (
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${meta.textColor} border border-current`}>
            <Check size={12} />
          </span>
        )}
      </div>
      <p className={`font-title text-amount font-extrabold tabular-nums ${selected ? meta.textColor : 'text-ink'}`}>
        {formatRupiah(opt.totalWeekly)}
        <span className="text-small font-normal text-ink-muted">/minggu</span>
      </p>
      <p className="text-micro text-ink-muted">
        Tabungan: <span className="font-bold text-ink">{formatRupiah(opt.weeklySavings)}</span>
      </p>
      <div className={selected ? meta.textColor : 'text-ink-muted'}>
        <MiniBarChart amounts={opt.dailyAmounts} />
      </div>
      {opt.realismFlag && (
        <div className="mt-1 flex items-start gap-1.5 rounded-standard bg-[#ff6b35]/10 p-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[#ff6b35]" />
          <p className="text-micro leading-relaxed text-[#ff6b35]">{opt.realismFlag}</p>
        </div>
      )}
    </button>
  );
}

// ─── Suggestions section ──────────────────────────────────────────────────────

function SuggestionsSection({
  suggestion,
  onApplied,
}: {
  suggestion: BudgetSuggestion;
  onApplied: () => void;
}) {
  const [selectedOption, setSelectedOption] = useState<'hemat' | 'seimbang' | 'longgar'>('seimbang');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showBasis, setShowBasis] = useState(false);

  const { input, options, weekStart } = suggestion;

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/budget/apply', { option: selectedOption, week: weekStart });
      setApplied(true);
      onApplied();
      setTimeout(() => setApplied(false), 3000);
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-medium bg-surface p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="shrink-0 text-brand" />
        <p className="text-small font-bold text-ink">Saran minggu ini</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <OptionCard
            key={opt.option}
            opt={opt}
            selected={selectedOption === opt.option}
            onSelect={() => setSelectedOption(opt.option)}
          />
        ))}
      </div>

      {/* Collapsible basis perhitungan */}
      <button
        onClick={() => setShowBasis(!showBasis)}
        className="flex items-center gap-1.5 text-small text-ink-muted hover:text-ink"
      >
        <TrendingDown size={14} />
        <span>Dasar perhitungan</span>
        {showBasis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {showBasis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 rounded-comfortable bg-surface-interactive p-4 text-small">
              <div className="flex justify-between">
                <span className="text-ink-muted">Pemasukan ekspektasi</span>
                <span className="tabular-nums font-bold text-ink">{formatRupiah(input.expectedIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Pemasukan konservatif</span>
                <span className="tabular-nums font-bold text-ink">{formatRupiah(input.conservativeIncome)}</span>
              </div>
              {input.commitments > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Komitmen (langganan jatuh tempo)</span>
                  <span className="tabular-nums font-bold text-ink">{formatRupiah(input.commitments)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-muted">Rata-rata rutin harian (8 minggu)</span>
                <span className="tabular-nums font-bold text-ink">{formatRupiah(Math.round(input.avgRoutinePerDay))}/hari</span>
              </div>
              <div className="mt-1 border-t border-line-subtle pt-2">
                <p className="text-micro text-ink-subtle">
                  Bobot harian dari median pengeluaran rutin 8 minggu (min 40% rata-rata agar weekend tidak 0).
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleApply}
        disabled={applying || applied}
      >
        {applying ? (
          'Menerapkan...'
        ) : applied ? (
          <>
            <Check size={16} /> Diterapkan!
          </>
        ) : (
          `Terapkan opsi ${OPTION_META[selectedOption].label}`
        )}
      </Button>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { data, mutate } = useSWR('/budget', fetcher);
  const { data: suggestion, isLoading: suggestionLoading } = useSWR('/budget/suggestions', suggestionFetcher);
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const initial: Record<number, string> = {};
    for (const b of data) {
      initial[b.dayOfWeek] = String(b.amount);
    }
    setValues(initial);
  }, [data]);

  const handleChange = (dayOfWeek: number, value: string) => {
    setValues((prev) => ({ ...prev, [dayOfWeek]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const budgets = Object.entries(values).map(([dayOfWeek, amount]) => ({
        dayOfWeek: parseInt(dayOfWeek, 10),
        amount: parseInt(amount, 10) || 0,
      }));
      await api.put('/budget', { budgets });
      await mutate();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // Sync values from DB after applying suggestion
  const handleSuggestionApplied = () => mutate();

  const weeklyTotal = Object.values(values).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);

  if (!data) return <BudgetSkeleton />;

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Atur budget</p>
        <h1 className="font-title text-title font-bold text-ink">Budget</h1>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {/* Hero: total budget minggu ini */}
        <section className="rounded-medium bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Total budget minggu ini</p>
          <AnimatedAmount
            value={weeklyTotal}
            className="font-title text-amount-hero font-black tracking-amount tabular-nums text-ink"
          />
        </section>

        {/* Saran AI */}
        {suggestionLoading ? (
          <div className="h-64 animate-pulse rounded-medium bg-track" />
        ) : suggestion ? (
          <SuggestionsSection suggestion={suggestion} onApplied={handleSuggestionApplied} />
        ) : null}

        {/* Edit manual per hari */}
        <section className="rounded-comfortable bg-surface p-4">
          <p className="mb-3 text-small font-bold uppercase tracking-caps text-ink-muted">Edit manual</p>
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <Input
                key={day}
                label={DAY_NAMES[day]}
                type="number"
                inputMode="numeric"
                prefix="Rp"
                value={values[day] ?? ''}
                onChange={(e) => handleChange(day, e.target.value)}
              />
            ))}
          </div>

          <div className="mt-4">
            <Button variant="primary" size="lg" fullWidth onClick={handleSave} disabled={saving}>
              {saving ? (
                'Menyimpan...'
              ) : saved ? (
                <>
                  <Check size={18} /> Tersimpan
                </>
              ) : (
                'Simpan budget'
              )}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="px-4 pb-navbar pt-6">
      <div className="flex flex-col gap-3">
        <div className="h-24 animate-pulse rounded-medium bg-track" />
        <div className="h-64 animate-pulse rounded-comfortable bg-track" />
        <div className="h-80 animate-pulse rounded-comfortable bg-track" />
      </div>
    </div>
  );
}
