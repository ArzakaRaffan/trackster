'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { BudgetProgress } from '@/components/ui/BudgetProgress';
import { formatRupiah } from '@/lib/format';
import { TracksterMascot } from '@/components/TracksterMascot';
import {
  ArrowRight,
  LineChart,
  MessageCircle,
  PiggyBank,
  Receipt,
  Repeat,
  Target,
  Wallet,
} from 'lucide-react';

interface TodaySummary {
  date: string;
  budget: number;
  totalSpent: number;
  remaining: number;
  isOverBudget: boolean;
  totalIncome: number;
  netAmount: number;
  isNetPositive: boolean;
  transactions: unknown[];
}

interface SubscriptionItem {
  id: number;
  name: string;
  amount: number;
  cycle: 'MONTHLY' | 'YEARLY';
  nextDueDate: string;
  reminderDaysBefore: number;
  isActive: boolean;
}

const todayFetcher = (path: string) => api.get<TodaySummary>(path);
const subsFetcher = (path: string) => api.get<SubscriptionItem[]>(path);

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

const QUICK_LINKS = [
  { href: '/app/chat', label: 'Tanya Track', description: 'Ngobrol sama AI financial buddy', Icon: MessageCircle },
  { href: '/app/subscriptions', label: 'Langganan', description: 'Kelola manual + reminder Calendar', Icon: Repeat },
  { href: '/app/income', label: 'Pemasukan', description: 'Catat & kelola pemasukan', Icon: PiggyBank },
  { href: '/split-bills', label: 'Split Bill', description: 'Bagi tagihan bareng temen', Icon: Receipt },
  { href: '/app/reports', label: 'Laporan', description: 'Ringkasan bulanan & tren', Icon: LineChart },
  { href: '/app/budget', label: 'Budget', description: 'Atur budget harian', Icon: Wallet },
  { href: '/savings-calculator', label: 'Target Tabungan', description: 'Hitung nabung per bulan', Icon: Target },
];

