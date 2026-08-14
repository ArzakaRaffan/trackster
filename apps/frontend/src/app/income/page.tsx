'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SourceTag } from '@/components/ui/SourceTag';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import { Inbox, Pencil, Plus, Trash2, X } from 'lucide-react';

interface Income {
  id: number;
  amount: number;
  description: string;
  source: 'BCA' | 'JAGO' | 'GOPAY';
  receivedAt: string;
}

const fetcher = (path: string) => api.get<Income[]>(path);

const todayISO = () => new Date().toISOString().slice(0, 10);

interface FormState {
  amount: string;
  description: string;
  source: 'BCA' | 'JAGO';
  receivedAt: string;
}

const emptyForm: FormState = { amount: '', description: '', source: 'BCA', receivedAt: todayISO() };

export default function IncomePage() {
  const { data, error, isLoading, mutate } = useSWR('/income', fetcher);
  // duration/easing match the fade-in token (200ms, ease-standard) used everywhere else in the app.
  const [listParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (income: Income) => {
    setEditingId(income.id);
    setForm({
      amount: String(income.amount),
      description: income.description,
      source: income.source === 'GOPAY' ? 'BCA' : income.source,
      receivedAt: income.receivedAt.slice(0, 10),
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const body = {
        amount: parseFloat(form.amount) || 0,
        description: form.description,
        source: form.source,
        receivedAt: new Date(form.receivedAt).toISOString(),
      };
      if (editingId) {
        await api.put(`/income/${editingId}`, body);
      } else {
        await api.post('/income', body);
      }
      await mutate();
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/income/${id}`);
    mutate();
  };

  const total = data?.reduce((sum, i) => sum + Number(i.amount), 0) ?? 0;

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Pemasukan manual</p>
          <h1 className="font-title text-title font-bold text-ink">Pemasukan</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <section className="rounded-medium bg-surface p-5">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Total tercatat</p>
          <AnimatedAmount
            value={total}
            className="font-title text-amount font-black tracking-[-1px] tabular-nums text-status-under"
          />
        </section>

        <AnimatePresence initial={false}>
          {formOpen ? (
            <motion.section
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={TRANSITION_SLOW}
              className="overflow-hidden rounded-comfortable bg-surface"
            >
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-label font-bold text-ink">{editingId ? 'Edit pemasukan' : 'Tambah pemasukan'}</h2>
                  <button onClick={closeForm} aria-label="Tutup" className="text-ink-muted hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                <Input
                  label="Nominal"
                  type="number"
                  inputMode="numeric"
                  prefix="Rp"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
                <Input
                  label="Deskripsi"
                  placeholder="Gaji, transfer, dll"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <label className="flex flex-col gap-2">
                  <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Sumber</span>
                  <span className="relative flex items-center">
                    <select
                      value={form.source}
                      onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as 'BCA' | 'JAGO' }))}
                      className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-3 pr-9 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
                    >
                      <option value="BCA">BCA</option>
                      <option value="JAGO">Jago</option>
                    </select>
                    <span className="pointer-events-none absolute right-3.5 text-small text-ink-muted">▾</span>
                  </span>
                </label>
                <Input
                  label="Tanggal"
                  type="date"
                  value={form.receivedAt}
                  onChange={(e) => setForm((f) => ({ ...f, receivedAt: e.target.value }))}
                />
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleSubmit}
                  disabled={saving || !form.amount || !form.description}
                >
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah pemasukan'}
                </Button>
              </div>
            </motion.section>
          ) : (
            <motion.div
              key="trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION_BASE}
            >
              <Button variant="dark" fullWidth icon={<Plus size={18} />} onClick={openCreateForm}>
                Tambah pemasukan
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

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
            <p className="text-body font-bold text-ink">Belum ada pemasukan</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">
              Catat pemasukan manual kayak gaji atau transfer masuk yang nggak lewat notifikasi email.
            </p>
          </div>
        ) : (
          <ul ref={listParent} className="rounded-comfortable bg-surface p-2">
            {data.map((income) => (
              <li
                key={income.id}
                className="flex min-h-[56px] items-center gap-3 rounded-standard px-3 py-2.5 transition-colors duration-fast ease-standard hover:bg-white/[0.07]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-ink">{income.description}</span>
                  <span className="mt-0.75 flex items-center gap-2">
                    <SourceTag source={income.source} size="sm" />
                    <span className="text-small tabular-nums text-ink-muted">
                      {new Date(income.receivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-body font-bold tabular-nums text-status-under">
                  +{formatRupiah(income.amount)}
                </span>
                <button
                  onClick={() => openEditForm(income)}
                  aria-label="Edit"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(income.id)}
                  aria-label="Hapus"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
