'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Plus, X } from 'lucide-react';

const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

interface MemberRow {
  id: string;
  name: string;
}

export default function NewTripPage() {
  const router = useRouter();
  const [membersParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const [tripName, setTripName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([{ id: genId(), name: '' }, { id: genId(), name: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addMember = () => setMembers((m) => [...m, { id: genId(), name: '' }]);
  const removeMember = (id: string) => setMembers((m) => (m.length > 1 ? m.filter((row) => row.id !== id) : m));
  const updateMember = (id: string, value: string) =>
    setMembers((m) => m.map((row) => (row.id === id ? { ...row, name: value } : row)));

  const validMembers = members.filter((m) => m.name.trim().length > 0);
  const canSubmit = tripName.trim().length > 0 && validMembers.length >= 2;

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await api.post<{ ownerToken?: string | null; publicSlug: string }>('/trips/public', {
        name: tripName.trim(),
        currency: 'IDR',
        members: validMembers.map((m) => ({ name: m.name.trim() })),
        expenses: [],
      });
      router.push(created.ownerToken ? `/trip/manage/${created.ownerToken}` : `/t/${created.publicSlug}`);
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Gagal membuat trip.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-16 animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.9] px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-content items-center gap-3">
          <button onClick={() => router.back()} aria-label="Kembali" className="text-ink-muted hover:text-ink">
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Patungan Trip</p>
            <h1 className="font-title text-title font-bold">Trip Baru</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-content flex-col gap-4 px-4">
        {errorMsg && (
          <div className="rounded-medium bg-status-over-bg px-4 py-3 text-small text-status-over">{errorMsg}</div>
        )}

        <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <Input
            label="Nama trip"
            placeholder="Liburan Bali, ngekos bareng, acara kelas..."
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <div>
            <h2 className="text-heading font-bold">Anggota</h2>
            <p className="mt-1 text-small text-ink-muted">Siapa aja yang ikut? Minimal 2 orang.</p>
          </div>
          <div ref={membersParent} className="flex flex-col gap-2">
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral text-small font-bold text-ink-muted">
                  {i + 1}
                </span>
                <input
                  placeholder={`Nama anggota ${i + 1}`}
                  value={m.name}
                  onChange={(e) => updateMember(m.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMember();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-pill bg-neutral px-3.5 py-2.5 text-body text-ink shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-ink-subtle"
                />
                {members.length > 2 && (
                  <button
                    onClick={() => removeMember(m.id)}
                    aria-label={`Hapus anggota ${i + 1}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addMember}>
            Tambah anggota
          </Button>
        </section>

        <p className="px-1 text-small leading-relaxed text-ink-muted">
          Setelah trip dibuat, kamu bisa tambah pengeluaran (siapa bayar, dibagi ke siapa aja). Trackster hitung
          otomatis siapa harus transfer ke siapa supaya transfernya paling sedikit.
        </p>

        <Button variant="primary" fullWidth size="lg" onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? 'Menyimpan...' : 'Buat Trip'}
        </Button>
      </div>
    </div>
  );
}