export default function DashboardPage() {
  const { data, isLoading } = useSWR('/budget/today', todayFetcher);
  const { data: subs } = useSWR('/subscriptions', subsFetcher);
  const [slide, setSlide] = useState(0);

  const ratio = data && data.budget > 0 ? data.totalSpent / data.budget : 0;
  const status = data?.isOverBudget ? 'over' : ratio >= 0.8 ? 'near' : 'under';
  const activeSubs = (subs ?? []).filter((s) => s.isActive);
  const monthlyBurn = activeSubs.reduce(
    (sum, s) => sum + (s.cycle === 'YEARLY' ? s.amount / 12 : s.amount),
    0,
  );
  const dueSoon = activeSubs.filter((s) => {
    const days = Math.ceil((new Date(s.nextDueDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= (s.reminderDaysBefore ?? 3);
  }).length;

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 lg:px-0">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Dashboard</h1>
          <p className="mt-1 text-[15px] text-text-subtle">
            {data ? dateLabel(data.date) : 'Ringkasan keuanganmu'}
          </p>
        </div>
        <Link
          href="/app/chat"
          aria-label="Tanya Track"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card ring-1 ring-border transition-colors hover:bg-card-hover"
        >
          <TracksterMascot mood="idle" size="sm" />
        </Link>
      </header>

      {/* Hero: terpakai hari ini */}
      <Link
        href="/app/today"
        className="block rounded-card-lg bg-card p-6 shadow-card transition-colors duration-base ease-standard hover:bg-card-hover"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-small font-bold uppercase tracking-caps text-text-subtle">
              {data ? dateLabel(data.date) : 'Hari ini'}
            </p>
            {isLoading || !data ? (
              <div className="mt-2 h-9 w-40 animate-pulse rounded-comfortable bg-track" />
            ) : (
              <AmountDisplay
                label="Terpakai hari ini"
                value={data.totalSpent}
                size="hero"
                tone={data.isOverBudget ? 'over' : 'base'}
              />
            )}
          </div>
          {data && (
            <span
              className={`shrink-0 rounded-full px-2 py-[3px] text-badge font-semibold ${
                status === 'over'
                  ? 'bg-status-over-bg text-status-over'
                  : status === 'near'
                    ? 'bg-status-near-bg text-status-near'
                    : 'bg-status-under-bg text-status-under'
              }`}
            >
              {data.isOverBudget ? 'Over budget' : 'Aman'}
            </span>
          )}
        </div>

        {data && (
          <div className="mt-5">
            <BudgetProgress spent={data.totalSpent} budget={data.budget} isOverBudget={data.isOverBudget} height={10} />
          </div>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-small font-bold text-text-subtle">
          Lihat detail transaksi <ArrowRight size={14} />
        </p>
      </Link>

      {/* Carousel: Net hari ini / Langganan */}
      <section className="overflow-hidden rounded-card-lg bg-card shadow-card">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-heading font-bold text-text">Ringkasan</h2>
          <div className="flex items-center gap-1">
            {[0, 1].map((i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full-pill transition-all duration-base ease-standard ${
                  slide === i ? 'w-5 bg-brand' : 'w-2 bg-track'
                }`}
              />
            ))}
          </div>
        </div>

        <div
          className="flex transition-transform duration-slow ease-enter"
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          {/* Slide 0: Net hari ini */}
          <div className="w-full shrink-0 p-6">
            {data ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <AmountDisplay
                    label="Net hari ini"
                    value={data.netAmount}
                    size="large"
                    tone={data.isNetPositive ? 'under' : 'over'}
                    sign
                  />
                  <span
                    className={`shrink-0 rounded-full px-2 py-[3px] text-badge font-semibold ${
                      data.isNetPositive
                        ? 'bg-status-under-bg text-status-under'
                        : 'bg-status-over-bg text-status-over'
                    }`}
                  >
                    {data.isNetPositive ? 'Surplus' : 'Defisit'}
                  </span>
                </div>
                <div className="mt-4 flex gap-8">
                  <AmountDisplay label="Pemasukan" value={data.totalIncome} size="body" tone="muted" />
                  <AmountDisplay label="Pengeluaran" value={data.totalSpent} size="body" tone="muted" />
                </div>
              </>
            ) : (
              <p className="text-small text-text-subtle">Memuat data...</p>
            )}
          </div>

          {/* Slide 1: Langganan */}
          <div className="w-full shrink-0 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Langganan aktif</p>
                <p className="mt-1 font-title text-amount font-black tracking-[-1px] tabular-nums text-text">
                  {formatRupiah(Math.round(monthlyBurn))}
                  <span className="ml-1 text-body font-normal text-text-subtle">/bln</span>
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral text-text-subtle">
                <Repeat size={18} />
              </span>
            </div>
            <p className="mt-4 text-small text-text-subtle">
              {subs == null
                ? 'Memuat langganan...'
                : activeSubs.length === 0
                  ? 'Belum ada langganan aktif. Tambah manual, reminder lewat Google Calendar.'
                  : dueSoon > 0
                    ? `${activeSubs.length} aktif · ${dueSoon} jatuh tempo dekat`
                    : `${activeSubs.length} aktif`}
            </p>
            <Link
              href="/app/subscriptions"
              className="mt-3 inline-flex items-center gap-1.5 text-small font-bold text-brand"
            >
              Kelola langganan <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Menu 7 pintasan */}
      <section>
        <h2 className="mb-3 px-1 text-heading font-bold text-text">Menu</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {QUICK_LINKS.map(({ href, label, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-2 rounded-card bg-card p-4 shadow-card transition-colors duration-base ease-standard hover:bg-card-hover"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral text-text-subtle">
                <Icon size={18} />
              </span>
              <span className="text-body font-bold text-text">{label}</span>
              <span className="text-small leading-snug text-text-subtle">{description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
