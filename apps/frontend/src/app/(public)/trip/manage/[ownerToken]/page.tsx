'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { avatarCss } from '@/lib/avatars';
import { TripSummary } from '@/lib/tripTypes';
import ThemeToggle from '@/components/legal/ThemeToggle';
import { AvatarPicker } from '@/components/avatar/AvatarPicker';

const fetcher = (path: string) => api.get<TripSummary>(path);
const bg = (name: string, avatar?: string | null): React.CSSProperties => ({ background: avatarCss(name, avatar).slice('background:'.length) });
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ManageTripPage() {
  const { ownerToken } = useParams<{ ownerToken: string }>();
  const { data, error, isLoading, mutate } = useSWR(ownerToken ? `/trips/manage/${ownerToken}` : null, fetcher);
  const [copied, setCopied] = useState(false);
  const [copiedManage, setCopiedManage] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidByIndex, setPaidByIndex] = useState(0);
  const [shareIds, setShareIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const flash = (set: (v: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 2000);
  };

  const toggleShare = (id: number) => setShareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const addExpense = async () => {
    if (!data || num(amount) <= 0 || !description.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const shares = shareIds
        .map((id) => ({ memberIndex: data.members.findIndex((m) => m.id === id), weight: 1 }))
        .filter((s) => s.memberIndex !== -1);

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
      <main className="pb">
        <div className="pb-state pb-mono">Memuat struk…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="pb">
        <div className="pb-state">
          <div className="pb-mono">Trackster · Kelola trip</div>
          <h1 style={{ margin: 0 }}>Trip nggak ketemu</h1>
          <p style={{ margin: 0, color: 'var(--text-subtle)' }}>Link kelola mungkin salah atau trip-nya udah dihapus.</p>
        </div>
      </main>
    );
  }

  const member = (id: number) => data.members.find((m) => m.id === id);
  const paidMember = data.members[paidByIndex]?.name ?? '?';
  const pickM = picking === null ? null : member(picking) ?? null;
  const publicUrl = () => `${window.location.origin}/t/${data.publicSlug}`;

  const saveAvatar = async (avatar: string) => {
    await api.patch(`/trips/manage/${ownerToken}/members/${picking}/avatar`, { avatar });
    await mutate();
    setPicking(null);
  };

  return (
    <main className="pb">
      <div className="pb-top">
        <Link href="/tools">← Semua tools</Link>
        <ThemeToggle />
      </div>

      <article className="pb-receipt">
        <div className="pb-mono">Trackster · Kelola trip</div>
        <h1>{data.name}</h1>
        <div className="pb-mono">{data.members.length} orang · total {formatRupiah(data.totalSpent)}</div>
        <hr />

        <div className="pb-warn">
          <b>Simpan link halaman ini</b>
          Trip ini dibuat tanpa akun. Link ini satu-satunya cara kamu balik buat nambah pengeluaran.
          <div style={{ marginTop: 10 }}>
            <button className="pb-btn sm" onClick={() => { navigator.clipboard.writeText(window.location.href); flash(setCopiedManage); }}>
              {copiedManage ? 'Tersalin ✓' : 'Salin link kelola'}
            </button>
          </div>
        </div>
        <div className="pb-actions" style={{ marginTop: 0 }}>
          <button className="pb-btn pri" onClick={() => { navigator.clipboard.writeText(publicUrl()); flash(setCopied); }}>
            {copied ? 'Tersalin ✓' : 'Salin link buat share ke temen'}
          </button>
          <Link className="pb-btn" href={`/t/${data.publicSlug}`}>
            Lihat halaman teman
          </Link>
        </div>

        <hr />
        <h2>Anggota</h2>
        <p className="pb-hint">Ketuk avatar buat ganti.</p>
        <div className="pb-chips" style={{ gap: 10 }}>
          {data.members.map((m) => (
            <button key={m.id} type="button" className="pb-chip tog" onClick={() => setPicking(m.id)} aria-label={`Ganti avatar ${m.name}`} style={{ height: 40, padding: '0 14px 0 5px' }}>
              <i style={{ ...bg(m.name, m.avatar), width: 30, height: 30 }} />
              {m.name}
            </button>
          ))}
        </div>

        <hr />
        <h2>Tambah pengeluaran</h2>
        <label className="pb-f" style={{ marginTop: 10 }}>
          <span className="pb-mono">Deskripsi</span>
          <input className="pb-in" placeholder="Sewa villa, bensin, makan malam…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="pb-f">
          <span className="pb-mono">Nominal</span>
          <span className="pb-aff">
            <span>Rp</span>
            <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </span>
        </label>

        <div className="pb-f">
          <span className="pb-mono">Dibayar oleh</span>
          <div className="pb-chips">
            {data.members.map((m, i) => (
              <button key={m.id} type="button" className="pb-chip tog" aria-pressed={paidByIndex === i} onClick={() => setPaidByIndex(i)}>
                <i style={bg(m.name, m.avatar)} />
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="pb-f">
          <span className="pb-mono" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Dibagi ke</span>
            <button type="button" onClick={() => setShareIds(shareIds.length === data.members.length ? [] : data.members.map((m) => m.id))} style={{ all: 'unset', cursor: 'pointer', color: 'var(--brand-text)' }}>
              {shareIds.length === data.members.length ? 'Kosongkan' : 'Pilih semua'}
            </button>
          </span>
          <div className="pb-chips">
            {data.members.map((m) => (
              <button key={m.id} type="button" className="pb-chip tog" aria-pressed={shareIds.includes(m.id)} onClick={() => toggleShare(m.id)}>
                <i style={bg(m.name, m.avatar)} />
                {m.name}
              </button>
            ))}
          </div>
          <span className="pb-help">Kosongkan = cuma {paidMember} yang tanggung.</span>
        </div>

        {errorMsg && <p className="pb-err">{errorMsg}</p>}
        <div className="pb-nav">
          <button type="button" className="pb-btn pri" onClick={addExpense} disabled={saving || num(amount) <= 0 || !description.trim()}>
            {saving ? 'Menyimpan…' : 'Tambah pengeluaran'}
          </button>
        </div>

        <hr />
        <h2>Pengeluaran</h2>
        {data.expenses.length === 0 ? (
          <p className="pb-hint">Belum ada pengeluaran. Tambah di atas.</p>
        ) : (
          <ul>
            {data.expenses.map((e) => (
              <li key={e.id} className="pb-item">
                <div className="pb-item-top">
                  <span>{e.description}</span>
                  <span className="pb-amt">{formatRupiah(e.amount)}</span>
                </div>
                <div className="pb-chips">
                  <span className="pb-chip">
                    <i style={bg(member(e.paidByMemberId)?.name ?? '?', member(e.paidByMemberId)?.avatar)} />
                    {member(e.paidByMemberId)?.name ?? '?'} bayar
                  </span>
                  {e.shares.length > 0 && <span className="pb-chip none">dibagi {e.shares.length} orang</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="pb-sum" style={{ borderTop: '1.5px dashed var(--border)', marginTop: 8, paddingTop: 12 }}>
          <span className="pb-mono">Total pengeluaran</span>
          <b>{formatRupiah(data.totalSpent)}</b>
        </div>

        <hr />
        <h2>Settle up</h2>
        {data.settlements.length === 0 ? (
          <p className="pb-party">Semua udah beres. Nggak ada yang perlu transfer.</p>
        ) : (
          <>
            <ul>
              {data.settlements.map((t, i) => (
                <li key={i} className="pb-pl">
                  <i style={bg(t.fromName, member(t.fromMemberId)?.avatar)} />
                  <span>
                    <b style={{ fontFamily: 'inherit', fontWeight: 700 }}>{t.fromName}</b> <span style={{ color: 'var(--text-subtle)' }}>→</span> <b style={{ fontFamily: 'inherit', fontWeight: 700 }}>{t.toName}</b>
                  </span>
                  <b>{formatRupiah(t.amount)}</b>
                </li>
              ))}
            </ul>
            <div className="pb-actions">
              <button
                type="button"
                className="pb-btn"
                onClick={() => {
                  const lines = data.settlements.map((t) => `${t.fromName} → ${t.toName}: ${formatRupiah(t.amount)}`);
                  const text = encodeURIComponent(`*Settle up ${data.name}*\n${lines.join('\n')}\n\n${publicUrl()}`);
                  window.open(`https://wa.me/?text=${text}`, '_blank');
                }}
              >
                Kirim ke WhatsApp
              </button>
            </div>
          </>
        )}
        <div style={{ height: 14 }} />
      </article>
      <div className="pb-tear" />
      <p className="pb-foot">Dibuat lewat Trackster</p>

      {pickM && <AvatarPicker key={pickM.id} name={pickM.name} value={pickM.avatar} onSave={saveAvatar} onClose={() => setPicking(null)} />}
    </main>
  );
}
