'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { SplitBillDetail } from '@/lib/splitBillTypes';
import { Check, ChevronLeft, Link as LinkIcon } from 'lucide-react';

const fetcher = (path: string) => api.get<SplitBillDetail>(path);

export default function SplitBillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR(id ? `/split-bills/${id}` : null, fetcher);
  const [copied, setCopied] = useState(false);

  const toggleParticipantForItem = async (itemId: number, participantId: number) => {
    if (!data) return;
    const item = data.items.find(i => i.id === itemId);
    if (!item) return;

    let newShares = [...item.shares];
    const hasParticipant = newShares.some(s => s.participantId === participantId);

    if (hasParticipant) {
      newShares = newShares.filter(s => s.participantId !== participantId);
    } else {
      newShares.push({ id: 0, itemId, participantId, weight: 1 });
    }

    // Optimistic update
    mutate({
      ...data,
      items: data.items.map(i => i.id === itemId ? { ...i, shares: newShares } : i)
    }, false);

    await api.patch(`/split-bills/${id}/items/${itemId}/assign`, {
      shares: newShares.map(s => ({ participantId: s.participantId, weight: 1 }))
    });
    mutate();
  };

  const handleCopyLink = () => {
    if (!data) return;
    const url = `${window.location.origin}/s/${data.publicSlug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <button onClick={() => router.push('/split-bills')} aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Detail Split Bill</p>
          <h1 className="truncate font-title text-title font-bold text-ink">{data?.restaurantName ?? '...'}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-8">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-comfortable bg-track" />
        ) : error || !data ? (
          <p className="text-label text-status-over">Gagal memuat data.</p>
        ) : (
          <>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 rounded-comfortable bg-surface-interactive px-4 py-3 text-label font-bold text-ink hover:bg-surface-alt"
            >
              {copied ? <Check size={16} /> : <LinkIcon size={16} />}
              {copied ? 'Link tersalin' : 'Salin link buat share'}
            </button>

            <section className="rounded-comfortable bg-surface p-4 flex flex-col gap-2">
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                {new Date(data.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-small text-ink-muted">
                {data.taxAmount > 0 && <div className="flex justify-between"><span>Pajak (Rp)</span><span className="tabular-nums">{formatRupiah(data.taxAmount)}</span></div>}
                {data.taxPercent > 0 && <div className="flex justify-between"><span>Pajak (%)</span><span className="tabular-nums">{data.taxPercent}%</span></div>}
                {data.serviceFeeAmount > 0 && <div className="flex justify-between"><span>Service (Rp)</span><span className="tabular-nums">{formatRupiah(data.serviceFeeAmount)}</span></div>}
                {data.servicePercent > 0 && <div className="flex justify-between"><span>Service (%)</span><span className="tabular-nums">{data.servicePercent}%</span></div>}
                {data.discountAmount > 0 && <div className="flex justify-between text-status-under"><span>Diskon (Rp)</span><span className="tabular-nums">-{formatRupiah(data.discountAmount)}</span></div>}
                {data.discountPercent > 0 && <div className="flex justify-between text-status-under"><span>Diskon (%)</span><span className="tabular-nums">{data.discountPercent}%</span></div>}
                {data.deliveryFee > 0 && <div className="flex justify-between"><span>Lainnya</span><span className="tabular-nums">{formatRupiah(data.deliveryFee)}</span></div>}
              </div>
            </section>

            <h2 className="text-heading font-semibold text-ink">Item & Pembagian</h2>
            <ul className="flex flex-col gap-2 rounded-comfortable bg-surface p-3">
              {data.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 border-b border-line-subtle pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-ink">
                        {item.description}
                        {item.quantity > 1 && <span className="text-ink-subtle"> ×{item.quantity}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-body tabular-nums text-ink">
                      {formatRupiah(Number(item.amount) * item.quantity)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.participants.map(p => {
                      const active = item.shares.some(s => s.participantId === p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleParticipantForItem(item.id, p.id)}
                          className={`rounded-full border px-3 py-1 text-small transition-colors ${
                            active
                              ? 'border-brand bg-brand/10 text-brand'
                              : 'border-line-subtle bg-surface-interactive text-ink-muted hover:border-line-strong hover:text-ink'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

            <h2 className="text-heading font-semibold text-ink">Kalkulasi per orang</h2>
            <ul className="flex flex-col gap-2 rounded-comfortable bg-surface p-2">
              {data.participantTotals.map((p) => (
                <li key={p.participantId} className="flex items-center gap-3 rounded-standard px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-ink">{p.name}</span>
                    <span className="text-small text-ink-muted">
                      Subtotal {formatRupiah(p.subtotal)} + fee {formatRupiah(p.tax + p.service + p.delivery)}
                    </span>
                  </span>
                  <span className="shrink-0 text-body font-bold tabular-nums text-ink">{formatRupiah(p.total)}</span>
                  <span
                    className={`shrink-0 rounded-subtle px-2 py-0.5 text-micro font-bold uppercase tracking-caps ${
                      p.isPaid ? 'bg-status-under-bg text-status-under' : 'bg-status-over-bg text-status-over'
                    }`}
                  >
                    {p.isPaid ? 'Lunas' : 'Belum'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
