import { ImageResponse } from 'next/og';
import { avatarSvg, specFor } from '@/lib/avatars';

export const runtime = 'edge';

export const alt = 'Trackster Patungan Trip';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#2B2924', SUBTLE = '#6B6656', PAPER = '#FBF8EE', PAGE = '#F2ECDD', LINE = '#D9D0B8';

// Gaya struk v3 (tema terang). Font bawaan satori.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let tripName = 'Patungan Trip';
  let total = 0;
  let members: { name: string; avatar?: string | null }[] = [];
  let transfers = 0;

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${API_URL}/trips/public/${encodeURIComponent(slug)}`);
    if (res.ok) {
      const data = await res.json();
      tripName = data.name || tripName;
      if (typeof data.totalSpent === 'number') total = data.totalSpent;
      if (Array.isArray(data.members)) members = data.members;
      if (Array.isArray(data.settlements)) transfers = data.settlements.length;
    }
  } catch (e) {
    // ignore, fallback ke teks default
  }

  const shown = members.slice(0, 6);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAGE, padding: 48 }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, border: `3px solid ${LINE}`, borderRadius: 20, padding: '44px 56px', color: INK }}>
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, color: SUBTLE, textTransform: 'uppercase' }}>Trackster · Patungan trip</div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 14, letterSpacing: -2 }}>{tripName.slice(0, 28)}</div>
          <div style={{ display: 'flex', borderTop: `3px dashed ${LINE}`, marginTop: 28, marginBottom: 26 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: SUBTLE, textTransform: 'uppercase' }}>Total pengeluaran</div>
              <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, letterSpacing: -3, marginTop: 6 }}>{total ? `Rp ${Math.round(total).toLocaleString('id-ID')}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {shown.map((m, i) => (
                <img
                  key={i}
                  width={96}
                  height={96}
                  alt=""
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(specFor(m.name, m.avatar)))}`}
                  style={{ borderRadius: 48, border: `5px solid ${PAPER}`, marginLeft: i ? -26 : 0 }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', background: '#1ED760', color: '#04120A', fontSize: 32, fontWeight: 700, borderRadius: 14, padding: '16px 30px' }}>Lihat settle up →</div>
            <div style={{ display: 'flex', fontSize: 28, color: SUBTLE }}>{transfers ? `${transfers} transfer` : 'Semua beres'}</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
