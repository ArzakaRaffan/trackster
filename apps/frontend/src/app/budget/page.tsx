'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { DAY_NAMES } from '@/lib/format';

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

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-2xl p-6">
        <p className="text-sm text-gray-500 mb-1">Total budget mingguan</p>
        <p className="text-2xl font-bold">Rp {weeklyTotal.toLocaleString('id-ID')}</p>
      </div>

      <div className="bg-white border rounded-2xl divide-y">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <div key={day} className="flex items-center justify-between px-4 py-3">
            <label className="text-sm font-medium">{DAY_NAMES[day]}</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">Rp</span>
              <input
                type="number"
                className="w-28 border rounded-lg px-2 py-1 text-right text-sm"
                value={values[day] ?? ''}
                onChange={(e) => handleChange(day, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : saved ? 'Tersimpan ✓' : 'Simpan Budget'}
      </button>
    </div>
  );
}
