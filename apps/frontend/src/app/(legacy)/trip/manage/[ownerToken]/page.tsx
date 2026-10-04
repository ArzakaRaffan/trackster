'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { TripSummary } from '@/lib/tripTypes';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, Check, Copy, Receipt, Share2 } from 'lucide-react';

const fetcher = (path: string) => api.get<TripSummary>(path);
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ManageTripPage() {
  const { ownerToken } = useParams<{ ownerToken: string }>();
  const { data, error, isLoading, mutate } = useSWR(
    ownerToken ? `/trips/manage/${ownerToken}` : null,
    fetcher,
  );
  const [listParent] = useAutoAnimate({ duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
  const [copied, setCopied] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidByIndex, setPaidByIndex] = useState(0);
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleShare = (id: string) =>
    setShareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const copyPublicLink = () => {
    if (!data) return;
    const url = `${window.location.origin}/t/${data.publicSlug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addExpense = async () => {
    if (!data || num(amount) <= 0 || !description.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const shares = shareIds.map((id) => ({
        memberIndex: data.members.findIndex((m) => m.id.toString() === id),
        weight: 1,
      })).filter((s) => s.memberIndex !== -1);

      await api.patch(`/trips/manage/${ownerToken}/expenses`, {
        description: description.trim(),
        amount: num(amount),
        paidByMemberIndex: paidByIndex,
        shares: shares.length > 0 ? shares : [{ memberIndex: paidByIndex, weight: 1 }],
      });
      setDescription('');
      setAmount('');
      setShareIds([]);
      mutate();
    } catch (e) {
      setErrorMsg('Gagal menambah pengeluaran.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-4">
        <div className="h-52 w-full max-w-content animate-pulse rounded-panel bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral text-ink-muted">
          <Receipt size={24} />
        </span>
        <p className="text-body font-bold">Trip nggak ketemu</p>
        <p className="max-w-[260px] text-small text-ink-muted">Link kelola mungkin salah atau trip-nya udah dihapus.</p>
      </div>
    );
  }

  const paidMember = data.members[paidByIndex]?.name ?? '?';

  return (
    <div className="pb-16 animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.9] px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-content items-center gap-3">
          <Link href="/tools" aria-label="Kembali ke tools" className="text-ink-muted hover:text-ink">
            <ArrowLeft size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Kelola trip</p>
            <h1 className="truncate font-title text-title font-bold">{data.name}</h1>
          </div>
          <Button size="sm" variant="outlined" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyPublicLink}>
            {copied ? 'Tersalin' : 'Salin Link'}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-content flex-col gap-4 px-4">
        <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <h2 className="text-heading font-bold">Tambah Pengeluaran</h2>
          <Input label="Deskripsi" placeholder="Sewa villa, bensin, makan malam..." value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input label="Nominal" type="number" inputMode="numeric" prefix="Rp" value={amount} onChange={(e) => setAmount(e.target.value)} />

          <div>
            <p className="mb-1 text-small font-bold uppercase tracking-caps text-ink-muted">Dibayar oleh</p>
            <div className="flex flex-wrap gap-1.5">
              {data.members.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setPaidByIndex(i)}
                  className={`rounded-pill px-3 py-1 text-small font-bold transition-colors duration-fast ease-standard ${
                    paidByIndex === i ? 'bg-brand text-on-brand' : 'bg-neutral text-ink-muted hover:text-ink'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-small font-bold uppercase tracking-caps text-ink-muted">Dibagi ke</p>
            <div className="flex flex-wrap gap-1.5">
              {data.members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleShare(m.id.toString())}
                  className={`rounded-pill px-3 py-1 text-small font-bold transition-colors duration-fast ease-standard ${
                    shareIds.includes(m.id.toString()) ? 'bg-brand-subtle text-brand shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]' : 'bg-neutral text-ink-muted hover:text-ink'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-micro text-ink-subtle">
              Kosongkan = cuma {paidMember} yang tanggung.
            </p>
          </div>

          {errorMsg && <p className="text-small text-status-over">{errorMsg}</p>}
          <Button variant="primary" fullWidth onClick={addExpense} disabled={saving || num(amount) <= 0 || !description.trim()}>
            {saving ? 'Menyimpan...' : 'Tambah Pengeluaran'}
          </Button>
        </section>

        <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
          <h2 className="text-heading font-bold">Pengeluaran</h2>
          {data.expenses.length === 0 ? (
            <p className="py-4 text-center text-small text-ink-muted">Belum ada pengeluaran. Tambah di atas.</p>
          ) : (
            <ul ref={listParent} className="flex flex-col gap-1">
              {data.expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-row px-2 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body">{e.description}</span>
                    <span className="block text-micro text-ink-subtle">
                      {data.members.find((m) => m.id === e.paidByMemberId)?.name ?? '?'} bayar
                      {e.shares.length > 0 && ` · dibagi ${e.shares.length} orang`}
                    </span>
                  </span>
                  <span className="shrink-0 text-body tabular-nums">{formatRupiah(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-line-subtle pt-3">
            <span className="text-small text-ink-muted">Total pengeluaran</span>
            <span className="text-body font-bold tabular-nums">{formatRupiah(data.totalSpent)}</span>
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-heading font-bold">Settle up</h2>
            <Button
              size="sm"
              variant="outlined"
              icon={<Share2 size={14} />}
              onClick={() => {
                const lines = data.settlements.map((t) => `${t.fromName} → ${t.toName}: ${formatRupiah(t.amount)}`);
                const text = encodeURIComponent(`*Settle up ${data.name}*\n${lines.join('\n')}\n\n${window.location.origin}/t/${data.publicSlug}`);
                window.open(`https://wa.me/?text=${text}`, '_blank');
              }}
            >
              Share WA
            </Button>
          </div>
          {data.settlements.length === 0 ? (
            <p className="py-4 text-center text-small text-ink-muted">Semua udah beres — nggak ada yang perlu transfer.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.settlements.map((t, i) => (
                <li key={i} className="flex items-center gap-3 rounded-row bg-surface-interactive px-3 py-2.5">
                  <span className="text-body">
                    <span className="font-bold">{t.fromName}</span>
                    <span className="text-ink-muted"> → </span>
                    <span className="font-bold">{t.toName}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-body font-bold tabular-nums text-brand">{formatRupiah(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
