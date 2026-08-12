'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah, formatTime } from '@/lib/format';

interface Transaction {
  id: number;
  amount: number;
  description: string;
  source: 'BCA' | 'JAGO' | 'GOPAY';
  occurredAt: string;
}

interface TodaySummary {
  date: string;
  budget: number;
  totalSpent: number;
  remaining: number;
  isOverBudget: boolean;
  transactions: Transaction[];
}

const fetcher = (path: string) => api.get<TodaySummary>(path);

export default function TodayPage() {
  const { data, error, isLoading } = useSWR('/budget/today', fetcher, {
    refreshInterval: 60_000, // auto-refresh tiap 1 menit
  });

  if (isLoading) return <p className="text-gray-400 text-sm">Memuat...</p>;
  if (error) return <p className="text-warn text-sm">Gagal memuat data. Cek koneksi ke backend.</p>;
  if (!data) return null;

  const percentage = data.budget > 0 ? Math.min((data.totalSpent / data.budget) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-6 border ${data.isOverBudget ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
        <p className="text-sm text-gray-500 mb-1">Hari ini</p>
        <p className={`text-3xl font-bold ${data.isOverBudget ? 'text-warn' : 'text-gray-900'}`}>
          {formatRupiah(data.totalSpent)}
        </p>
        <p className="text-sm text-gray-500 mt-1">dari budget {formatRupiah(data.budget)}</p>

        <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${data.isOverBudget ? 'bg-warn' : 'bg-good'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {data.isOverBudget ? (
          <p className="text-warn text-sm mt-2 font-medium">
            Lampaui budget {formatRupiah(data.totalSpent - data.budget)}
          </p>
        ) : (
          <p className="text-good text-sm mt-2 font-medium">Sisa {formatRupiah(data.remaining)}</p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Transaksi Hari Ini</h2>
        {data.transactions.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada transaksi tercatat hari ini.</p>
        ) : (
          <div className="space-y-2">
            {data.transactions.map((t) => (
              <div key={t.id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{t.description}</p>
                  <p className="text-xs text-gray-400">
                    {t.source} · {formatTime(t.occurredAt)}
                  </p>
                </div>
                <p className="font-semibold text-sm">{formatRupiah(t.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
