'use client';

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
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Trackster</p>
          <h1 className="font-title text-title font-bold text-ink">Dashboard</h1>
        </div>
        <Link
          href="/app/chat"
          aria-label="Tanya Track"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-interactive ring-1 ring-white/[0.08] transition-colors hover:bg-surface-alt"
        >
          <TracksterMascot mood="idle" size="sm" />
        </Link>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <Link
          href="/app/today"
          className="block rounded-medium bg-surface p-5 transition-colors duration-base ease-standard hover:bg-surface-alt"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                {data ? dateLabel(data.date) : 'Hari ini'}
              </p>
              {isLoading || !data ? (
                <div className="mt-2 h-9 w-40 animate-pulse rounded-comfortable bg-track" />
              ) : (
                <AmountDisplay
                  label="Terpakai hari ini"
                  value={data.totalSpent}
                  size="title"
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
            <div className="mt-4">
              <BudgetProgress spent={data.totalSpent} budget={data.budget} isOverBudget={data.isOverBudget} height={10} />
            </div>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-small font-bold text-ink-muted">
            Lihat detail transaksi <ArrowRight size={14} />
          </p>
        </Link>

        {data && (
          <div className="rounded-medium bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <AmountDisplay
                label="Net hari ini"
                value={data.netAmount}
                size="title"
                tone={data.isNetPositive ? 'under' : 'over'}
                sign
              />
              <span
                className={`shrink-0 rounded-full px-2 py-[3px] text-badge font-semibold ${
                  data.isNetPositive ? 'bg-status-under-bg text-status-under' : 'bg-status-over-bg text-status-over'
                }`}
              >
                {data.isNetPositive ? 'Surplus' : 'Defisit'}
              </span>
            </div>
            <div className="mt-4 flex gap-5">
              <AmountDisplay label="Pemasukan" value={data.totalIncome} size="body" tone="muted" />
              <AmountDisplay label="Pengeluaran" value={data.totalSpent} size="body" tone="muted" />
            </div>
          </div>
        )}

        <Link
          href="/app/subscriptions"
          className="block rounded-medium bg-surface p-5 transition-colors duration-base ease-standard hover:bg-surface-alt"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Langganan aktif</p>
              <p className="mt-1 font-title text-amount font-black tracking-[-1px] tabular-nums text-ink">
                {formatRupiah(Math.round(monthlyBurn))}
                <span className="ml-1 text-body font-normal text-ink-muted">/bln</span>
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Repeat size={18} />
            </span>
          </div>
          <p className="mt-3 text-small text-ink-muted">
            {subs == null
              ? 'Memuat langganan...'
              : activeSubs.length === 0
                ? 'Belum ada langganan aktif. Tambah manual, reminder lewat Google Calendar.'
                : dueSoon > 0
                  ? `${activeSubs.length} aktif · ${dueSoon} jatuh tempo dekat`
                  : `${activeSubs.length} aktif`}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-small font-bold text-brand">
            Kelola langganan <ArrowRight size={14} />
          </p>
        </Link>

        <h2 className="mt-2 px-1 text-heading font-semibold text-ink">Menu</h2>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ href, label, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-2 rounded-comfortable bg-surface p-4 transition-colors duration-base ease-standard hover:bg-surface-alt"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
                <Icon size={18} />
              </span>
              <span className="text-body font-bold text-ink">{label}</span>
              <span className="text-small leading-snug text-ink-muted">{description}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}