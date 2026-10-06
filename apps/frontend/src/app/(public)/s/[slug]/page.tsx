'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { avatarCss } from '@/lib/avatars';
import { PublicSplitBillSummary } from '@/lib/splitBillTypes';
import ThemeToggle from '@/components/legal/ThemeToggle';
import { AvatarPicker } from '@/components/avatar/AvatarPicker';

const fetcher = (path: string) => api.get<PublicSplitBillSummary>(path);

/** avatarCss → objek style React (satu deklarasi `background`). */
const bg = (name: string, avatar?: string | null): React.CSSProperties => ({ background: avatarCss(name, avatar).slice('background:'.length) });

const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export default function PublicSplitBillPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading, mutate } = useSWR(slug ? `/split-bills/public/${slug}` : null, fetcher);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

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
          <div className="pb-mono">Trackster · Split bill</div>
          <h1 style={{ margin: 0 }}>Split bill nggak ketemu</h1>
          <p style={{ margin: 0, color: 'var(--text-subtle)' }}>Link mungkin salah atau bill-nya udah dihapus.</p>
        </div>
      </main>
    );
  }

  const grandTotal = data.participants.reduce((sum, p) => sum + p.total, 0);
  const paidCount = data.participants.filter((p) => p.isPaid).length;
  const allPaid = data.participants.length > 0 && paidCount === data.participants.length;
  const hasPayerInfo = data.payerBankName || data.payerAccountNumber || data.payerAccountName;
  const byId = new Map(data.participants.map((p) => [p.participantId, p]));
  const pickP = picking === null ? null : byId.get(picking) ?? null;

  const flash = (set: (v: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 2000);
  };

  const shareText = () => {
    let text = `*Tagihan ${data.restaurantName}*\n${fmtDate(data.billDate)}\n\n`;
    if (hasPayerInfo) {
      text += 'Transfer ke:\n';
      if (data.payerBankName) text += `${data.payerBankName}\n`;
      if (data.payerAccountNumber) text += `${data.payerAccountNumber}\n`;
      if (data.payerAccountName) text += `a.n ${data.payerAccountName}\n`;
      text += '\n';
    }
    data.participants.forEach((p) => {
      text += `*${p.name}*: ${formatRupiah(p.total)}\n`;
      text += `(Subtotal: ${formatRupiah(p.subtotal)}, Pajak: ${formatRupiah(p.tax)}, Service: ${formatRupiah(p.service)}`;
      if (p.discount > 0) text += `, Diskon: -${formatRupiah(p.discount)}`;
      if (p.delivery > 0) text += `, Lainnya: ${formatRupiah(p.delivery)}`;
      if (p.roundingDiff !== 0) text += `, Pembulatan: ${formatRupiah(p.roundingDiff)}`;
      text += ')\n\n';
    });
    return text + `Link: ${window.location.href}`;
  };

  const markPaid = async (id: number) => {
    await api.patch(`/split-bills/public/${slug}/participants/${id}/mark-paid`);
    mutate();
  };

  const saveAvatar = async (avatar: string) => {
    await api.patch(`/split-bills/public/${slug}/participants/${picking}/avatar`, { avatar });
    await mutate();
    setPicking(null);
  };

  return (
    <main className="pb">
      <div className="pb-top">
        <Link href="/">← Trackster</Link>
        <ThemeToggle />
      </div>

      <article className="pb-receipt">
        <div className="pb-mono">Trackster · Split bill</div>
        <h1>{data.restaurantName}</h1>
        <div className="pb-mono">{fmtDate(data.billDate)}</div>
        <hr />
        <div className="pb-mono">Total tagihan</div>
        <p className="pb-total">{formatRupiah(grandTotal)}</p>
        <div className="pb-actions">
          <button className="pb-btn" onClick={() => { navigator.clipboard.writeText(shareText()); flash(setCopiedAll); }}>
            {copiedAll ? 'Tersalin ✓' : 'Salin semua'}
          </button>
          <button className="pb-btn pri" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, '_blank')}>
            Kirim ke WhatsApp
          </button>
        </div>
        <hr />
        <div className="pb-prog">
          <div className="pb-bar" role="progressbar" aria-valuemin={0} aria-valuemax={data.participants.length} aria-valuenow={paidCount}>
            <i style={{ width: `${data.participants.length ? (paidCount / data.participants.length) * 100 : 0}%` }} />
          </div>
          <span className="pb-mono">{paidCount}/{data.participants.length} lunas</span>
        </div>

        {allPaid && <p className="pb-party" style={{ marginTop: 14 }}>Semua udah lunas! 🎉</p>}

        {hasPayerInfo && (
          <>
            <hr />
            <div className="pb-bank">
              <div>
                <small>
                  Transfer ke {data.payerBankName}
                  {data.payerAccountName ? ` · a.n ${data.payerAccountName}` : ''}
                </small>
                <b>{data.payerAccountNumber}</b>
              </div>
              {data.payerAccountNumber && (
                <button className="pb-btn sm" onClick={() => { navigator.clipboard.writeText(data.payerAccountNumber!); flash(setCopiedAccount); }}>
                  {copiedAccount ? 'Tersalin ✓' : 'Salin'}
                </button>
              )}
            </div>
          </>
        )}

        <hr />
        <h2>Menu</h2>
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
                {item.shares.length === 0 && <span className="pb-chip none">Belum di-assign</span>}
                {item.shares.map((s) => {
                  const p = byId.get(s.participantId);
                  return (
                    <span key={s.participantId} className="pb-chip">
                      <i style={bg(p?.name ?? '?', p?.avatar)} />
                      {p?.name ?? 'Unknown'}
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <hr />
        <h2>Yang harus dibayar</h2>
        <ul>
          {data.participants.map((p) => (
            <li key={p.participantId} className={`pb-p${p.isPaid ? ' paid' : ''}`}>
              <div className="pb-p-top">
                <button className="pb-av" style={bg(p.name, p.avatar)} onClick={() => setPicking(p.participantId)} aria-label={`Ganti avatar ${p.name}`} />
                <span className="pb-p-name">
                  <b>{p.name}</b>
                  <span>{formatRupiah(p.total)}</span>
                </span>
                <button className={`pb-btn sm${p.isPaid ? ' done' : ' pri'}`} onClick={() => markPaid(p.participantId)}>
                  {p.isPaid ? '✓ Lunas' : 'Tandai lunas'}
                </button>
              </div>
              <div className="pb-bd">
                <div><span>Subtotal</span><span>{formatRupiah(p.subtotal)}</span></div>
                {p.discount > 0 && <div className="neg"><span>Diskon</span><span>-{formatRupiah(p.discount)}</span></div>}
                {p.tax > 0 && <div><span>Pajak</span><span>{formatRupiah(p.tax)}</span></div>}
                {p.service > 0 && <div><span>Service</span><span>{formatRupiah(p.service)}</span></div>}
                {p.delivery > 0 && <div><span>Lainnya</span><span>{formatRupiah(p.delivery)}</span></div>}
                {p.roundingDiff !== 0 && <div><span>Pembulatan</span><span>{formatRupiah(p.roundingDiff)}</span></div>}
              </div>
            </li>
          ))}
        </ul>
      </article>
      <div className="pb-tear" />
      <p className="pb-foot">Dibuat lewat Trackster · ketuk avatar buat ganti</p>

      {pickP && <AvatarPicker key={pickP.participantId} name={pickP.name} value={pickP.avatar} onSave={saveAvatar} onClose={() => setPicking(null)} />}
    </main>
  );
}
