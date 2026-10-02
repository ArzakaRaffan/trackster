'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/EmptyState';
import { EASE_ENTER, TRANSITION_FAST } from '@/lib/motion';
import { CalendarDays, ChevronDown, ChevronLeft, Pencil, Plus, Trash2, X } from 'lucide-react';

interface SubscriptionItem {
  id: number;
  name: string;
  amount: number;
  cycle: 'MONTHLY' | 'YEARLY';
  nextDueDate: string;
  source?: 'BCA' | 'JAGO' | 'GOPAY' | null;
  notes?: string | null;
  reminderDaysBefore: number;
  isActive: boolean;
  googleCalendarEventId?: string | null;
  calendarSync?: 'synced' | 'removed' | 'skipped' | 'error';
}

interface FormState {
  name: string;
  amount: string;
  cycle: 'MONTHLY' | 'YEARLY';
  nextDueDate: string;
  source: '' | 'BCA' | 'JAGO';
  notes: string;
  reminderDaysBefore: string;
  isActive: boolean;
}

const fetcher = (url: string) => api.get<SubscriptionItem[]>(url);
const todayISO = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormState => ({
  name: '',
  amount: '',
  cycle: 'MONTHLY',
  nextDueDate: todayISO(),
  source: '',
  notes: '',
  reminderDaysBefore: '3',
  isActive: true,
});

const DAY_MS = 24 * 60 * 60 * 1000;

