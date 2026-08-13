'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from './Button';
import { StickyNote } from 'lucide-react';

export interface NoteableTransaction {
  id: number;
  amount: number;
  description: string;
  source: string;
  occurredAt: string;
  note?: string | null;
  category?: string;
}

const rp = (n: number) => 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
const clock = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const SOURCE_STYLE: Record<string, string> = {
  BCA: 'bg-source-bca-bg text-source-bca',
  JAGO: 'bg-source-jago-bg text-source-jago',
};
const sourceLabel = (source: string) => (source === 'JAGO' ? 'Jago' : source);

export const CATEGORY_LABELS: Record<string, string> = {
  MAKANAN: 'Makanan',
  TRANSPORT: 'Transport',
  BELANJA: 'Belanja',
  TAGIHAN: 'Tagihan',
  HIBURAN: 'Hiburan',
  KESEHATAN: 'Kesehatan',
  LAINNYA: 'Lainnya',
};

// Palet kategori sengaja beda dari warna reserved (brand hijau, status triad, source biru/oranye)
// biar chart kategori nggak ketuker makna sama status budget atau tag sumber bank.
export const CATEGORY_COLORS: Record<string, string> = {
  MAKANAN: '#fb7185',
  TRANSPORT: '#2dd4bf',
  BELANJA: '#c084fc',
  TAGIHAN: '#fbbf24',
  HIBURAN: '#f472b6',
  KESEHATAN: '#22d3ee',
  LAINNYA: '#94a3b8',
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS);

export function TransactionNoteRow({
  transaction,
  onSaved,
  onCategorySaved,
}: {
  transaction: NoteableTransaction;
  onSaved?: (id: number, note: string) => void;
  onCategorySaved?: (id: number, category: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(transaction.note ?? '');
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/transactions/${transaction.id}/note`, { note: draft });
      onSaved?.(transaction.id, draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = async (category: string) => {
    setSavingCategory(true);
    try {
      await api.patch(`/transactions/${transaction.id}/category`, { category });
      onCategorySaved?.(transaction.id, category);
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <li className="rounded-standard px-3 py-2.5 transition-colors duration-fast ease-standard hover:bg-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[56px] w-full items-center gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-label font-bold text-ink-muted">
          {transaction.description.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-bold text-ink">{transaction.description}</span>
          <span className="mt-0.75 flex items-center gap-2">
            <span
              className={`rounded-subtle px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps ${
                SOURCE_STYLE[transaction.source] || 'bg-track text-ink-muted'
              }`}
            >
              {sourceLabel(transaction.source)}
            </span>
            <span className="text-small tabular-nums text-ink-muted">{clock(transaction.occurredAt)}</span>
            {transaction.category && transaction.category !== 'LAINNYA' && (
              <span className="rounded-subtle bg-track px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-ink-muted">
                {CATEGORY_LABELS[transaction.category] ?? transaction.category}
              </span>
            )}
            {transaction.note && <StickyNote size={12} className="text-ink-subtle" />}
          </span>
        </span>
        <span className="shrink-0 text-body font-bold tabular-nums text-ink">−{rp(transaction.amount)}</span>
      </button>

      {open && (
        <div className="flex animate-fade-in-up flex-col gap-2 px-1 pb-2 pt-1">
          <label className="flex flex-col gap-2">
            <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Kategori</span>
            <span className="relative flex items-center">
              <select
                value={transaction.category ?? 'LAINNYA'}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={savingCategory}
                className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-3 pr-9 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus disabled:opacity-50"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3.5 text-small text-ink-muted">▾</span>
            </span>
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tulis catatan buat transaksi ini..."
            rows={2}
            maxLength={500}
            className="min-w-0 flex-1 resize-none rounded-comfortable bg-surface-interactive px-3.5 py-3 text-small text-ink shadow-field outline-none transition-shadow duration-base ease-standard placeholder:text-ink-subtle focus:shadow-field-focus"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan catatan'}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
