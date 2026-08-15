'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { SplitBillDetail } from '@/lib/splitBillTypes';
import { AlertTriangle, Check, ChevronLeft, Copy, Link as LinkIcon } from 'lucide-react';

const fetcher = (path: string) => api.get<SplitBillDetail>(path);

// Halaman kelola buat bill yang dibuat TANPA login (lihat SplitBillController.createPublicBill).
// ownerToken di URL ini adalah pengganti login satu-satunya buat pembuat bill anonim — nggak
// ada akun/password recovery kalau link ini ilang, makanya ada banner pengingat di atas.
export default function ManageSplitBillPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR(token ? `/split-bills/manage/${token}` : null, fetcher);
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedManage, setCopiedManage] = useState(false);

  const handleReassign = async (itemId: number, participantId: number | null) => {
    await api.patch(`/split-bills/manage/${token}/items/${itemId}/assign`, { participantId });
    mutate();
  };

  const handleCopyShareLink = () => {
    if (!data) return;
    navigator.clipboard.writeText(`${window.location.origin}/s/${data.publicSlug}`);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleCopyManageLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedManage(true);
    setTimeout(() => setCopiedManage(false), 2000);
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <button onClick={() => router.push('/')} aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Kelola Split Bill</p>
          <h1 className="truncate font-title text-title font-bold text-ink">{data?.restaurantName ?? '...'}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-comfortable bg-track" />
        ) : error || !data ? (
          <p className="text-label text-status-over">Gagal memuat data. Link kelola mungkin salah.</p>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-comfortable bg-status-near-bg p-4">
              <AlertTriangle size={18} className="mt-px shrink-0 text-status-near" />
              <div className="min-w-0">
                <p className="text-label font-bold text-status-near">Simpan link halaman ini</p>
                <p className="text-small leading-relaxed text-ink-secondary">
                  Bill ini dibuat tanpa akun — link ini SATU-SATUNYA cara kamu balik ke sini buat ubah siapa pesan
                  apa. Kalau ke-close/ke-lupa, nggak ada cara buat login ulang.
                </p>
                <button onClick={handleCopyManageLink} className="mt-2 flex items-center gap-1.5 text-small font-bold text-ink hover:text-brand">
                  {copiedManage ? <Check size={14} /> : <Copy size={14} />}
                  {copiedManage ? 'Link tersalin' : 'Salin link kelola ini'}
                </button>
              </div>
            </div>

            <button
              onClick={handleCopyShareLink}
              className="flex items-center justify-center gap-2 rounded-comfortable bg-surface-interactive px-4 py-3 text-label font-bold text-ink hover:bg-surface-alt"
            >
              {copiedShare ? <Check size={16} /> : <LinkIcon size={16} />}
              {copiedShare ? 'Link tersalin' : 'Salin link buat share ke temen'}
            </button>

            <section className="rounded-comfortable bg-surface p-4">
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                {new Date(data.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="mt-2 flex justify-between text-small text-ink-muted">
                <span>Pajak</span>
                <span className="tabular-nums">{formatRupiah(Number(data.taxAmount))}</span>
              </div>
              <div className="flex justify-between text-small text-ink-muted">
                <span>Service Fee</span>
                <span className="tabular-nums">{formatRupiah(Number(data.serviceFeeAmount))}</span>
              </div>
            </section>

            <h2 className="text-heading font-semibold text-ink">Item</h2>
            <ul className="flex flex-col gap-2 rounded-comfortable bg-surface p-3">
              {data.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink">
                      {item.description}
                      {item.quantity > 1 && <span className="text-ink-subtle"> ×{item.quantity}</span>}
                    </span>
                    <span className="text-small tabular-nums text-ink-muted">
                      {item.quantity > 1
                        ? `${formatRupiah(Number(item.amount))} × ${item.quantity} = ${formatRupiah(Number(item.amount) * item.quantity)}`
                        : formatRupiah(Number(item.amount))}
                    </span>
                  </span>
                  <select
                    value={item.participantId ?? ''}
                    onChange={(e) => handleReassign(item.id, e.target.value === '' ? null : parseInt(e.target.value, 10))}
                    className="shrink-0 rounded-comfortable bg-surface-interactive px-3 py-2 text-small text-ink outline-none"
                  >
                    <option value="">Belum di-assign</option>
                    {data.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>

            <h2 className="text-heading font-semibold text-ink">Kalkulasi per orang</h2>
            <ul className="flex flex-col gap-2 rounded-comfortable bg-surface p-2">
              {data.participantTotals.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-standard px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-ink">{p.name}</span>
                    <span className="text-small text-ink-muted">
                      Item {formatRupiah(p.itemsTotal)} + pajak/fee {formatRupiah(p.taxShare + p.serviceFeeShare)}
                    </span>
                  </span>
                  <span className="shrink-0 text-body font-bold tabular-nums text-ink">{formatRupiah(p.totalOwed)}</span>
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
