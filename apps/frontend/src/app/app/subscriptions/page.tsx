'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChevronLeft, Info, Pencil, Repeat, X } from 'lucide-react';

interface SubscriptionItem {
  description: string;
  averageAmount: number;
  occurrenceCount: number;
  estimatedMonthlyBurn: number;
  lastSeenAt: string;
  displayDescription?: string;
}

const fetcher = (url: string) => api.get<SubscriptionItem[]>(url);

const DAY_MS = 24 * 60 * 60 * 1000;

export default function SubscriptionsPage() {
  const { data: subs, error, isLoading, mutate } = useSWR<SubscriptionItem[]>(
    '/transactions/subscriptions',
    fetcher,
  );

  const [editingSub, setEditingSub] = useState<SubscriptionItem | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);

  const totalMonthlyBurn = (subs ?? []).reduce((sum, s) => sum + s.estimatedMonthlyBurn, 0);
  const totalYearlyBurn = totalMonthlyBurn * 12;

  const handleOpenEdit = (sub: SubscriptionItem) => {
    setEditingSub(sub);
    setAliasInput(sub.displayDescription || sub.description);
  };

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub || !aliasInput.trim()) return;

    setSavingAlias(true);
    try {
      await api.post('/merchant-aliases', {
        rawDescription: editingSub.description,
        displayName: aliasInput.trim(),
      });
      await mutate();
      setEditingSub(null);
    } finally {
      setSavingAlias(false);
    }
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <Link href="/app/more" aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Biaya berulang</p>
          <h1 className="font-title text-title font-bold text-ink">Langganan</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {/* Hero Burn Card */}
        <section className="rounded-medium bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                Estimasi pengeluaran bulanan
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-title text-amount-hero font-extrabold tabular-nums text-ink">
                  {formatRupiah(totalMonthlyBurn)}
                </span>
                <span className="text-body font-normal text-ink-muted">/bln</span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-surface-interactive px-2.5 py-1 text-badge font-semibold text-ink-muted">
              {subs ? subs.length : 0} Layanan
            </span>
          </div>

          <div className="mt-4 flex gap-5 border-t border-line-subtle pt-3">
            <div>
              <p className="text-micro text-ink-muted">Proyeksi tahunan</p>
              <p className="text-body font-bold tabular-nums text-ink">
                {formatRupiah(totalYearlyBurn)}
                <span className="text-micro font-normal text-ink-muted">/thn</span>
              </p>
            </div>
            <div>
              <p className="text-micro text-ink-muted">Rata-rata per layanan</p>
              <p className="text-body font-bold tabular-nums text-ink">
                {subs && subs.length > 0 ? formatRupiah(Math.round(totalMonthlyBurn / subs.length)) : '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Subscriptions list */}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-comfortable bg-track" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-comfortable bg-surface p-4">
            <p className="text-label text-status-over">Gagal memuat data langganan.</p>
          </div>
        ) : !subs || subs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-comfortable p-8 text-center shadow-hairline">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Repeat size={22} />
            </span>
            <p className="text-body font-bold text-ink">Belum ada langganan terdeteksi</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">
              Begitu ada minimal 2 transaksi berulang dengan nominal serupa dan interval ~30 hari dari BCA atau Jago, layanannya muncul otomatis di sini.
            </p>
            <Link
              href="/app"
              className="mt-1 text-small font-bold text-brand"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="px-1 text-small font-bold uppercase tracking-caps text-ink-muted">
              Daftar layanan ({subs.length})
            </p>

            <ul className="flex flex-col gap-2">
              {subs.map((s, idx) => {
                const lastDate = new Date(s.lastSeenAt);
                const nextDueDate = new Date(lastDate.getTime() + 30 * DAY_MS);
                const daysLeft = Math.ceil((nextDueDate.getTime() - Date.now()) / DAY_MS);

                const isDueToday = daysLeft === 0;
                const isDueSoon = daysLeft > 0 && daysLeft <= 3;
                const dueBadgeClass = isDueToday
                  ? 'bg-status-over-bg text-status-over'
                  : isDueSoon
                    ? 'bg-status-near-bg text-status-near'
                    : 'bg-surface-interactive text-ink-muted';

                const dueLabel = isDueToday
                  ? 'Jatuh tempo hari ini'
                  : isDueSoon
                    ? `Jatuh tempo dlm ${daysLeft} hari`
                    : `Est. ${nextDueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;

                const displayName = s.displayDescription || s.description;

                return (
                  <li
                    key={idx}
                    className="flex flex-col gap-2.5 rounded-comfortable bg-surface p-4 transition-colors duration-base ease-standard hover:bg-surface-alt"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-body font-bold text-ink">{displayName}</p>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            aria-label="Edit nama tampilan"
                            className="text-ink-subtle hover:text-ink transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                        {s.displayDescription && (
                          <p className="truncate text-micro text-ink-subtle">{s.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-body font-bold tabular-nums text-ink">
                          {formatRupiah(s.averageAmount)}
                        </p>
                        <p className="text-micro text-ink-muted">per bulan</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-line-subtle pt-2 text-micro">
                      <span className="text-ink-muted">
                        {s.occurrenceCount}x transaksi · Terakhir{' '}
                        {lastDate.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-bold ${dueBadgeClass}`}>
                        {dueLabel}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Heuristics info callout */}
        <section className="flex items-start gap-3 rounded-comfortable bg-surface-interactive p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-ink-muted" />
          <div className="text-small leading-relaxed text-ink-muted">
            <p className="font-bold text-ink">Bagaimana deteksi bekerja</p>
            <p className="mt-0.5">
              Trackster menganalisis riwayat transaksi 90 hari terakhir. Biaya berulang dengan variansi nominal ≤ 10% dan rentang waktu 27–34 hari diklasifikasikan secara otomatis sebagai langganan aktif.
            </p>
          </div>
        </section>
      </div>

      {/* Modal Edit Alias */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-panel bg-surface p-5 shadow-heavy animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Nama tampilan</p>
                <h2 className="font-title text-heading font-bold text-ink">Ubah Nama Layanan</h2>
              </div>
              <button
                onClick={() => setEditingSub(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-interactive text-ink-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAlias} className="flex flex-col gap-4">
              <div>
                <p className="text-micro text-ink-subtle mb-1">Deskripsi asli bank:</p>
                <p className="rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-small text-ink-muted font-mono truncate">
                  {editingSub.description}
                </p>
              </div>

              <Input
                label="Nama alias tampilan"
                placeholder="Misal: Spotify, Netflix, iCloud"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                autoFocus
                required
              />

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setEditingSub(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={savingAlias || !aliasInput.trim()}
                >
                  {savingAlias ? 'Menyimpan...' : 'Simpan nama'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
