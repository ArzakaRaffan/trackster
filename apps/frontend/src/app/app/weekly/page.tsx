'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { StatTile } from '@/components/ui/StatTile';
import { DayBarChart } from '@/components/ui/DayBarChart';
import { TransactionNoteRow } from '@/components/ui/TransactionNoteRow';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { BudgetProgress } from '@/components/ui/BudgetProgress';
import { ChevronDown } from 'lucide-react';

interface DayTransaction {
  id: number;
  amount: number;
  description: string;
  source: string;
  occurredAt: string;
  note?: string | null;
  category?: string;
  displayDescription?: string;
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
  const [openDay, setOpenDay] = useState<string | null>(null);

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
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      <header>
        <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Mingguan</h1>
        <p className="text-[15px] text-text-subtle">7 hari terakhir</p>
      </header>

      <section className="rounded-card-lg bg-card p-6 shadow-card">
        <AmountDisplay
          label="Total minggu ini"
          value={totalSpent}
          size="large"
          tone={totalSpent > totalBudget ? 'over' : 'base'}
        />

        <div className="mt-6">
          <DayBarChart
            days={chartDays}
            onBarClick={(i) => setOpenDay((prev) => (prev === data.days[i].date ? null : data.days[i].date))}
          />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Budget" value={formatRupiah(totalBudget)} size="heading" />
        <StatTile
          label={remaining < 0 ? 'Lewat' : 'Sisa'}
          value={formatRupiah(Math.abs(remaining))}
          tone={remaining < 0 ? 'over' : 'under'}
          size="heading"
        />
        <StatTile label="Rerata" value={formatRupiah(totalSpent / data.days.length)} tone="muted" size="heading" />
      </div>

      <h2 className="text-heading font-bold text-text">Per hari</h2>

      <ul className="flex flex-col gap-3">
        {data.days.map((d) => {
          const over = d.totalSpent > d.budget;
          const open = openDay === d.date;
          return (
            <li
              key={d.date}
              className={`rounded-card bg-card shadow-card ${isToday(d.date) ? 'shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]' : ''}`}
            >
              <button
                type="button"
                onClick={() => setOpenDay(open ? null : d.date)}
                aria-expanded={open}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-body font-bold text-text">
                    {SHORT_DAY[d.dayOfWeek]}
                    <span className="ml-2 text-small font-normal text-text-subtle">{d.date}</span>
                  </span>
                </span>
                <span className={`text-small font-bold tabular-nums ${over ? 'text-status-over' : 'text-text-subtle'}`}>
                  {formatRupiah(d.totalSpent)} / {formatRupiah(d.budget)}
                </span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-text-subtle transition-transform duration-base ease-standard ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
                style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-4">
                    <div className="mb-2 px-1">
                      <BudgetProgress
                        spent={d.totalSpent}
                        budget={d.budget}
                        isOverBudget={over}
                        height={6}
                        showLegend={false}
                      />
                    </div>

                    {d.transactions.length > 0 && (
                      <ul className="flex flex-col gap-1 border-t border-border pt-2">
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
                                        ? {
                                            ...day,
                                            transactions: day.transactions.map((tx) => (tx.id === id ? { ...tx, note } : tx)),
                                          }
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
                                        ? {
                                            ...day,
                                            transactions: day.transactions.map((tx) =>
                                              tx.id === id ? { ...tx, category } : tx,
                                            ),
                                          }
                                        : day,
                                    ),
                                  },
                                { revalidate: false },
                              )
                            }
                            onAliasSaved={(id, displayName) =>
                              mutate(
                                (current) =>
                                  current && {
                                    days: current.days.map((day) =>
                                      day.date === d.date
                                        ? {
                                            ...day,
                                            transactions: day.transactions.map((tx) =>
                                              tx.id === id ? { ...tx, displayDescription: displayName } : tx,
                                            ),
                                          }
                                        : day,
                                    ),
                                  },
                                { revalidate: false },
                              )
                            }
                            onDeleted={() => mutate()}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WeeklySkeleton() {
  return (
    <div className="px-4 pb-navbar pt-6">
      <div className="flex flex-col gap-3">
        <div className="h-40 animate-pulse rounded-medium bg-track" />
        <div className="grid grid-cols-3 gap-3">
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
