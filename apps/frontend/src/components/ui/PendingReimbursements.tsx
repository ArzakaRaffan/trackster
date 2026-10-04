'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { ReimbursementItem, useRefreshAll, type Reimbursement } from './ReimbursementSection';

/** Piutang patungan yang belum ditransfer. Tidak render apa-apa kalau kosong. */
export function PendingReimbursements() {
  const refreshAll = useRefreshAll();
  const { data } = useSWR<Reimbursement[]>('/reimbursements', (p: string) => api.get<Reimbursement[]>(p));
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, r) => s + Number(r.amount), 0);
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  return (
    <section className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-card">
      <div className="flex items-baseline gap-3">
        <h2 className="flex-1 text-heading font-bold text-text">Menunggu patungan</h2>
        <span className="text-small font-bold tabular-nums text-text-subtle">{formatRupiah(total)}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {data.map((r) => (
          <ReimbursementItem
            key={r.id}
            r={r}
            defaultSource={r.transaction?.source ?? 'BCA'}
            subtitle={r.transaction ? `${r.transaction.description}, ${dateLabel(r.transaction.occurredAt)}` : undefined}
            onChanged={refreshAll}
          />
        ))}
      </ul>
    </section>
  );
}
