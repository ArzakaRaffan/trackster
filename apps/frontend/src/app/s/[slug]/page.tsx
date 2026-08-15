'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { PublicSplitBillSummary } from '@/lib/splitBillTypes';
import { Check, Receipt } from 'lucide-react';

const fetcher = (path: string) => api.get<PublicSplitBillSummary>(path);

export default function PublicSplitBillPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading, mutate } = useSWR(slug ? `/split-bills/public/${slug}` : null, fetcher);

  const handleMarkPaid = async (participantId: number) => {
    await api.patch(`/split-bills/public/${slug}/participants/${participantId}/mark-paid`);
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-4">
        <div className="h-40 w-full max-w-content animate-pulse rounded-comfortable bg-track" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-4 text-center">
        <p className="text-label text-status-over">Split bill tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-content bg-base px-4 pb-12 pt-8 text-ink">
      <header className="flex flex-col items-center gap-2 pb-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
          <Receipt size={22} />
        </span>
        <h1 className="font-title text-title font-bold text-ink">{data.restaurantName}</h1>
        <p className="text-small text-ink-muted">
          {new Date(data.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading font-semibold text-ink">Item</h2>
        <ul className="flex flex-col gap-2 rounded-comfortable bg-surface p-3">
          {data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{item.description}</span>
                <span className="text-small text-ink-muted">{item.participantName ?? 'Belum di-assign'}</span>
              </span>
              <span className="shrink-0 text-body tabular-nums text-ink">{formatRupiah(Number(item.amount))}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between rounded-comfortable bg-surface p-4 text-small text-ink-muted">
          <span>Pajak + Service Fee</span>
          <span className="tabular-nums">{formatRupiah(Number(data.taxAmount) + Number(data.serviceFeeAmount))}</span>
        </div>

        <h2 className="mt-2 text-heading font-semibold text-ink">Yang harus dibayar</h2>
        <ul className="flex flex-col gap-2 rounded-comfortable bg-surface p-2">
          {data.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-standard px-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-body font-bold text-ink">{p.name}</span>
                <span className="text-small tabular-nums text-ink-muted">{formatRupiah(p.totalOwed)}</span>
              </span>
              <Button
                variant={p.isPaid ? 'dark' : 'primary'}
                size="sm"
                icon={p.isPaid ? <Check size={14} /> : undefined}
                onClick={() => handleMarkPaid(p.id)}
              >
                {p.isPaid ? 'Lunas' : 'Tandai Lunas'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
