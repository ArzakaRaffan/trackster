'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChevronLeft, CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react';

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

  const active = useMemo(() => (subs ?? []).filter((s) => s.isActive), [subs]);
  const inactive = useMemo(() => (subs ?? []).filter((s) => !s.isActive), [subs]);
  const monthlyBurn = active.reduce(
    (sum, s) => sum + (s.cycle === 'YEARLY' ? s.amount / 12 : s.amount),
    0,
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
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
      ? 'bg-surface-interactive text-ink-subtle'
      : isDueToday
        ? 'bg-status-over-bg text-status-over'
        : isDueSoon
          ? 'bg-status-near-bg text-status-near'
          : 'bg-surface-interactive text-ink-muted';
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
        className="flex flex-col gap-2.5 rounded-comfortable bg-surface p-4 transition-colors duration-base ease-standard hover:bg-surface-alt"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-bold text-ink">{s.name}</p>
            <p className="mt-0.5 text-micro text-ink-muted">
              {s.cycle === 'YEARLY' ? 'Tahunan' : 'Bulanan'}
              {s.source ? ` · ${s.source}` : ''}
              {s.googleCalendarEventId ? ' · Calendar ✓' : ' · Calendar belum sync'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-body font-bold tabular-nums text-ink">{formatRupiah(s.amount)}</p>
            <p className="text-micro text-ink-muted">{s.cycle === 'YEARLY' ? '/tahun' : '/bulan'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line-subtle pt-2 text-micro">
          <span className={`rounded-full px-2 py-0.5 font-bold ${dueBadgeClass}`}>{dueLabel}</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(s)}
              aria-label="Edit"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              aria-label="Hapus"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
            >
              <Trash2 size={14} />
            </button>
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <Link href="/app/more" aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Kelola manual</p>
          <h1 className="font-title text-title font-bold text-ink">Langganan</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <section className="rounded-medium bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                Estimasi pengeluaran bulanan
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-title text-amount-hero font-extrabold tabular-nums text-ink">
                  {formatRupiah(Math.round(monthlyBurn))}
                </span>
                <span className="text-body font-normal text-ink-muted">/bln</span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-surface-interactive px-2.5 py-1 text-badge font-semibold text-ink-muted">
              {active.length} Aktif
            </span>
          </div>
          <p className="mt-3 flex items-start gap-2 text-small leading-relaxed text-ink-muted">
            <CalendarDays size={15} className="mt-0.5 shrink-0 text-brand" />
            Reminder lewat Google Calendar: popup di hari-H dan N hari sebelumnya. Reconnect Google di Setting supaya sync jalan.
          </p>
        </section>

        {banner && (
          <div className="rounded-comfortable bg-surface-interactive p-3 text-small leading-relaxed text-ink-secondary">
            {banner}
          </div>
        )}

        {!formOpen ? (
          <Button variant="dark" fullWidth icon={<Plus size={18} />} onClick={openCreate}>
            Tambah langganan
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-comfortable bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-label font-bold text-ink">{editingId ? 'Edit langganan' : 'Tambah langganan'}</h2>
              <button type="button" onClick={closeForm} aria-label="Tutup" className="text-ink-muted hover:text-ink">
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
              <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Siklus</span>
              <select
                value={form.cycle}
                onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-3 text-body text-ink shadow-field outline-none focus:shadow-field-focus"
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
            <label className="flex flex-col gap-2">
              <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Rekening (opsional)</span>
              <select
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as FormState['source'] }))}
                className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-3 text-body text-ink shadow-field outline-none focus:shadow-field-focus"
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
            <label className="flex items-center gap-2 text-small text-ink">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Aktif (nonaktif = hapus event Calendar)
            </label>
            <Button type="submit" variant="primary" fullWidth disabled={saving || !form.name.trim() || !form.amount}>
              {saving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah & sync Calendar'}
            </Button>
          </form>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-comfortable bg-track" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-comfortable bg-surface p-4">
            <p className="text-label text-status-over">Gagal memuat langganan.</p>
          </div>
        ) : !subs || subs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-comfortable p-8 text-center shadow-hairline">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <CalendarDays size={22} />
            </span>
            <p className="text-body font-bold text-ink">Belum ada langganan</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">
              Tambah manual layanan berulang kamu. Trackster akan bikin event di Google Calendar dengan reminder.
            </p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="px-1 text-small font-bold uppercase tracking-caps text-ink-muted">Aktif ({active.length})</p>
                <ul className="flex flex-col gap-2">{active.map(renderRow)}</ul>
              </div>
            )}
            {inactive.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="px-1 text-small font-bold uppercase tracking-caps text-ink-muted">
                  Nonaktif ({inactive.length})
                </p>
                <ul className="flex flex-col gap-2">{inactive.map(renderRow)}</ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}