'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { Button } from './Button';
import { Input } from './Input';
import { SourceTag } from './SourceTag';
import { EASE_ENTER, TRANSITION_BASE } from '@/lib/motion';
import { Pencil, StickyNote, Trash2, X } from 'lucide-react';

export interface NoteableTransaction {
  id: number;
  amount: number;
  description: string;
  source: string;
  occurredAt: string;
  note?: string | null;
  category?: string;
  displayDescription?: string;
  aiCaption?: string | null;
}

const rp = (n: number) => 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
const clock = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export const CATEGORY_LABELS: Record<string, string> = {
  MAKANAN: 'Makanan',
  TRANSPORT: 'Transport',
  BELANJA: 'Belanja',
  TAGIHAN: 'Tagihan',
  HIBURAN: 'Hiburan',
  KESEHATAN: 'Kesehatan',
  LAINNYA: 'Lainnya',
  TRANSFER: 'Transfer',
  TOPUP: 'Top-up',
  PENDIDIKAN: 'Pendidikan',
  PERAWATAN: 'Perawatan',
  INVESTASI: 'Investasi',
  ROKOK: 'Rokok/Vape',
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
  TRANSFER: '#818cf8',
  TOPUP: '#38bdf8',
  PENDIDIKAN: '#facc15',
  PERAWATAN: '#f9a8d4',
  INVESTASI: '#4ade80',
  ROKOK: '#a8a29e',
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS);

export function TransactionNoteRow({
  transaction,
  onSaved,
  onCategorySaved,
  onAliasSaved,
  onDeleted,
}: {
  transaction: NoteableTransaction;
  onSaved?: (id: number, note: string) => void;
  onCategorySaved?: (id: number, category: string) => void;
  onAliasSaved?: (id: number, displayName: string) => void;
  onDeleted?: (id: number) => void;
}) {
  const hasAlias = !!transaction.displayDescription && transaction.displayDescription !== transaction.description;
  const title = transaction.displayDescription ?? transaction.description;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(transaction.note ?? '');
  const [aliasDraft, setAliasDraft] = useState(hasAlias ? transaction.displayDescription! : '');
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingAlias, setSavingAlias] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Esc + klik blanket menutup modal (per README), state draft direset tiap kali dibuka.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openModal = () => {
    setDraft(transaction.note ?? '');
    setAliasDraft(hasAlias ? transaction.displayDescription! : '');
    setOpen(true);
  };

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
      const { count } = await api.get<{ count: number }>(`/transactions/${transaction.id}/same-merchant-count`);
      const applyToAll =
        count > 1 &&
        window.confirm(`Terapkan ke semua transaksi "${title}" (${count})? Transaksi lama ikut ke-update.`);

      await api.patch(`/transactions/${transaction.id}/category`, { category, applyToAll });
      onCategorySaved?.(transaction.id, category);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleAliasSave = async () => {
    setSavingAlias(true);
    try {
      await api.patch(`/transactions/${transaction.id}/alias`, { displayName: aliasDraft });
      onAliasSaved?.(transaction.id, aliasDraft);
    } finally {
      setSavingAlias(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus transaksi "${title}" (${rp(transaction.amount)})? Saldo bank akan disesuaikan balik.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/transactions/${transaction.id}`);
      onDeleted?.(transaction.id);
      setOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="rounded-row transition-colors duration-fast ease-standard hover:bg-hover">
      <button
        type="button"
        onClick={openModal}
        className="flex min-h-[60px] w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral text-label font-bold text-text-subtle">
          {title.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-bold text-text">{title}</span>
          {transaction.aiCaption && (
            <span className="block truncate text-small italic text-text-subtlest">{transaction.aiCaption}</span>
          )}
          <span className="mt-0.75 flex items-center gap-2">
            <SourceTag source={transaction.source} size="sm" />
            <span className="text-small tabular-nums text-text-subtle">{clock(transaction.occurredAt)}</span>
            {transaction.category && transaction.category !== 'LAINNYA' && (
              <span className="rounded-subtle bg-track px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-text-subtle">
                {CATEGORY_LABELS[transaction.category] ?? transaction.category}
              </span>
            )}
            {transaction.note && <StickyNote size={12} className="text-text-subtlest" />}
            {hasAlias && <Pencil size={12} className="text-text-subtlest" />}
          </span>
        </span>
        <span className="shrink-0 text-body font-bold tabular-nums text-text">−{rp(transaction.amount)}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_BASE}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Transaksi ${title}`}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-y-auto rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Transaksi</p>
                  <h3 className="truncate font-title text-heading font-bold text-text">{title}</h3>
                  <p className="mt-1 flex items-center gap-2">
                    <SourceTag source={transaction.source} size="md" />
                    <span className="text-small tabular-nums text-text-subtle">
                      {new Date(transaction.occurredAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {clock(transaction.occurredAt)}
                    </span>
                  </p>
                  <p className="mt-1 text-body font-bold tabular-nums text-text">−{rp(transaction.amount)}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Tutup"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral text-text-subtle transition-colors hover:text-text"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Kategori</span>
                  <span className="relative flex items-center">
                    <select
                      value={transaction.category ?? 'LAINNYA'}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      disabled={savingCategory}
                      className="w-full appearance-none rounded-medium bg-neutral px-3.5 py-3 pr-9 text-body text-text shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus disabled:opacity-50"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 text-small text-text-subtle">▾</span>
                  </span>
                </label>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label="Ganti nama"
                      placeholder={transaction.description}
                      value={aliasDraft}
                      onChange={(e) => setAliasDraft(e.target.value)}
                    />
                  </div>
                  <Button variant="dark" size="md" onClick={handleAliasSave} disabled={savingAlias || !aliasDraft.trim()}>
                    {savingAlias ? '...' : 'Simpan'}
                  </Button>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Catatan</span>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Tulis catatan buat transaksi ini..."
                    rows={2}
                    maxLength={500}
                    className="min-w-0 flex-1 resize-none rounded-medium bg-neutral px-3.5 py-3 text-small text-text shadow-field outline-none transition-shadow duration-base ease-standard placeholder:text-text-subtlest focus:shadow-field-focus"
                  />
                </label>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Menghapus...' : 'Hapus'}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      Batal
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Menyimpan...' : 'Simpan catatan'}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
