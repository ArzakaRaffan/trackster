'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { SplitBillDetail } from '@/lib/splitBillTypes';
import { Check, ChevronLeft, Link as LinkIcon, Share2 } from 'lucide-react';

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

  const grandTotal = data
    ? data.items.reduce((sum, i) => sum + Number(i.amount) * i.quantity, 0) +
      Number(data.taxAmount) +
      Number(data.serviceFeeAmount) +
      Number(data.deliveryFee) -
      Number(data.discountAmount)
    : 0;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      <header className="flex items-center gap-3">
        <button onClick={() => router.push('/split-bills')} aria-label="Kembali" className="text-text-subtle hover:text-text">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-title text-[32px] font-bold tracking-[-0.02em] text-text">
            {data?.restaurantName ?? '...'}
          </h1>
          <p className="text-[15px] text-text-subtle">Detail Split Bill</p>
        </div>
      </header>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-card bg-track" />
      ) : error || !data ? (
        <p className="text-label text-status-over">Gagal memuat data.</p>
      ) : (
        <>
          {/* Grand total + share */}
          <section className="flex flex-col gap-3 rounded-card-lg bg-card p-6 shadow-card">
            <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Grand total</p>
            <p className="font-title text-amount-hero font-black tracking-amount tabular-nums text-text">
              {formatRupiah(grandTotal)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 rounded-medium bg-neutral px-3.5 py-2 text-label font-bold text-text transition-colors hover:bg-neutral-hover"
              >
                {copied ? <Check size={16} /> : <LinkIcon size={16} />}
                {copied ? 'Link tersalin' : 'Salin link'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `${data.restaurantName} — total ${formatRupiah(grandTotal)}. Lihat pembagian: ${typeof window !== 'undefined' ? window.location.origin : ''}/s/${data.publicSlug}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-medium bg-brand px-3.5 py-2 text-label font-bold text-on-brand transition-colors hover:bg-brand-hover"
              >
                <Share2 size={16} /> WhatsApp
              </a>
            </div>
          </section>

          {/* Rincian fee */}
          <section className="rounded-card bg-card p-4 shadow-card">
            <p className="text-small font-bold uppercase tracking-caps text-text-subtle">
              {new Date(data.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-small text-text-subtle">
              {data.taxAmount > 0 && <div className="flex justify-between"><span>Pajak (Rp)</span><span className="tabular-nums">{formatRupiah(data.taxAmount)}</span></div>}
              {data.taxPercent > 0 && <div className="flex justify-between"><span>Pajak (%)</span><span className="tabular-nums">{data.taxPercent}%</span></div>}
              {data.serviceFeeAmount > 0 && <div className="flex justify-between"><span>Service (Rp)</span><span className="tabular-nums">{formatRupiah(data.serviceFeeAmount)}</span></div>}
              {data.servicePercent > 0 && <div className="flex justify-between"><span>Service (%)</span><span className="tabular-nums">{data.servicePercent}%</span></div>}
              {data.discountAmount > 0 && <div className="flex justify-between text-status-under"><span>Diskon (Rp)</span><span className="tabular-nums">-{formatRupiah(data.discountAmount)}</span></div>}
              {data.discountPercent > 0 && <div className="flex justify-between text-status-under"><span>Diskon (%)</span><span className="tabular-nums">{data.discountPercent}%</span></div>}
              {data.deliveryFee > 0 && <div className="flex justify-between"><span>Lainnya</span><span className="tabular-nums">{formatRupiah(data.deliveryFee)}</span></div>}
            </div>
          </section>

          <h2 className="text-heading font-bold text-text">Item & Pembagian</h2>
          <ul className="flex flex-col gap-2 rounded-card bg-card p-3 shadow-card">
            {data.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-text">
                      {item.description}
                      {item.quantity > 1 && <span className="text-text-subtlest"> ×{item.quantity}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-body tabular-nums text-text">
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
                        className={`rounded-pill px-3 py-1 text-small font-bold transition-colors duration-fast ease-standard ${
                          active
                            ? 'bg-brand-subtle text-brand shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]'
                            : 'bg-neutral text-text-subtle hover:text-text'
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

          <h2 className="text-heading font-bold text-text">Kalkulasi per orang</h2>
          <ul className="flex flex-col gap-2 rounded-card bg-card p-2 shadow-card">
            {data.participantTotals.map((p) => (
              <li key={p.participantId} className="flex items-center gap-3 rounded-row px-3 py-2.5 transition-colors hover:bg-hover">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-bold text-text">{p.name}</span>
                  <span className="text-small text-text-subtle">
                    Subtotal {formatRupiah(p.subtotal)} + fee {formatRupiah(p.tax + p.service + p.delivery)}
                  </span>
                </span>
                <span className="shrink-0 text-body font-bold tabular-nums text-text">{formatRupiah(p.total)}</span>
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
  );
}
