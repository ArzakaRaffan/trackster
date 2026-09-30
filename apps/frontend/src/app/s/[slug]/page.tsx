'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { Button } from '@/components/ui/Button';
import { TRANSITION_SLOW } from '@/lib/motion';
import { PublicSplitBillSummary } from '@/lib/splitBillTypes';
import { Check, Copy, Landmark, PartyPopper, Receipt, Share2 } from 'lucide-react';

const fetcher = (path: string) => api.get<PublicSplitBillSummary>(path);

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

export default function PublicSplitBillPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading, mutate } = useSWR(slug ? `/split-bills/public/${slug}` : null, fetcher);
  const [participantListParent] = useAutoAnimate({ duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAccount = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleMarkPaid = async (participantId: number) => {
    await api.patch(`/split-bills/public/${slug}/participants/${participantId}/mark-paid`);
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="h-52 w-full max-w-content animate-pulse rounded-panel bg-track" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral text-text-subtle">
          <Receipt size={24} />
        </span>
        <p className="text-body font-bold text-text">Split bill nggak ketemu</p>
        <p className="max-w-[260px] text-small text-text-subtle">Link mungkin salah atau bill-nya udah dihapus.</p>
      </div>
    );
  }

  const grandTotal = data.participants.reduce((sum, p) => sum + p.total, 0);
  const paidCount = data.participants.filter((p) => p.isPaid).length;
  const allPaid = data.participants.length > 0 && paidCount === data.participants.length;
  const hasPayerInfo = data.payerBankName || data.payerAccountNumber || data.payerAccountName;

  const generateShareText = () => {
    let text = `*Tagihan ${data.restaurantName}*\n`;
    text += `${new Date(data.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;

    if (hasPayerInfo) {
      text += `Transfer ke:\n`;
      if (data.payerBankName) text += `${data.payerBankName}\n`;
      if (data.payerAccountNumber) text += `${data.payerAccountNumber}\n`;
      if (data.payerAccountName) text += `a.n ${data.payerAccountName}\n`;
      text += `\n`;
    }

    data.participants.forEach(p => {
      text += `*${p.name}*: ${formatRupiah(p.total)}\n`;
      text += `(Subtotal: ${formatRupiah(p.subtotal)}, Pajak: ${formatRupiah(p.tax)}, Service: ${formatRupiah(p.service)}`;
      if (p.discount > 0) text += `, Diskon: -${formatRupiah(p.discount)}`;
      if (p.delivery > 0) text += `, Lainnya: ${formatRupiah(p.delivery)}`;
      if (p.roundingDiff !== 0) text += `, Pembulatan: ${formatRupiah(p.roundingDiff)}`;
      text += `)\n\n`;
    });

    text += `Link: ${window.location.href}`;
    return text;
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(generateShareText());
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(generateShareText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-page pb-16">
      <div className="mx-auto max-w-content px-4 pt-8">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION_SLOW}
          className="overflow-hidden rounded-panel bg-card shadow-card"
        >
          <div className="bg-gradient-to-b from-brand/[0.14] to-transparent px-6 pb-6 pt-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-medium">
              <Receipt size={24} />
            </span>
            <h1 className="mt-3 font-title text-title font-bold text-text">{data.restaurantName}</h1>
            <p className="mt-1 text-small text-text-subtle">
              {new Date(data.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="mt-5 flex justify-center">
              <AmountDisplay value={grandTotal} size="hero" tone="base" />
            </div>
            <p className="mt-1 text-small text-text-subtle">Total tagihan</p>

            <div className="mt-4 flex gap-2 justify-center">
              <Button size="sm" variant="outlined" icon={<Copy size={14} />} onClick={handleCopyAll}>
                {copiedAll ? 'Tersalin' : 'Salin Semua'}
              </Button>
              <Button size="sm" variant="primary" icon={<Share2 size={14} />} onClick={handleWhatsApp}>
                Share WA
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border px-6 py-4">
            <div className="h-2 flex-1 overflow-hidden rounded-pill bg-track">
              <motion.div
                className="h-full rounded-pill bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${data.participants.length ? (paidCount / data.participants.length) * 100 : 0}%` }}
                transition={TRANSITION_SLOW}
              />
            </div>
            <span className="shrink-0 text-small font-bold tabular-nums text-text-subtle">
              {paidCount}/{data.participants.length} lunas
            </span>
          </div>
        </motion.header>

        <AnimatePresence>
          {allPaid && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={TRANSITION_SLOW}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-center justify-center gap-2 rounded-medium bg-status-under-bg px-4 py-3 text-label font-bold text-status-under">
                <PartyPopper size={18} />
                Semua udah lunas!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {hasPayerInfo && (
          <div className="mt-3 flex items-center gap-3 rounded-card bg-card p-4 shadow-card">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-info-bg text-status-info">
              <Landmark size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-small text-text-subtle">
                Transfer ke {data.payerBankName}
                {data.payerAccountName ? ` · a.n ${data.payerAccountName}` : ''}
              </span>
              <span className="block text-body font-bold tabular-nums text-text">{data.payerAccountNumber}</span>
            </span>
            {data.payerAccountNumber && (
              <button
                onClick={() => handleCopyAccount(data.payerAccountNumber!)}
                aria-label="Salin nomor rekening"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-subtle hover:text-text"
              >
                {copiedAccount ? <Check size={16} className="text-status-under" /> : <Copy size={16} />}
              </button>
            )}
          </div>
        )}

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-heading font-semibold text-text">Menu</h2>
          <ul className="flex flex-col gap-1 rounded-card bg-card p-2 shadow-card">
            {data.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 rounded-row px-2 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text">
                      {item.description}
                      {item.quantity > 1 && <span className="text-text-subtlest"> ×{item.quantity}</span>}
                    </span>
                    <span className="text-small text-text-subtle mt-1 block">
                      {item.shares.map((s, idx) => {
                        const pName = data.participants.find(p => p.participantId === s.participantId)?.name || 'Unknown';
                        return (
                          <span key={idx} className="mr-1 mb-1 inline-block bg-neutral rounded-pill px-2 py-0.5 text-micro">
                            {pName}
                          </span>
                        );
                      })}
                      {item.shares.length === 0 && 'Belum di-assign'}
                    </span>
                  </span>
                  <span className="shrink-0 text-body tabular-nums text-text">{formatRupiah(Number(item.amount) * item.quantity)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-heading font-semibold text-text">Yang harus dibayar</h2>
          <ul ref={participantListParent} className="flex flex-col gap-2">
            {data.participants.map((p, i) => {
              const tone = toneFor(i);
              return (
                <li
                  key={p.participantId}
                  className={`flex flex-col gap-2 rounded-card p-3.5 shadow-card transition-colors duration-base ease-standard ${
                    p.isPaid ? 'bg-status-under-bg' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label font-bold ${tone.bg} ${tone.text}`}>
                      {initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-bold text-text">{p.name}</span>
                      <span className="text-small tabular-nums text-text-subtle">{formatRupiah(p.total)}</span>
                    </span>
                    <Button
                      variant={p.isPaid ? 'dark' : 'primary'}
                      size="sm"
                      icon={p.isPaid ? <Check size={14} /> : undefined}
                      onClick={() => handleMarkPaid(p.participantId)}
                    >
                      {p.isPaid ? 'Lunas' : 'Tandai Lunas'}
                    </Button>
                  </div>
                  <div className="mt-1 pl-14 text-micro text-text-subtle grid grid-cols-2 gap-x-2 gap-y-1">
                    <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(p.subtotal)}</span></div>
                    {p.discount > 0 && <div className="flex justify-between text-status-under"><span>Diskon</span><span>-{formatRupiah(p.discount)}</span></div>}
                    {p.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatRupiah(p.tax)}</span></div>}
                    {p.service > 0 && <div className="flex justify-between"><span>Service</span><span>{formatRupiah(p.service)}</span></div>}
                    {p.delivery > 0 && <div className="flex justify-between"><span>Lainnya</span><span>{formatRupiah(p.delivery)}</span></div>}
                    {p.roundingDiff !== 0 && <div className="flex justify-between"><span>Pembulatan</span><span>{formatRupiah(p.roundingDiff)}</span></div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-8 text-center text-micro uppercase tracking-caps text-text-subtlest">Dibuat lewat Trackster</p>
      </div>
    </div>
  );
}
