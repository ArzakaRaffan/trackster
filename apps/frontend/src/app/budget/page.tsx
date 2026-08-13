'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { DAY_NAMES, formatRupiah } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';

interface DailyBudget {
  dayOfWeek: number;
  amount: string | number;
}

const fetcher = (path: string) => api.get<DailyBudget[]>(path);

export default function BudgetPage() {
  const { data, mutate } = useSWR('/budget', fetcher);
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

      <div className="flex flex-col gap-4 px-4">
        <section className="rounded-medium bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Total budget mingguan</p>
          <p className="font-title text-amount-hero font-extrabold tabular-nums text-ink">{formatRupiah(weeklyTotal)}</p>
        </section>

        <div className="flex flex-col gap-3 rounded-comfortable bg-surface p-3.5">
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
      <div className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-medium bg-track" />
        <div className="h-64 animate-pulse rounded-comfortable bg-track" />
      </div>
    </div>
  );
}
