'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { StatTile } from '@/components/ui/StatTile';
import { DayBarChart } from '@/components/ui/DayBarChart';
import { TransactionNoteRow } from '@/components/ui/TransactionNoteRow';

interface DayTransaction {
  id: number;
  amount: number;
  description: string;
  source: string;
  occurredAt: string;
  note?: string | null;
  category?: string;
}

interface DaySummary {
  date: string;
  dayOfWeek: number;
  budget: number;
  totalSpent: number;
  transactions: DayTransaction[];
}

const SHORT_DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const fetcher = (path: string) => api.get<{ days: DaySummary[] }>(path);

export default function WeeklyPage() {
  const { data, error, isLoading, mutate } = useSWR('/transactions/weekly', fetcher);

  if (isLoading) return <WeeklySkeleton />;
  if (error)
    return (
      <div className="px-4 pb-navbar pt-6">
        <p className="text-label text-status-over">Gagal memuat data.</p>
      </div>
    );
  if (!data) return null;

  const totalBudget = data.days.reduce((s, d) => s + d.budget, 0);
  const totalSpent = data.days.reduce((s, d) => s + d.totalSpent, 0);
  const remaining = totalBudget - totalSpent;
  const isToday = (date: string) => date === new Date().toISOString().slice(0, 10);

  const chartDays = data.days.map((d) => ({
    label: SHORT_DAY[d.dayOfWeek],
    spent: d.totalSpent,
    budget: d.budget,
    isOverBudget: d.totalSpent > d.budget,
    isToday: isToday(d.date),
  }));

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">7 hari terakhir</p>
        <h1 className="font-title text-title font-bold text-ink">Mingguan</h1>
      </header>

      <div className="flex flex-col gap-4 px-4">
        <section className="rounded-medium bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Total minggu ini</p>
          <p className={`font-title text-amount font-extrabold tabular-nums ${totalSpent > totalBudget ? 'text-status-over' : 'text-ink'}`}>
            {formatRupiah(totalSpent)}
          </p>

          <div className="mt-5">
            <DayBarChart days={chartDays} />
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label="Budget" value={formatRupiah(totalBudget)} size="heading" />
          <StatTile
            label={remaining < 0 ? 'Lewat' : 'Sisa'}
            value={formatRupiah(Math.abs(remaining))}
            tone={remaining < 0 ? 'over' : 'under'}
            size="heading"
          />
          <StatTile label="Rata-rata" value={formatRupiah(totalSpent / data.days.length)} tone="muted" size="heading" />
        </div>

        <h2 className="text-heading font-semibold text-ink">Per hari</h2>

        <ul className="flex flex-col gap-2">
          {data.days.map((d) => {
            const over = d.totalSpent > d.budget;
            const ratio = d.budget > 0 ? Math.min((d.totalSpent / d.budget) * 100, 100) : 0;
            return (
              <li
                key={d.date}
                className={`rounded-comfortable bg-surface p-3.5 ${isToday(d.date) ? 'shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-body font-bold text-ink">
                    {SHORT_DAY[d.dayOfWeek]}
                    <span className="ml-2 text-small font-normal text-ink-muted">{d.date}</span>
                  </p>
                  <p className={`text-small font-bold tabular-nums ${over ? 'text-status-over' : 'text-ink-muted'}`}>
                    {formatRupiah(d.totalSpent)} / {formatRupiah(d.budget)}
                  </p>
                </div>
                <div className={`mt-2 h-1.5 overflow-hidden rounded-pill ${over ? 'bg-status-over-bg' : 'bg-track'}`}>
                  <div
                    className={`h-full rounded-pill ${over ? 'bg-status-over' : 'bg-status-under'}`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>

                {d.transactions.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 border-t border-line-subtle pt-2">
                    {d.transactions.map((t) => (
                      <TransactionNoteRow
                        key={t.id}
                        transaction={t}
                        onSaved={(id, note) =>
                          mutate(
                            (current) =>
                              current && {
                                days: current.days.map((day) =>
                                  day.date === d.date
                                    ? { ...day, transactions: day.transactions.map((tx) => (tx.id === id ? { ...tx, note } : tx)) }
                                    : day,
                                ),
                              },
                            { revalidate: false },
                          )
                        }
                        onCategorySaved={(id, category) =>
                          mutate(
                            (current) =>
                              current && {
                                days: current.days.map((day) =>
                                  day.date === d.date
                                    ? { ...day, transactions: day.transactions.map((tx) => (tx.id === id ? { ...tx, category } : tx)) }
                                    : day,
                                ),
                              },
                            { revalidate: false },
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function WeeklySkeleton() {
  return (
    <div className="px-4 pb-navbar pt-6">
      <div className="flex flex-col gap-4">
        <div className="h-40 animate-pulse rounded-medium bg-track" />
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-comfortable bg-track" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-comfortable bg-track" />
        ))}
      </div>
    </div>
  );
}
