'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { SplitBillListItem } from '@/lib/splitBillTypes';
import { Inbox, Plus, Receipt } from 'lucide-react';

const fetcher = (path: string) => api.get<SplitBillListItem[]>(path);

export default function SplitBillsPage() {
  const { data, error, isLoading } = useSWR('/split-bills', fetcher);
  const [listParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Bagi tagihan</p>
          <h1 className="font-title text-title font-bold text-ink">Split Bill</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <Link href="/split-bills/new">
          <Button variant="dark" fullWidth icon={<Plus size={18} />}>
            Buat Baru
          </Button>
        </Link>

        <h2 className="text-heading font-semibold text-ink">Riwayat</h2>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-comfortable bg-track" />
            ))}
          </div>
        ) : error ? (
          <p className="text-label text-status-over">Gagal memuat data.</p>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-comfortable p-8 text-center shadow-hairline">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Inbox size={22} />
            </span>
            <p className="text-body font-bold text-ink">Belum ada split bill</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">
              Bikin split bill buat bagi tagihan makan bareng temen.
            </p>
          </div>
        ) : (
          <ul ref={listParent} className="rounded-comfortable bg-surface p-2">
            {data.map((bill) => {
              const total =
                bill.items.reduce((sum, i) => sum + Number(i.amount), 0) +
                Number(bill.taxAmount) +
                Number(bill.serviceFeeAmount);
              return (
                <li key={bill.id}>
                  <Link
                    href={`/split-bills/${bill.id}`}
                    className="flex min-h-[56px] items-center gap-3 rounded-standard px-3 py-2.5 transition-colors duration-fast ease-standard hover:bg-white/[0.07]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
                      <Receipt size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-ink">{bill.restaurantName}</span>
                      <span className="mt-0.75 flex items-center gap-2 text-small text-ink-muted">
                        {new Date(bill.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {bill.participants.length} orang
                      </span>
                    </span>
                    <span className="shrink-0 text-body font-bold tabular-nums text-ink">{formatRupiah(total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
