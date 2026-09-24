'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { CATEGORY_LABELS } from '@/components/ui/TransactionNoteRow';
import { Sparkles } from 'lucide-react';

interface MerchantGroup {
  merchantKey: string;
  representativeId: number;
  description: string;
  count: number;
  totalAmount: number;
}

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS).filter((c) => c !== 'LAINNYA');

const fetcher = (path: string) => api.get<MerchantGroup[]>(path);

export default function CategorizePage() {
  const { data: groups, mutate } = useSWR('/transactions/uncategorized-merchants', fetcher);
  const [listRef] = useAutoAnimate();

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Bebenah data</p>
        <h1 className="font-title text-title font-bold text-ink">Rapikan Kategori</h1>
        <p className="mt-1 text-small text-ink-muted">
          Merchant yang masih "Lainnya", dikelompokkan & diurut dari nominal terbesar.
        </p>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {!groups && <p className="text-small text-ink-muted">Memuat...</p>}
        {groups && groups.length === 0 && (
          <div className="rounded-comfortable bg-surface p-5 text-center">
            <p className="text-body font-semibold text-ink">Mantap, semua sudah dikategorikan!</p>
            <p className="mt-1 text-small text-ink-muted">Nggak ada transaksi "Lainnya" tersisa.</p>
          </div>
        )}

        <div ref={listRef} className="flex flex-col gap-3">
          {groups?.map((g) => (
            <MerchantGroupRow
              key={g.merchantKey}
              group={g}
              onApplied={() => mutate(groups.filter((x) => x.merchantKey !== g.merchantKey), false)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MerchantGroupRow({ group, onApplied }: { group: MerchantGroup; onApplied: () => void }) {
  const [category, setCategory] = useState<string>('');
  const [suggesting, setSuggesting] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const { category: suggested } = await api.post<{ category: string }>('/ai/suggest-category', {
        description: group.description,
        amount: group.totalAmount / group.count,
      });
      setCategory(suggested);
    } finally {
      setSuggesting(false);
    }
  };

  const handleApply = async () => {
    if (!category) return;
    setApplying(true);
    try {
      await api.patch(`/transactions/${group.representativeId}/category`, { category, applyToAll: true });
      onApplied();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-comfortable bg-surface p-4">
      <p className="text-body font-semibold text-ink">{group.description}</p>
      <p className="mt-0.5 text-small text-ink-muted">
        {group.count}x transaksi · total {formatRupiah(group.totalAmount)}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className="relative flex flex-1 items-center">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-2.5 pr-9 text-small text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
          >
            <option value="">Pilih kategori...</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3.5 text-small text-ink-muted">▾</span>
        </span>

        <Button variant="outlined" onClick={handleSuggest} disabled={suggesting} icon={<Sparkles size={16} />}>
          {suggesting ? '...' : 'Saran AI'}
        </Button>
      </div>

      <Button variant="dark" fullWidth className="mt-2" onClick={handleApply} disabled={!category || applying}>
        {applying ? 'Menerapkan...' : `Terapkan ke ${group.count} transaksi`}
      </Button>
    </div>
  );
}
