'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { TransactionNoteRow, CATEGORY_LABELS, type NoteableTransaction } from '@/components/ui/TransactionNoteRow';
import { EmptyState } from '@/components/EmptyState';
import { ArrowLeft } from 'lucide-react';

const PAGE_SIZE = 50;

interface TxList {
  data: NoteableTransaction[];
  total: number;
}

function TransactionsList() {
  const sp = useSearchParams();
  const category = sp.get('category');
  const search = sp.get('search');
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const qs = new URLSearchParams({ limit: String(limit) });
  if (category) qs.set('category', category);
  if (search) qs.set('search', search);
  if (startDate) qs.set('startDate', startDate);
  if (endDate) qs.set('endDate', endDate);

  const { data, error, isLoading, mutate } = useSWR(`/transactions?${qs}`, (p: string) => api.get<TxList>(p));

  const title = search ?? (category ? CATEGORY_LABELS[category] ?? category : 'Semua transaksi');
  const subtitle = startDate && endDate ? `${startDate} → ${endDate}` : 'Semua waktu';
  const total = data?.data.reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <Link href="/app/insights" className="mb-1 flex items-center gap-1 text-small font-bold text-ink-muted">
          <ArrowLeft size={14} /> Analisis
        </Link>
        <h1 className="font-title text-title font-bold text-ink">{title}</h1>
        <p className="text-small text-ink-muted">{subtitle}</p>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {isLoading ? (
          <p className="text-label text-ink-muted">Memuat…</p>
        ) : error || !data ? (
          <p className="text-label text-status-over">Gagal memuat transaksi.</p>
        ) : data.data.length === 0 ? (
          <EmptyState title="Tidak ada transaksi" description="Belum ada transaksi yang cocok dengan filter ini." />
        ) : (
          <>
            <p className="px-1 text-small text-ink-muted">
              {data.total} transaksi · <span className="tabular-nums font-bold text-ink">{formatRupiah(total)}</span>
              {data.total > data.data.length && ' (yang tampil)'}
            </p>
            <ul className="flex flex-col gap-1 rounded-comfortable bg-surface p-3">
              {data.data.map((t) => (
                <TransactionNoteRow
                  key={t.id}
                  transaction={t}
                  onSaved={() => mutate()}
                  onCategorySaved={() => mutate()}
                  onAliasSaved={() => mutate()}
                  onDeleted={() => mutate()}
                />
              ))}
            </ul>
            {data.total > data.data.length && (
              <button
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                className="rounded-full-pill bg-surface py-3 text-label font-bold text-ink"
              >
                Muat lagi
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsList />
    </Suspense>
  );
}
