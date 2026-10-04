'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { Check, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from './Button';
import { Input } from './Input';

export interface Reimbursement {
  id: number;
  transactionId: number;
  personName: string;
  amount: number | string;
  status: 'PENDING' | 'RECEIVED';
  receivedSource?: string | null;
  transaction?: { id: number; description: string; occurredAt: string; source: string };
}

const SOURCES = ['BCA', 'JAGO'] as const;

/** Patungan mengubah angka di banyak halaman (budget, mingguan, analisis) — revalidasi semua key SWR. */
export function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return () => mutate(() => true);
}

/** Satu baris patungan: nama, nominal, status; PENDING → pilih rekening + "Sudah transfer". */
export function ReimbursementItem({
  r,
  defaultSource,
  subtitle,
  onChanged,
}: {
  r: Reimbursement;
  defaultSource: string;
  subtitle?: string;
  onChanged: () => void;
}) {
  const [source, setSource] = useState(defaultSource);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChanged();
    } catch (e: any) {
      setError(e.message || 'Gagal');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    const warn = r.status === 'RECEIVED' ? ` Saldo ${r.receivedSource} akan dikurangi balik.` : '';
    if (!window.confirm(`Hapus patungan ${r.personName} (${formatRupiah(Number(r.amount))})?${warn}`)) return;
    run(() => api.delete(`/reimbursements/${r.id}`));
  };

  return (
    <li className="flex flex-col gap-2 rounded-medium bg-neutral px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-label font-bold text-text">
            {r.personName} · {formatRupiah(Number(r.amount))}
          </p>
          <p className="truncate text-small text-text-subtle">
            {r.status === 'RECEIVED' ? `Diterima ke ${r.receivedSource}` : 'Menunggu transfer'}
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          aria-label={`Hapus patungan ${r.personName}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:text-danger disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {r.status === 'PENDING' && (
        <div className="flex items-center gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={busy}
            aria-label="Rekening tujuan"
            className="rounded-medium bg-card px-2 py-1.5 text-small text-text outline-none"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            icon={<Check size={14} />}
            disabled={busy}
            onClick={() => run(() => api.post(`/reimbursements/${r.id}/received`, { source }))}
          >
            Sudah transfer
          </Button>
        </div>
      )}
      {error && <p className="text-small text-danger">{error}</p>}
    </li>
  );
}

/** Section "Patungan" di modal detail transaksi: daftar + form tambah. */
export function ReimbursementSection({ transactionId, source }: { transactionId: number; source: string }) {
  const refreshAll = useRefreshAll();
  const key = `/reimbursements?transactionId=${transactionId}`;
  const { data, mutate } = useSWR<Reimbursement[]>(key, (p: string) => api.get<Reimbursement[]>(p));
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const changed = () => {
    mutate();
    refreshAll();
  };

  const handleAdd = async () => {
    setAdding(true);
    setError('');
    try {
      await api.post('/reimbursements', { transactionId, personName: name.trim(), amount: Number(amount) });
      setName('');
      setAmount('');
      changed();
    } catch (e: any) {
      setError(e.message || 'Gagal menambah patungan');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Patungan</span>
      {data && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((r) => (
            <ReimbursementItem key={r.id} r={r} defaultSource={source} onChanged={changed} />
          ))}
        </ul>
      )}
      <p className="text-small text-text-subtlest">
        Nominal bayar-duluan yang diganti orang lain. Pengeluaran baru berkurang setelah ditandai sudah transfer.
      </p>
      <Input placeholder="Nama (mis. Ibnu)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input type="number" inputMode="numeric" min={1} placeholder="Jumlah" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button variant="dark" size="md" onClick={handleAdd} disabled={adding || !name.trim() || !(Number(amount) > 0)}>
          {adding ? '...' : 'Tambah'}
        </Button>
      </div>
      {error && <p className="text-small text-danger">{error}</p>}
    </div>
  );
}
