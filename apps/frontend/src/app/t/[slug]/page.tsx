'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { TripSummary } from '@/lib/tripTypes';
import { Button } from '@/components/ui/Button';
import { Check, Copy, Route, Share2 } from 'lucide-react';
import { useState } from 'react';

const fetcher = (path: string) => api.get<TripSummary>(path);

const AVATAR_TONES = [
  { bg: 'bg-status-under-bg', text: 'text-status-under' },
  { bg: 'bg-status-info-bg', text: 'text-status-info' },
  { bg: 'bg-status-near-bg', text: 'text-status-near' },
  { bg: 'bg-status-over-bg', text: 'text-status-over' },
];

function toneFor(index: number) {
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function PublicTripPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading } = useSWR(slug ? `/trips/public/${slug}` : null, fetcher);
  const [listParent] = useAutoAnimate({ duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWa = () => {
    if (!data) return;
    const lines = data.settlements.map((t) => `${t.fromName} → ${t.toName}: ${formatRupiah(t.amount)}`);
    const text = encodeURIComponent(`*Settle up ${data.name}*\n${lines.join('\n')}\n\n${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-4">
        <div className="h-52 w-full max-w-content animate-pulse rounded-panel bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral text-ink-muted">
          <Route size={24} />
        </span>
        <p className="text-body font-bold">Trip nggak ketemu</p>
        <p className="max-w-[260px] text-small text-ink-muted">Link mungkin salah atau trip-nya udah dihapus.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base pb-16">
      <div className="mx-auto max-w-content px-4 pt-8">
        <header className="overflow-hidden rounded-panel bg-surface text-center shadow-card">
          <div className="bg-gradient-to-b from-brand/[0.14] to-transparent px-6 pb-6 pt-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-medium">
              <Route size={24} />
            </span>
            <h1 className="mt-3 font-title text-title font-bold">{data.name}</h1>
            <p className="mt-1 text-small text-ink-muted">Total pengeluaran</p>
            <p className="mt-1 font-title text-amount font-black tracking-amount text-brand">{formatRupiah(data.totalSpent)}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" variant="outlined" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyLink}>
                {copied ? 'Tersalin' : 'Salin Link'}
              </Button>
              <Button size="sm" variant="primary" icon={<Share2 size={14} />} onClick={shareWa}>
                Share WA
              </Button>
            </div>
          </div>
        </header>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-heading font-bold">Settle up</h2>
          {data.settlements.length === 0 ? (
            <div className="rounded-card bg-surface p-6 text-center text-small text-ink-muted">
              Semua udah beres — nggak ada yang perlu transfer. 🎉
            </div>
          ) : (
            <ul ref={listParent} className="flex flex-col gap-2">
              {data.settlements.map((t, i) => (
                <li key={i} className="flex items-center gap-3 rounded-card bg-surface p-4">
                  <span className="text-body">
                    <span className="font-bold">{t.fromName}</span>
                    <span className="text-ink-muted"> transfer ke </span>
                    <span className="font-bold">{t.toName}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-body font-bold tabular-nums text-brand">{formatRupiah(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-heading font-bold">Saldo tiap anggota</h2>
          <ul className="flex flex-col gap-2">
            {data.balances.map((b, i) => {
              const tone = toneFor(i);
              const positive = b.net >= 0;
              return (
                <li key={b.memberId} className="flex items-center gap-3 rounded-card bg-surface p-3.5">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label font-bold ${tone.bg} ${tone.text}`}>
                    {initials(b.name)}
                  </span>
                  <span className="min-w-0 flex-1 text-body font-bold">{b.name}</span>
                  <span className={`text-small tabular-nums ${positive ? 'text-status-under' : 'text-status-over'}`}>
                    {positive ? `nerima ${formatRupiah(b.net)}` : `bayar ${formatRupiah(Math.abs(b.net))}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-heading font-bold">Pengeluaran</h2>
          <ul className="flex flex-col gap-1 rounded-card bg-surface p-2">
            {data.expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-row px-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body">{e.description}</span>
                  <span className="block text-micro text-ink-subtle">
                    {data.members.find((m) => m.id === e.paidByMemberId)?.name ?? '?'} bayar
                    {e.shares.length > 0 && ` · dibagi ${e.shares.length} orang`}
                  </span>
                </span>
                <span className="shrink-0 text-body tabular-nums">{formatRupiah(e.amount)}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-8 text-center text-micro uppercase tracking-caps text-ink-subtlest">Dibuat lewat Trackster</p>
      </div>
    </div>
  );
}
