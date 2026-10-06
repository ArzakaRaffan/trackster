'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { avatarCss } from '@/lib/avatars';
import { SplitBillDetail } from '@/lib/splitBillTypes';
import ThemeToggle from '@/components/legal/ThemeToggle';
import { AvatarPicker } from '@/components/avatar/AvatarPicker';

const fetcher = (path: string) => api.get<SplitBillDetail>(path);
const bg = (name: string, avatar?: string | null): React.CSSProperties => ({ background: avatarCss(name, avatar).slice('background:'.length) });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ManageSplitBillPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading, mutate } = useSWR(token ? `/split-bills/manage/${token}` : null, fetcher);
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedManage, setCopiedManage] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

  const toggleParticipantForItem = async (itemId: number, participantId: number) => {
    if (!data) return;
    const item = data.items.find((i) => i.id === itemId);
    if (!item) return;

    let newShares = [...item.shares];
    if (newShares.some((s) => s.participantId === participantId)) {
      newShares = newShares.filter((s) => s.participantId !== participantId);
    } else {
      newShares.push({ id: 0, itemId, participantId, weight: 1 });
    }

    // Optimistic update
    mutate({ ...data, items: data.items.map((i) => (i.id === itemId ? { ...i, shares: newShares } : i)) }, false);

    await api.patch(`/split-bills/manage/${token}/items/${itemId}/assign`, {
      shares: newShares.map((s) => ({ participantId: s.participantId, weight: 1 })),
    });
    mutate();
  };

  const flash = (set: (v: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 2000);
  };

  const pickP = data && picking !== null ? data.participants.find((p) => p.id === picking) ?? null : null;
  const saveAvatar = async (avatar: string) => {
    await api.patch(`/split-bills/public/${data!.publicSlug}/participants/${picking}/avatar`, { avatar });
    await mutate();
    setPicking(null);
  };

  return (
    <main className="pb">
      <div className="pb-top">
        <Link href="/">← Trackster</Link>
        <ThemeToggle />
      </div>

      {isLoading ? (
        <div className="pb-state pb-mono">Memuat struk…</div>
      ) : error || !data ? (
        <div className="pb-state">
          <div className="pb-mono">Trackster · Kelola split bill</div>
          <h1 style={{ margin: 0 }}>Link kelola nggak ketemu</h1>
          <p style={{ margin: 0, color: 'var(--text-subtle)' }}>Link mungkin salah atau bill-nya udah dihapus.</p>
        </div>
      ) : (
        <>
          <article className="pb-receipt">
            <div className="pb-mono">Trackster · Kelola split bill</div>
            <h1>{data.restaurantName}</h1>
            <div className="pb-mono">{fmtDate(data.billDate)}</div>
            <hr />

            <div className="pb-warn">
              <b>Simpan link halaman ini</b>
              Bill ini dibuat tanpa akun. Link ini SATU-SATUNYA cara kamu balik ke sini buat ubah siapa pesan apa. Kalau ke-close atau ke-lupa, nggak ada cara login ulang.
              <div style={{ marginTop: 10 }}>
                <button className="pb-btn sm" onClick={() => { navigator.clipboard.writeText(window.location.href); flash(setCopiedManage); }}>
                  {copiedManage ? 'Tersalin ✓' : 'Salin link kelola'}
                </button>
              </div>
            </div>

            <div className="pb-actions" style={{ marginTop: 0 }}>
              <button className="pb-btn pri" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/s/${data.publicSlug}`); flash(setCopiedShare); }}>
                {copiedShare ? 'Tersalin ✓' : 'Salin link buat share ke temen'}
              </button>
              <Link className="pb-btn" href={`/s/${data.publicSlug}`}>
                Lihat halaman teman
              </Link>
            </div>

            {(data.taxAmount > 0 || data.taxPercent > 0 || data.serviceFeeAmount > 0 || data.servicePercent > 0 || data.discountAmount > 0 || data.discountPercent > 0 || data.deliveryFee > 0) && (
              <>
                <hr />
                <div className="pb-bd" style={{ margin: 0 }}>
                  {data.taxAmount > 0 && <div><span>Pajak (Rp)</span><span>{formatRupiah(data.taxAmount)}</span></div>}
                  {data.taxPercent > 0 && <div><span>Pajak (%)</span><span>{data.taxPercent}%</span></div>}
                  {data.serviceFeeAmount > 0 && <div><span>Service (Rp)</span><span>{formatRupiah(data.serviceFeeAmount)}</span></div>}
                  {data.servicePercent > 0 && <div><span>Service (%)</span><span>{data.servicePercent}%</span></div>}
                  {data.discountAmount > 0 && <div className="neg"><span>Diskon (Rp)</span><span>-{formatRupiah(data.discountAmount)}</span></div>}
                  {data.discountPercent > 0 && <div className="neg"><span>Diskon (%)</span><span>{data.discountPercent}%</span></div>}
                  {data.deliveryFee > 0 && <div><span>Lainnya</span><span>{formatRupiah(data.deliveryFee)}</span></div>}
                </div>
              </>
            )}

            <hr />
            <h2>Item & pembagian</h2>
            <ul>
              {data.items.map((item) => (
                <li key={item.id} className="pb-item">
                  <div className="pb-item-top">
                    <span>
                      {item.description}
                      {item.quantity > 1 && <span className="pb-qty"> ×{item.quantity}</span>}
                    </span>
                    <span className="pb-amt">{formatRupiah(Number(item.amount) * item.quantity)}</span>
                  </div>
                  <div className="pb-chips">
                    {data.participants.map((p) => (
                      <button key={p.id} type="button" className="pb-chip tog" aria-pressed={item.shares.some((s) => s.participantId === p.id)} onClick={() => toggleParticipantForItem(item.id, p.id)}>
                        <i style={bg(p.name, p.avatar)} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <hr />
            <h2>Kalkulasi per orang</h2>
            <ul>
              {data.participantTotals.map((p) => (
                <li key={p.participantId} className="pb-p" style={{ margin: 0, padding: '14px 0' }}>
                  <div className="pb-p-top">
                    <button className="pb-av" style={bg(p.name, p.avatar)} onClick={() => setPicking(p.participantId)} aria-label={`Ganti avatar ${p.name}`} />
                    <span className="pb-p-name">
                      <b>{p.name}</b>
                      <span>
                        {formatRupiah(p.subtotal)} + fee {formatRupiah(p.tax + p.service + p.delivery)}
                      </span>
                    </span>
                    <span className="pb-amt">{formatRupiah(p.total)}</span>
                    <span className={`pb-tag ${p.isPaid ? 'ok' : 'no'}`}>{p.isPaid ? 'Lunas' : 'Belum'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>
          <div className="pb-tear" />
          <p className="pb-foot">Dibuat lewat Trackster · ketuk avatar buat ganti</p>
        </>
      )}

      {pickP && <AvatarPicker key={pickP.id} name={pickP.name} value={pickP.avatar} onSave={saveAvatar} onClose={() => setPicking(null)} />}
    </main>
  );
}
