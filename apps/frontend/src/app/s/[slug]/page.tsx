'use client';

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
import { Check, PartyPopper, Receipt } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

  const handleMarkPaid = async (participantId: number) => {
    await api.patch(`/split-bills/public/${slug}/participants/${participantId}/mark-paid`);
    mutate();
  };

  const handleCopyAccountNumber = () => {
    if (!data?.payerAccountNumber) return;
    navigator.clipboard.writeText(data.payerAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-4">
        <div className="h-52 w-full max-w-content animate-pulse rounded-panel bg-track" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
          <Receipt size={24} />
        </span>
        <p className="text-body font-bold text-ink">Split bill nggak ketemu</p>
        <p className="max-w-[260px] text-small text-ink-muted">Link mungkin salah atau bill-nya udah dihapus.</p>
      </div>
    );
  }

  const grandTotal =
    data.items.reduce((sum, i) => sum + Number(i.amount) * Number(i.quantity ?? 1), 0) +
    Number(data.taxAmount) +
    Number(data.serviceFeeAmount);
  const paidCount = data.participants.filter((p) => p.isPaid).length;
  const allPaid = data.participants.length > 0 && paidCount === data.participants.length;

  return (
    <div className="min-h-screen bg-base pb-16">
      <div className="mx-auto max-w-content px-4 pt-8">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION_SLOW}
          className="overflow-hidden rounded-panel bg-surface"
        >
          <div className="bg-gradient-to-b from-brand/[0.14] to-transparent px-6 pb-6 pt-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-base shadow-medium">
              <Receipt size={24} />
            </span>
            <h1 className="mt-3 font-title text-title font-bold text-ink">{data.restaurantName}</h1>
            <p className="mt-1 text-small text-ink-muted">
              {new Date(data.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="mt-5 flex justify-center">
              <AmountDisplay value={grandTotal} size="hero" tone="base" />
            </div>
            <p className="mt-1 text-small text-ink-muted">Total tagihan</p>
          </div>

          <div className="flex items-center gap-3 border-t border-line-subtle px-6 py-4">
            <div className="h-2 flex-1 overflow-hidden rounded-pill bg-track">
              <motion.div
                className="h-full rounded-pill bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${data.participants.length ? (paidCount / data.participants.length) * 100 : 0}%` }}
                transition={TRANSITION_SLOW}
              />
            </div>
            <span className="shrink-0 text-small font-bold tabular-nums text-ink-muted">
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
              <div className="mt-3 flex items-center justify-center gap-2 rounded-comfortable bg-status-under-bg px-4 py-3 text-label font-bold text-status-under">
                <PartyPopper size={18} />
                Semua udah lunas!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-heading font-semibold text-ink">Menu</h2>
          <ul className="flex flex-col gap-1 rounded-comfortable bg-surface p-2">
            {data.items.map((item) => {
              const qty = Number(item.quantity ?? 1);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-standard px-2 py-2.5">
                  {item.participantName ? (
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-bold ${
                        toneFor(data.participants.findIndex((p) => p.name === item.participantName)).bg
                      } ${toneFor(data.participants.findIndex((p) => p.name === item.participantName)).text}`}
                    >
                      {initials(item.participantName)}
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-micro text-ink-subtle">
                      ?
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink">
                      {item.description}
                      {qty > 1 ? ` x${qty}` : ''}
                    </span>
                    <span className="text-small text-ink-muted">{item.participantName ?? 'Belum di-assign'}</span>
                  </span>
                  <span className="shrink-0 text-body tabular-nums text-ink">
                    {formatRupiah(Number(item.amount) * qty)}
                  </span>
                </li>
              );
            })}
          </ul>

          {(Number(data.taxAmount) > 0 || Number(data.serviceFeeAmount) > 0) && (
            <div className="mt-2 flex flex-col gap-1 rounded-comfortable bg-surface px-4 py-3 text-small text-ink-muted">
              {Number(data.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span className="tabular-nums">{formatRupiah(Number(data.taxAmount))}</span>
                </div>
              )}
              {Number(data.serviceFeeAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Service Fee</span>
                  <span className="tabular-nums">{formatRupiah(Number(data.serviceFeeAmount))}</span>
                </div>
              )}
            </div>
          )}

          {(data.payerName || data.payerBank || data.payerAccountNumber) && (
            <div className="mt-3 rounded-comfortable bg-surface p-4 text-small">
              <p className="mb-2 font-bold text-ink">Transfer ke</p>
              {data.payerName && (
                <div className="flex justify-between gap-3">
                  <span className="text-ink-muted">Nama</span>
                  <span className="text-right font-bold text-ink">{data.payerName}</span>
                </div>
              )}
              {data.payerBank && (
                <div className="flex justify-between gap-3">
                  <span className="text-ink-muted">Bank</span>
                  <span className="text-right font-bold text-ink">{data.payerBank}</span>
                </div>
              )}
              {data.payerAccountNumber && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-muted">Rekening</span>
                  <div className="flex items-center gap-2">
                    <span className="text-right font-bold tabular-nums text-ink">{data.payerAccountNumber}</span>
                    <button
                      onClick={handleCopyAccountNumber}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                      aria-label="Salin nomor rekening"
                    >
                      {copied ? <Check size={14} /> : <LinkIcon size={14} />}
                    </button>
                  </div>
                </div>
              )}
              {data.payerContact && (
                <div className="flex justify-between gap-3">
                  <span className="text-ink-muted">Kontak</span>
                  <span className="text-right font-bold text-ink">{data.payerContact}</span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-heading font-semibold text-ink">Yang harus dibayar</h2>
          <ul ref={participantListParent} className="flex flex-col gap-2">
            {data.participants.map((p, i) => {
              const tone = toneFor(i);
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-comfortable p-3.5 transition-colors duration-base ease-standard ${
                    p.isPaid ? 'bg-status-under-bg' : 'bg-surface'
                  }`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label font-bold ${tone.bg} ${tone.text}`}>
                    {initials(p.name)}
                  </span>
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
              );
            })}
          </ul>
        </section>

        <p className="mt-8 text-center text-micro uppercase tracking-caps text-ink-subtle">Dibuat lewat Trackster</p>
      </div>
    </div>
  );
}
