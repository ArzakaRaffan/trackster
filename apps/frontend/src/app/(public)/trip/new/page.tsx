'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { avatarCss } from '@/lib/avatars';
import ThemeToggle from '@/components/legal/ThemeToggle';
import { AvatarPicker } from '@/components/avatar/AvatarPicker';

const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const bg = (name: string, avatar?: string | null): React.CSSProperties => ({ background: avatarCss(name, avatar).slice('background:'.length) });

interface MemberRow {
  id: string;
  name: string;
  avatar?: string; // hanya terisi kalau dipilih manual; kosong = otomatis dari nama
}

export default function NewTripPage() {
  const router = useRouter();

  const [tripName, setTripName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([{ id: genId(), name: '' }, { id: genId(), name: '' }]);
  const [picking, setPicking] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addMember = () => setMembers((m) => [...m, { id: genId(), name: '' }]);
  const removeMember = (id: string) => setMembers((m) => (m.length > 2 ? m.filter((row) => row.id !== id) : m));
  const updateMember = (id: string, patch: Partial<MemberRow>) => setMembers((m) => m.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const validMembers = members.filter((m) => m.name.trim().length > 0);
  const canSubmit = tripName.trim().length > 0 && validMembers.length >= 2;
  const pickM = picking ? members.find((m) => m.id === picking) ?? null : null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await api.post<{ ownerToken?: string | null; publicSlug: string }>('/trips/public', {
        name: tripName.trim(),
        currency: 'IDR',
        members: validMembers.map((m) => ({ name: m.name.trim(), avatar: m.avatar })),
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
    <main className="pb">
      <div className="pb-top">
        <Link href="/tools">← Semua tools</Link>
        <ThemeToggle />
      </div>

      <article className="pb-receipt">
        <div className="pb-mono">Trackster · Patungan trip</div>
        <h1>Trip baru</h1>
        <hr />

        {errorMsg && <p className="pb-err">{errorMsg}</p>}

        <label className="pb-f">
          <span className="pb-mono">Nama trip</span>
          <input className="pb-in" placeholder="Liburan Bali, ngekos bareng, acara kelas…" value={tripName} onChange={(e) => setTripName(e.target.value)} />
        </label>

        <hr />
        <h2>Anggota</h2>
        <p className="pb-hint">Siapa aja yang ikut? Minimal 2 orang. Ketuk avatar buat ganti, Enter buat tambah.</p>
        {members.map((m, i) => (
          <div key={m.id} className="pb-prow">
            <button type="button" className="pb-av" style={bg(m.name, m.avatar)} onClick={() => setPicking(m.id)} aria-label={`Pilih avatar anggota ${i + 1}`} />
            <input
              className="pb-in"
              style={{ flex: 1, minWidth: 0 }}
              placeholder={`Nama anggota ${i + 1}`}
              value={m.name}
              onChange={(e) => updateMember(m.id, { name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMember();
                }
              }}
            />
            {members.length > 2 && (
              <button type="button" className="pb-icon" onClick={() => removeMember(m.id)} aria-label={`Hapus anggota ${i + 1}`}>
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" className="pb-btn sm" onClick={addMember} style={{ marginBottom: 6 }}>
          + Tambah anggota
        </button>

        <hr />
        <p className="pb-hint">
          Setelah trip dibuat, kamu bisa tambah pengeluaran (siapa bayar, dibagi ke siapa aja). Trackster hitung otomatis siapa harus transfer ke siapa supaya transfernya paling sedikit.
        </p>
        <div className="pb-nav">
          <button type="button" className="pb-btn pri" onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? 'Menyimpan…' : 'Buat trip'}
          </button>
        </div>
      </article>
      <div className="pb-tear" />
      <p className="pb-foot">Gratis, tanpa daftar</p>

      {pickM && (
        <AvatarPicker
          key={pickM.id}
          name={pickM.name.trim() || 'Anggota'}
          value={pickM.avatar}
          onSave={(avatar) => {
            updateMember(pickM.id, { avatar });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </main>
  );
}
