'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { DAY_NAMES } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { Check, Sparkles, PiggyBank } from 'lucide-react';
import { formatRupiah } from '@/lib/format';


interface AllowanceSuggestion {
  windowDays: number;
  totalIncome: number;
  averageDailyIncome: number;
  suggestedDailyAllowance: number;
  savingsFactor: number;
}

interface AllocationPreview {
  weekStart: string;
  totalIncome: number;
  leftover: number;
  isOverspent: boolean;
  savingsRecommendation: number;
  allocation: { needs: number; wants: number; savings: number };
}

interface DailyBudget {
  dayOfWeek: number;
  amount: string | number;
}

const fetcher = (path: string) => api.get<DailyBudget[]>(path);

export default function BudgetPage() {
  const { data, mutate } = useSWR('/budget', fetcher);
  const { data: suggestion } = useSWR<AllowanceSuggestion>('/income/allowance-suggestion', (url: string) => api.get<AllowanceSuggestion>(url));
  const { data: allocation } = useSWR<AllocationPreview>('/budget-allocation/preview', (url: string) => api.get<AllocationPreview>(url));
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

  const weeklyTotal = Object.values(values).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);

  if (!data) return <BudgetSkeleton />;

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Atur budget</p>
        <h1 className="font-title text-title font-bold text-ink">Budget</h1>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <section className="rounded-medium bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Total budget mingguan</p>
          <AnimatedAmount
            value={weeklyTotal}
            className="font-title text-amount-hero font-black tracking-amount tabular-nums text-ink"
          />
        </section>

        {suggestion && suggestion.suggestedDailyAllowance > 0 && (
          <div className="flex items-start gap-3 rounded-comfortable bg-surface-interactive p-4">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <p className="text-label font-bold text-ink">
                Saran Budget Harian: {formatRupiah(suggestion.suggestedDailyAllowance)}
              </p>
              <p className="text-small text-ink-muted leading-relaxed mt-0.5">
                Berdasarkan rata-rata pemasukan Rp {Math.round(suggestion.averageDailyIncome).toLocaleString('id-ID')}/hari dalam {suggestion.windowDays} hari terakhir (disisihkan 30% untuk tabungan).
              </p>
            </div>
          </div>
        )}

        {allocation && allocation.totalIncome > 0 && (
          <div className="flex flex-col gap-3 rounded-comfortable bg-surface p-4">
            <div className="flex items-center gap-2">
              <PiggyBank size={18} className="shrink-0 text-brand" />
              <p className="text-label font-bold text-ink">Alokasi 50/30/20 minggu ini</p>
            </div>
            <p className="text-small text-ink-muted">
              Pemasukan minggu ini: {formatRupiah(allocation.totalIncome)}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-small text-ink-muted">Kebutuhan</p>
                <p className="text-label font-bold tabular-nums text-ink">{formatRupiah(allocation.allocation.needs)}</p>
              </div>
              <div>
                <p className="text-small text-ink-muted">Keinginan</p>
                <p className="text-label font-bold tabular-nums text-ink">{formatRupiah(allocation.allocation.wants)}</p>
              </div>
              <div>
                <p className="text-small text-ink-muted">Tabungan</p>
                <p className="text-label font-bold tabular-nums text-ink">{formatRupiah(allocation.allocation.savings)}</p>
              </div>
            </div>
            {allocation.isOverspent ? (
              <p className="text-small text-status-over">
                ⚠️ Pengeluaran minggu ini sudah lebih besar dari budget yang berlaku — nggak ada sisa buat nabung minggu ini.
              </p>
            ) : (
              <p className="text-small text-ink-muted leading-relaxed">
                Rekomendasi pindah ke Jago minggu depan: <span className="font-bold text-ink">{formatRupiah(allocation.savingsRecommendation)}</span>
                {allocation.leftover > 0 && ` (termasuk sisa budget minggu ini yang nggak kepake: ${formatRupiah(allocation.leftover)})`}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-comfortable bg-surface p-4">
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

        <Button variant="primary" size="lg" fullWidth onClick={handleSave} disabled={saving}>
          {saving ? 'Menyimpan...' : saved ? (
            <>
              <Check size={18} /> Tersimpan
            </>
          ) : (
            'Simpan budget'
          )}
        </Button>
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
      </div>
    </div>
  );
}
