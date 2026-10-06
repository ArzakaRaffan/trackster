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

const fetcher = (path: string) => api.get<TripSummary>(path);
const bg = (name: string, avatar?: string | null): React.CSSProperties => ({ background: avatarCss(name, avatar).slice('background:'.length) });

export default function PublicTripPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading } = useSWR(slug ? `/trips/public/${slug}` : null, fetcher);
  const [copied, setCopied] = useState(false);

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
          <div className="pb-mono">Trackster · Patungan trip</div>
          <h1 style={{ margin: 0 }}>Trip nggak ketemu</h1>
          <p style={{ margin: 0, color: 'var(--text-subtle)' }}>Link mungkin salah atau trip-nya udah dihapus.</p>
        </div>
      </main>
    );
  }

  const member = (id: number) => data.members.find((m) => m.id === id);
  const paidBy = (id: number) => data.expenses.filter((e) => e.paidByMemberId === id).reduce((s, e) => s + e.amount, 0);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWa = () => {
    const lines = data.settlements.map((t) => `${t.fromName} → ${t.toName}: ${formatRupiah(t.amount)}`);
    const text = encodeURIComponent(`*Settle up ${data.name}*\n${lines.join('\n')}\n\n${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <main className="pb">
      <div className="pb-top">
        <Link href="/">← Trackster</Link>
        <ThemeToggle />
      </div>

      <article className="pb-receipt">
        <div className="pb-mono">Trackster · Patungan trip</div>
        <h1>{data.name}</h1>
        <div className="pb-mono">{data.members.length} orang · {data.expenses.length} pengeluaran</div>
        <hr />
        <div className="pb-mono">Total pengeluaran</div>
        <p className="pb-total">{formatRupiah(data.totalSpent)}</p>
        <div className="pb-actions">
          <button className="pb-btn" onClick={copyLink}>
            {copied ? 'Tersalin ✓' : 'Salin link'}
          </button>
          <button className="pb-btn pri" onClick={shareWa}>
            Kirim ke WhatsApp
          </button>
        </div>

        <hr />
        <h2>Settle up</h2>
        {data.settlements.length === 0 ? (
          <p className="pb-party">Semua udah beres. Nggak ada yang perlu transfer 🎉</p>
        ) : (
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
        )}

        <hr />
        <h2>Saldo tiap anggota</h2>
        <ul>
          {data.balances.map((b) => {
            const m = member(b.memberId);
            const positive = b.net >= 0;
            return (
              <li key={b.memberId} className="pb-pl">
                <i style={bg(b.name, m?.avatar)} />
                <span>
                  {b.name}
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-subtle)' }}>Sudah bayar {formatRupiah(paidBy(b.memberId))}</span>
                </span>
                <span className={`pb-tag ${positive ? 'ok' : 'no'}`}>{positive ? `Nerima ${formatRupiah(b.net)}` : `Bayar ${formatRupiah(Math.abs(b.net))}`}</span>
              </li>
            );
          })}
        </ul>

        <hr />
        <h2>Pengeluaran</h2>
        {data.expenses.length === 0 ? (
          <p className="pb-hint">Belum ada pengeluaran.</p>
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
        <div style={{ height: 14 }} />
      </article>
      <div className="pb-tear" />
      <p className="pb-foot">Dibuat lewat Trackster</p>
    </main>
  );
}
