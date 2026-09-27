'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { ChevronLeft, Pencil, Plus, RotateCcw, Trash2, X, Archive as ArchiveIcon } from 'lucide-react';

type MemoryKind = 'PROFILE' | 'GOAL' | 'PLAN' | 'PREFERENCE' | 'CONCERN' | 'EVENT' | 'DECISION';

interface Memory {
  id: number;
  kind: MemoryKind;
  content: string;
  importance: number;
  validUntil: string | null;
  archivedAt: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<MemoryKind, string> = {
  PROFILE: 'Profil',
  GOAL: 'Tujuan',
  PLAN: 'Rencana',
  PREFERENCE: 'Preferensi',
  CONCERN: 'Kekhawatiran',
  EVENT: 'Acara',
  DECISION: 'Keputusan',
};

const fetcher = (path: string) => api.get<Memory[]>(path);

interface FormState {
  content: string;
  kind: MemoryKind;
  importance: number;
  validUntil: string;
}

const emptyForm: FormState = { content: '', kind: 'PROFILE', importance: 2, validUntil: '' };

function memoryToForm(m: Memory): FormState {
  return { content: m.content, kind: m.kind, importance: m.importance, validUntil: m.validUntil?.slice(0, 10) ?? '' };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MemoryPage() {
  const { data, mutate, isLoading } = useSWR<Memory[]>('/ai/memory', fetcher);
  const [listParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = (data ?? []).filter((m) => !m.archivedAt).sort((a, b) => b.importance - a.importance);
  const archived = (data ?? []).filter((m) => m.archivedAt);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (m: Memory) => {
    setEditingId(m.id);
    setForm(memoryToForm(m));
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
        content: form.content.trim(),
        kind: form.kind,
        importance: form.importance,
        validUntil: form.validUntil || undefined,
      };
      if (editingId) {
        await api.patch(`/ai/memory/${editingId}`, body);
      } else {
        await api.post('/ai/memory', body);
      }
      await mutate();
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const archiveMemory = async (id: number) => {
    await api.patch(`/ai/memory/${id}`, { archived: true });
    mutate();
  };

  const restoreMemory = async (id: number) => {
    await api.patch(`/ai/memory/${id}`, { archived: false });
    mutate();
  };

  const deleteMemory = async (id: number) => {
    await api.delete(`/ai/memory/${id}`);
    mutate();
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <Link href="/app/chat" aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Tanya Track</p>
          <h1 className="font-title text-title font-bold text-ink">Yang Track Ingat</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <p className="text-small leading-relaxed text-ink-muted">
          Fakta tentang kamu yang Track pakai buat ngobrol lebih nyambung — diambil otomatis dari chat, atau kamu
          tambah/edit sendiri di sini.
        </p>

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
                  <h2 className="text-label font-bold text-ink">{editingId ? 'Edit memory' : 'Tambah memory'}</h2>
                  <button onClick={closeForm} aria-label="Tutup" className="text-ink-muted hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                <label className="flex flex-col gap-2">
                  <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Isi</span>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    placeholder="Contoh: Arzaka ingin beli laptop ±Rp12jt sebelum Juni 2027"
                    rows={3}
                    className="w-full resize-none rounded-comfortable bg-surface-interactive px-3.5 py-3 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Jenis</span>
                    <select
                      value={form.kind}
                      onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as MemoryKind }))}
                      className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-3 text-body text-ink shadow-field outline-none"
                    >
                      {(Object.keys(KIND_LABEL) as MemoryKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-small font-bold uppercase tracking-caps text-ink-muted">Penting</span>
                    <select
                      value={form.importance}
                      onChange={(e) => setForm((f) => ({ ...f, importance: Number(e.target.value) }))}
                      className="w-full appearance-none rounded-comfortable bg-surface-interactive px-3.5 py-3 text-body text-ink shadow-field outline-none"
                    >
                      <option value={1}>Rendah</option>
                      <option value={2}>Sedang</option>
                      <option value={3}>Tinggi</option>
                    </select>
                  </label>
                </div>
                <Input
                  label="Berlaku sampai (opsional)"
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                  hint="Buat acara/rencana bertanggal — otomatis diarsip setelah lewat"
                />
                <Button variant="primary" fullWidth onClick={handleSubmit} disabled={saving || !form.content.trim()}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah memory'}
                </Button>
              </div>
            </motion.section>
          ) : (
            <motion.div key="trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TRANSITION_BASE}>
              <Button variant="dark" fullWidth icon={<Plus size={18} />} onClick={openCreateForm}>
                Tambah memory manual
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-comfortable bg-track" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-comfortable p-8 text-center shadow-hairline">
            <p className="text-body font-bold text-ink">Belum ada yang diingat</p>
            <p className="max-w-[280px] text-small leading-relaxed text-ink-muted">
              Ngobrol sama Track soal rencana/preferensi kamu, atau tambah manual di atas.
            </p>
          </div>
        ) : (
          <div ref={listParent} className="flex flex-col gap-2">
            {active.map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-comfortable bg-surface px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-subtle bg-track px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-ink-muted">
                      {KIND_LABEL[m.kind]}
                    </span>
                    <span className="flex gap-0.5">
                      {[1, 2, 3].map((n) => (
                        <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= m.importance ? 'bg-brand' : 'bg-track'}`} />
                      ))}
                    </span>
                  </span>
                  <p className="mt-1.5 text-body leading-relaxed text-ink">{m.content}</p>
                  {m.validUntil && <p className="mt-1 text-micro text-ink-muted">Berlaku sampai {fmtDate(m.validUntil)}</p>}
                </span>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => openEditForm(m)}
                    aria-label="Edit"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => archiveMemory(m.id)}
                    aria-label="Arsipkan"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                  >
                    <ArchiveIcon size={13} />
                  </button>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    aria-label="Hapus"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <section className="rounded-comfortable bg-surface p-2">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex w-full items-center justify-between px-2 py-2 text-small font-bold uppercase tracking-caps text-ink-muted"
            >
              <span>Diarsipkan ({archived.length})</span>
              <span>{showArchived ? '▾' : '▸'}</span>
            </button>
            {showArchived && (
              <div className="flex flex-col gap-1 px-1 pb-1">
                {archived.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 rounded-standard px-2.5 py-2 opacity-60">
                    <span className="min-w-0 flex-1">
                      <span className="rounded-subtle bg-track px-1.5 py-0.5 text-micro font-bold uppercase tracking-caps text-ink-muted">
                        {KIND_LABEL[m.kind]}
                      </span>
                      <p className="mt-1 text-small leading-relaxed text-ink-muted">{m.content}</p>
                    </span>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        onClick={() => restoreMemory(m.id)}
                        aria-label="Pulihkan"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        aria-label="Hapus permanen"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
