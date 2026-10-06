import { ImageResponse } from 'next/og';
import { avatarSvg, specFor } from '@/lib/avatars';

export const runtime = 'edge';

export const alt = 'Trackster Split Bill';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#2B2924', SUBTLE = '#6B6656', PAPER = '#FBF8EE', PAGE = '#F2ECDD', LINE = '#D9D0B8';

// Gaya struk v3 (token = tema terang di legal.css). Font bawaan satori: tidak ada DM Mono di edge.
export default async function Image({ params }: { params: { slug: string } }) {
  let restaurantName = 'Split Bill';
  let total = 0;
  let people: { name: string; avatar?: string | null; isPaid: boolean }[] = [];

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${API_URL}/split-bills/public/${params.slug}`);
    if (res.ok) {
      const data = await res.json();
      restaurantName = data.restaurantName || restaurantName;
      if (Array.isArray(data.participants)) {
        people = data.participants;
        total = data.participants.reduce((sum: number, p: any) => sum + (p.total || 0), 0);
      }
    }
  } catch (e) {
    // ignore
  }

  const shown = people.slice(0, 6);
  const paid = people.filter((p) => p.isPaid).length;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAGE, padding: 48 }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, border: `3px solid ${LINE}`, borderRadius: 20, padding: '44px 56px', color: INK }}>
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, color: SUBTLE, textTransform: 'uppercase' }}>Trackster · Split bill</div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 14, letterSpacing: -2 }}>{restaurantName.slice(0, 28)}</div>
          <div style={{ display: 'flex', borderTop: `3px dashed ${LINE}`, marginTop: 28, marginBottom: 26 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: SUBTLE, textTransform: 'uppercase' }}>Total tagihan</div>
              <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, letterSpacing: -3, marginTop: 6 }}>{total ? `Rp ${total.toLocaleString('id-ID')}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {shown.map((p, i) => (
                <img
                  key={i}
                  width={96}
                  height={96}
                  alt=""
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(specFor(p.name, p.avatar)))}`}
                  style={{ borderRadius: 48, border: `5px solid ${PAPER}`, marginLeft: i ? -26 : 0 }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', background: '#1ED760', color: '#04120A', fontSize: 32, fontWeight: 700, borderRadius: 14, padding: '16px 30px' }}>Bayar bagianmu →</div>
            <div style={{ display: 'flex', fontSize: 28, color: SUBTLE }}>{people.length ? `${paid}/${people.length} lunas` : ''}</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