export default function SubscriptionsPage() {
  const { data: subs, error, isLoading, mutate } = useSWR<SubscriptionItem[]>('/subscriptions', fetcher);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const active = useMemo(() => (subs ?? []).filter((s) => s.isActive), [subs]);
  const inactive = useMemo(() => (subs ?? []).filter((s) => !s.isActive), [subs]);
  const monthlyBurn = active.reduce(
    (sum, s) => sum + (s.cycle === 'YEARLY' ? s.amount / 12 : s.amount),
    0,
  );

  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeForm();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formOpen]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowAdvanced(false);
    setFormOpen(true);
    setBanner(null);
  };

  const openEdit = (s: SubscriptionItem) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      amount: String(s.amount),
      cycle: s.cycle,
      nextDueDate: s.nextDueDate.slice(0, 10),
      source: s.source === 'JAGO' || s.source === 'BCA' ? s.source : '',
      notes: s.notes || '',
      reminderDaysBefore: String(s.reminderDaysBefore ?? 3),
      isActive: s.isActive,
    });
    setShowAdvanced(false);
    setFormOpen(true);
    setBanner(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount) return;
    setSaving(true);
    setBanner(null);
    try {
      const body = {
        name: form.name.trim(),
        amount: parseFloat(form.amount) || 0,
        cycle: form.cycle,
        nextDueDate: new Date(form.nextDueDate).toISOString(),
        source: form.source || undefined,
        notes: form.notes.trim() || undefined,
        reminderDaysBefore: Math.max(0, parseInt(form.reminderDaysBefore, 10) || 0),
        isActive: form.isActive,
      };
      const res = editingId
        ? await api.put<SubscriptionItem>(`/subscriptions/${editingId}`, body)
        : await api.post<SubscriptionItem>('/subscriptions', body);

      if (res.calendarSync === 'skipped' || res.calendarSync === 'error') {
        setBanner(
          res.calendarSync === 'skipped'
            ? 'Langganan tersimpan, tapi Calendar belum tersinkron. Reconnect Google di Setting (butuh izin Calendar).'
            : 'Langganan tersimpan, tapi sync Calendar gagal. Cek Calendar API di Google Cloud + reconnect Google.',
        );
      } else if (res.calendarSync === 'synced') {
        setBanner('Tersimpan dan event Google Calendar sudah di-sync.');
      }

      await mutate();
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus langganan ini? Event Calendar-nya ikut dihapus.')) return;
    await api.delete(`/subscriptions/${id}`);
    await mutate();
  };

  const renderRow = (s: SubscriptionItem) => {
    const due = new Date(s.nextDueDate);
    const daysLeft = Math.ceil((due.getTime() - Date.now()) / DAY_MS);
    const isDueToday = daysLeft === 0;
    const isDueSoon = daysLeft > 0 && daysLeft <= s.reminderDaysBefore;
    const dueBadgeClass = !s.isActive
      ? 'bg-neutral text-text-subtlest'
      : isDueToday
        ? 'bg-status-over-bg text-status-over'
        : isDueSoon
          ? 'bg-status-near-bg text-status-near'
          : 'bg-neutral text-text-subtle';
    const dueLabel = !s.isActive
      ? 'Nonaktif'
      : isDueToday
        ? 'Jatuh tempo hari ini'
        : daysLeft < 0
          ? `Lewat ${Math.abs(daysLeft)} hari`
          : `Est. ${due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;

    return (
      <li
        key={s.id}
        className="flex flex-col gap-2.5 rounded-row bg-neutral p-4 transition-colors duration-fast ease-standard hover:bg-neutral-hover"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-bold text-text">{s.name}</p>
            <p className="mt-0.5 text-micro text-text-subtle">
              {s.cycle === 'YEARLY' ? 'Tahunan' : 'Bulanan'}
              {s.source ? ` · ${s.source}` : ''}
              {s.googleCalendarEventId ? ' · Calendar ✓' : ' · Calendar belum sync'}
              {s.notes ? ` · ${s.notes}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-body font-bold tabular-nums text-text">{formatRupiah(s.amount)}</p>
            <p className="text-micro text-text-subtle">{s.cycle === 'YEARLY' ? '/tahun' : '/bulan'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2 text-micro">
          <span className={`rounded-pill px-2 py-0.5 font-bold ${dueBadgeClass}`}>{dueLabel}</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(s)}
              aria-label="Edit"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:text-text"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              aria-label="Hapus"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:text-status-over"
            >
              <Trash2 size={14} />
            </button>
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      <header className="flex items-center gap-3">
        <Link href="/app/more" aria-label="Kembali" className="text-text-subtle hover:text-text">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Langganan</h1>
          <p className="text-[15px] text-text-subtle">Kelola manual</p>
        </div>
      </header>

      {/* Hero */}
      <section className="rounded-card-lg bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Estimasi pengeluaran bulanan</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-title text-amount-hero font-extrabold tabular-nums text-text">
                {formatRupiah(Math.round(monthlyBurn))}
              </span>
              <span className="text-body font-normal text-text-subtle">/bln</span>
            </div>
          </div>
          <span className="shrink-0 rounded-pill bg-neutral px-2.5 py-1 text-badge font-semibold text-text-subtle">
            {active.length} Aktif
          </span>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-medium bg-neutral p-3.5">
          <CalendarDays size={15} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-small leading-relaxed text-text-subtle">
            Reminder lewat Google Calendar: popup di hari-H dan N hari sebelumnya. Reconnect Google di Setting supaya sync jalan.
          </p>
        </div>
      </section>

      {banner && (
        <div className="rounded-medium bg-neutral p-3 text-small leading-relaxed text-text">{banner}</div>
      )}

      <Button variant="dark" fullWidth icon={<Plus size={18} />} onClick={openCreate}>
        Tambah langganan
      </Button>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-track" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-card bg-card p-4 shadow-card">
          <p className="text-label text-status-over">Gagal memuat langganan.</p>
        </div>
      ) : !subs || subs.length === 0 ? (
        <EmptyState
          mood="think"
          title="Belum ada langganan"
          description="Tambah manual layanan berulang kamu. Trackster akan bikin event di Google Calendar dengan reminder."
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-small font-bold uppercase tracking-caps text-text-subtle">Aktif ({active.length})</p>
              <ul className="flex flex-col gap-2">{active.map(renderRow)}</ul>
            </div>
          )}

          {inactive.length > 0 && (
            <div className="rounded-card bg-card shadow-card">
              <button
                type="button"
                onClick={() => setShowInactive((v) => !v)}
                aria-expanded={showInactive}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex-1 text-small font-bold uppercase tracking-caps text-text-subtle">
                  Nonaktif ({inactive.length})
                </span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-text-subtle transition-transform duration-base ease-standard ${
                    showInactive ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
                style={{ gridTemplateRows: showInactive ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <ul className="flex flex-col gap-2 px-4 pb-4">{inactive.map(renderRow)}</ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal tambah/edit */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FAST}
            onClick={closeForm}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              className="flex max-h-[85vh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-label font-bold text-text">{editingId ? 'Edit langganan' : 'Tambah langganan'}</h2>
                <button type="button" onClick={closeForm} aria-label="Tutup" className="text-text-subtle hover:text-text">
                  <X size={18} />
                </button>
              </div>

              <Input
                label="Nama"
                placeholder="Spotify, Netflix, iCloud…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                label="Nominal"
                type="number"
                inputMode="numeric"
                prefix="Rp"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
              <label className="flex flex-col gap-2">
                <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Siklus</span>
                <select
                  value={form.cycle}
                  onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                  className="w-full appearance-none rounded-medium bg-neutral px-3.5 py-3 text-body text-text shadow-field outline-none focus:shadow-field-focus"
                >
                  <option value="MONTHLY">Bulanan</option>
                  <option value="YEARLY">Tahunan</option>
                </select>
              </label>
              <Input
                label="Jatuh tempo berikutnya"
                type="date"
                value={form.nextDueDate}
                onChange={(e) => setForm((f) => ({ ...f, nextDueDate: e.target.value }))}
                required
              />
              <Input
                label="Reminder (hari sebelum)"
                type="number"
                inputMode="numeric"
                value={form.reminderDaysBefore}
                onChange={(e) => setForm((f) => ({ ...f, reminderDaysBefore: e.target.value }))}
              />

              {/* Rekening / catatan / aktif — collapsible */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="flex w-fit items-center gap-1.5 text-small font-bold text-text-subtle transition-colors hover:text-text"
              >
                <span>Lainnya</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-base ease-standard ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
                style={{ gridTemplateRows: showAdvanced ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col gap-3 pt-1">
                    <label className="flex flex-col gap-2">
                      <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Rekening (opsional)</span>
                      <select
                        value={form.source}
                        onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as FormState['source'] }))}
                        className="w-full appearance-none rounded-medium bg-neutral px-3.5 py-3 text-body text-text shadow-field outline-none focus:shadow-field-focus"
                      >
                        <option value="">—</option>
                        <option value="BCA">BCA</option>
                        <option value="JAGO">Jago</option>
                      </select>
                    </label>
                    <Input
                      label="Catatan (opsional)"
                      placeholder="Family plan, dibayar bareng…"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                    <label className="flex items-center gap-2 text-small text-text">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                        className="h-5 w-5 accent-brand"
                      />
                      Aktif (nonaktif = hapus event Calendar)
                    </label>
                  </div>
                </div>
              </div>

              <Button type="submit" variant="primary" fullWidth disabled={saving || !form.name.trim() || !form.amount}>
                {saving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah & sync Calendar'}
              </Button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
