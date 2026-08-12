'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah, DAY_NAMES } from '@/lib/format';

interface DaySummary {
  date: string;
  dayOfWeek: number;
  budget: number;
  totalSpent: number;
  transactions: { id: number; amount: number; description: string; source: string }[];
}

const fetcher = (path: string) => api.get<{ days: DaySummary[] }>(path);

export default function WeeklyPage() {
  const { data, error, isLoading } = useSWR('/transactions/weekly', fetcher);

  if (isLoading) return <p className="text-gray-400 text-sm">Memuat...</p>;
  if (error) return <p className="text-warn text-sm">Gagal memuat data.</p>;
  if (!data) return null;

  const totalBudget = data.days.reduce((s, d) => s + d.budget, 0);
  const totalSpent = data.days.reduce((s, d) => s + d.totalSpent, 0);
  const isToday = (date: string) => date === new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-2xl p-6">
        <p className="text-sm text-gray-500 mb-1">Total minggu ini</p>
        <p className={`text-2xl font-bold ${totalSpent > totalBudget ? 'text-warn' : 'text-gray-900'}`}>
          {formatRupiah(totalSpent)}
        </p>
        <p className="text-sm text-gray-500">dari budget {formatRupiah(totalBudget)}</p>
      </div>

      <div className="space-y-2">
        {data.days.map((day) => {
          const over = day.totalSpent > day.budget;
          const percentage = day.budget > 0 ? Math.min((day.totalSpent / day.budget) * 100, 100) : 0;

          return (
            <div
              key={day.date}
              className={`bg-white border rounded-xl px-4 py-3 ${isToday(day.date) ? 'ring-2 ring-blue-200' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm">
                  {DAY_NAMES[day.dayOfWeek]}
                  <span className="text-gray-400 font-normal ml-2 text-xs">{day.date}</span>
                </p>
                <p className={`text-sm font-semibold ${over ? 'text-warn' : 'text-gray-700'}`}>
                  {formatRupiah(day.totalSpent)} / {formatRupiah(day.budget)}
                </p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${over ? 'bg-warn' : 'bg-good'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
