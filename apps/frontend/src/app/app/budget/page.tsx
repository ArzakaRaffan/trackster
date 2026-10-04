'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { DAY_NAMES, WEEK_ORDER, formatRupiah } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { Check, ChevronDown, AlertTriangle, Sparkles, TrendingDown } from 'lucide-react';

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

interface BudgetAdvice {
  recommended: 'hemat' | 'seimbang' | 'longgar';
  reason: string | null;
  tip: string | null;
}

interface BudgetSuggestion {
  input: BudgetSuggestionInput;
  options: BudgetOptionResult[];
  weekStart: string;
  advice: BudgetAdvice;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OPTION_META: Record<string, { label: string; desc: string; ring: string; textColor: string }> = {
  hemat: {
    label: 'Hemat',
    desc: 'Kejar goal, dana cadangan 15%',
    ring: 'shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]',
    textColor: 'text-brand',
  },
  seimbang: {
    label: 'Seimbang',
    desc: 'Default — cadangan 10%',
    ring: 'shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]',
    textColor: 'text-brand',
  },
  longgar: {
    label: 'Longgar',
    desc: 'Ada acara — cadangan 5%',
    ring: 'shadow-[inset_0_0_0_1px_theme(colors.warning.DEFAULT)]',
    textColor: 'text-warning',
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
      {WEEK_ORDER.map((i) => [i, amounts[i]] as const).map(([i, v]) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
          <div
            className="w-full rounded-subtle bg-current opacity-60 transition-all duration-slow"
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
  recommended,
  onSelect,
}: {
  opt: BudgetOptionResult;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const meta = OPTION_META[opt.option];
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-card p-4 text-left transition-all duration-base ${
        selected ? `${meta.ring} bg-card` : 'bg-neutral hover:bg-neutral-hover'
      }`}
    >
      {recommended && (
        <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-brand">
          <Sparkles size={10} /> Saran Track
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-label font-bold ${selected ? meta.textColor : 'text-text'}`}>{meta.label}</p>
          <p className="text-micro text-text-subtle">{meta.desc}</p>
        </div>
        {selected && (
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current ${meta.textColor}`}>
            <Check size={12} />
          </span>
        )}
      </div>
      <p className={`font-title text-amount font-extrabold tabular-nums ${selected ? meta.textColor : 'text-text'}`}>
        {formatRupiah(opt.totalWeekly)}
        <span className="text-small font-normal text-text-subtle">/minggu</span>
      </p>
      <p className="text-micro text-text-subtle">
        Tabungan: <span className="font-bold text-text">{formatRupiah(opt.weeklySavings)}</span>
      </p>
      <div className={selected ? meta.textColor : 'text-text-subtle'}>
        <MiniBarChart amounts={opt.dailyAmounts} />
      </div>
      {opt.realismFlag && (
        <div className="mt-1 flex items-start gap-1.5 rounded-standard bg-warning-subtle p-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-micro leading-relaxed text-warning">{opt.realismFlag}</p>
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
  const [selectedOption, setSelectedOption] = useState<'hemat' | 'seimbang' | 'longgar'>(
    suggestion.advice?.recommended ?? 'seimbang',
  );
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showBasis, setShowBasis] = useState(false);

  const { input, options, weekStart, advice } = suggestion;

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
    <section className="flex flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="shrink-0 text-brand" />
        <p className="text-small font-bold text-text">Saran minggu ini</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <OptionCard
            key={opt.option}
            opt={opt}
            selected={selectedOption === opt.option}
            recommended={advice?.recommended === opt.option}
            onSelect={() => setSelectedOption(opt.option)}
          />
        ))}
      </div>

      {(advice?.reason || advice?.tip) && (
        <div className="flex flex-col gap-1 rounded-medium bg-brand-subtle p-3">
          {advice.reason && <p className="text-small leading-relaxed text-text">{advice.reason}</p>}
          {advice.tip && <p className="text-micro text-text-subtle">💡 {advice.tip}</p>}
        </div>
      )}

      {/* Collapsible basis perhitungan */}
      <button
        onClick={() => setShowBasis(!showBasis)}
        aria-expanded={showBasis}
        className="flex w-fit items-center gap-1.5 text-small text-text-subtle transition-colors hover:text-text"
      >
        <TrendingDown size={14} />
        <span>Dasar perhitungan</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-base ease-standard ${showBasis ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
        style={{ gridTemplateRows: showBasis ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 rounded-medium bg-neutral p-4 text-small">
            <div className="flex justify-between">
              <span className="text-text-subtle">Pemasukan ekspektasi</span>
              <span className="tabular-nums font-bold text-text">{formatRupiah(input.expectedIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-subtle">Pemasukan konservatif</span>
              <span className="tabular-nums font-bold text-text">{formatRupiah(input.conservativeIncome)}</span>
            </div>
            {input.commitments > 0 && (
              <div className="flex justify-between">
                <span className="text-text-subtle">Komitmen (langganan jatuh tempo)</span>
                <span className="tabular-nums font-bold text-text">{formatRupiah(input.commitments)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-subtle">Rata-rata rutin harian (8 minggu)</span>
              <span className="tabular-nums font-bold text-text">{formatRupiah(Math.round(input.avgRoutinePerDay))}/hari</span>
            </div>
            <div className="mt-1 border-t border-border pt-2">
              <p className="text-micro text-text-subtlest">
                Bobot harian dari median pengeluaran rutin 8 minggu (min 40% rata-rata agar weekend tidak 0).
              </p>
            </div>
          </div>
        </div>
      </div>

      <Button variant="primary" size="lg" fullWidth onClick={handleApply} disabled={applying || applied}>
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
  const { data: suggestion, isLoading: suggestionLoading } = useSWR('/ai/budget-suggestions', suggestionFetcher);
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
  const daily = [0, 1, 2, 3, 4, 5, 6].map((day) => parseInt(values[day] ?? '0', 10) || 0);
  const maxDaily = Math.max(...daily, 1);

  if (!data) return <BudgetSkeleton />;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      <header>
        <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Budget</h1>
        <p className="text-[15px] text-text-subtle">Atur budget harian</p>
      </header>

      {/* Hero: total budget minggu ini + strip 7 hari */}
      <section className="rounded-card-lg bg-card p-6 shadow-card">
        <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Total budget minggu ini</p>
        <AnimatedAmount
          value={weeklyTotal}
          className="font-title text-amount-hero font-black tracking-amount tabular-nums text-text"
        />
        <div className="mt-5 flex items-end gap-1.5">
          {daily.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-14 w-full items-end overflow-hidden rounded-subtle bg-track">
                <div
                  className="w-full rounded-subtle bg-brand transition-all duration-slow ease-expressive"
                  style={{ height: `${Math.max(6, (v / maxDaily) * 100)}%` }}
                />
              </div>
              <span className="text-micro font-bold uppercase tracking-caps text-text-subtle">{DAY_SHORT[i]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Saran AI */}
      {suggestionLoading ? (
        <div className="h-64 animate-pulse rounded-card bg-track" />
      ) : suggestion ? (
        <SuggestionsSection suggestion={suggestion} onApplied={handleSuggestionApplied} />
      ) : null}

      {/* Edit manual per hari — collapsible */}
      <section className="rounded-card-lg bg-card shadow-card">
        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          aria-expanded={editOpen}
          className="flex min-h-[48px] w-full items-center gap-3 px-6 py-3 text-left"
        >
          <span className="flex-1 text-small font-bold uppercase tracking-caps text-text-subtle">Edit manual</span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-text-subtle transition-transform duration-base ease-standard ${
              editOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
          style={{ gridTemplateRows: editOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 px-6 pb-6">
              {WEEK_ORDER.map((day) => (
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

              <div className="mt-2">
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="px-4 pb-navbar pt-6">
      <div className="flex flex-col gap-3">
        <div className="h-24 animate-pulse rounded-card bg-track" />
        <div className="h-64 animate-pulse rounded-card bg-track" />
        <div className="h-80 animate-pulse rounded-card bg-track" />
      </div>
    </div>
  );
}
