import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Trackster Patungan Trip';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  let tripName = 'Patungan Trip';
  let totalText = '';

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${API_URL}/trips/public/${params.slug}`);
    if (res.ok) {
      const data = await res.json();
      tripName = data.name || tripName;
      if (typeof data.totalSpent === 'number') {
        totalText = `Total: Rp${Math.round(data.totalSpent).toLocaleString('id-ID')}`;
      }
    }
  } catch (e) {
    // ignore — fallback ke teks default
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom, #111111, #1a1a1a)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          padding: '40px',
        }}
      >
        <div
          style={{
            background: '#1ed760',
            borderRadius: '50%',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
            boxShadow: '0 8px 16px rgba(30, 215, 96, 0.4)',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#04120a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="19" r="3" />
            <circle cx="18" cy="5" r="3" />
            <path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H12" />
          </svg>
        </div>
        <h1 style={{ fontSize: '72px', fontWeight: 'bold', margin: '0 0 20px 0', textAlign: 'center', color: '#ffffff' }}>
          {tripName}
        </h1>
        {totalText && (
          <p style={{ fontSize: '42px', margin: '0 0 40px 0', color: '#1ed760', fontWeight: 'bold' }}>
            {totalText}
          </p>
        )}
        <p style={{ fontSize: '32px', color: '#888888', margin: 0 }}>
          Cek siapa transfer ke siapa di Trackster
        </p>
      </div>
    ),
    { ...size },
  );
}
