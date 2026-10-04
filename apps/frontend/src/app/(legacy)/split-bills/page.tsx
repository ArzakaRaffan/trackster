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
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      <header>
        <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Split Bill</h1>
        <p className="text-[15px] text-text-subtle">Bagi tagihan</p>
      </header>

      <Link href="/split-bills/new">
        <Button variant="dark" fullWidth icon={<Plus size={18} />}>
          Buat Baru
        </Button>
      </Link>

      <h2 className="text-heading font-bold text-text">Riwayat</h2>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-track" />
          ))}
        </div>
      ) : error ? (
        <p className="text-label text-status-over">Gagal memuat data.</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card bg-card p-8 text-center shadow-card">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral text-text-subtle">
            <Inbox size={22} />
          </span>
          <p className="text-body font-bold text-text">Belum ada split bill</p>
          <p className="max-w-[280px] text-small leading-relaxed text-text-subtle">
            Bikin split bill buat bagi tagihan makan bareng temen.
          </p>
        </div>
      ) : (
        <ul ref={listParent} className="rounded-card bg-card p-2 shadow-card">
          {data.map((bill) => {
            const total =
              bill.items.reduce((sum, i) => sum + Number(i.amount) * i.quantity, 0) +
              Number(bill.taxAmount) +
              Number(bill.serviceFeeAmount);
            return (
              <li key={bill.id}>
                <Link
                  href={`/split-bills/${bill.id}`}
                  className="flex min-h-[56px] items-center gap-3 rounded-row px-3 py-2.5 transition-colors duration-fast ease-standard hover:bg-hover"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral text-text-subtle">
                    <Receipt size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-text">{bill.restaurantName}</span>
                    <span className="mt-0.75 flex items-center gap-2 text-small text-text-subtle">
                      {new Date(bill.billDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {bill.participants.length} orang
                    </span>
                  </span>
                  <span className="shrink-0 text-body font-bold tabular-nums text-text">{formatRupiah(total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
