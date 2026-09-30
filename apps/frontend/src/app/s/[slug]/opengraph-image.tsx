import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Trackster Split Bill';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  let restaurantName = 'Split Bill';
  let totalText = '';
  
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${API_URL}/split-bills/public/${params.slug}`);
    if (res.ok) {
      const data = await res.json();
      restaurantName = data.restaurantName || restaurantName;
      if (data.participants && Array.isArray(data.participants)) {
        const grandTotal = data.participants.reduce((sum: number, p: any) => sum + (p.total || 0), 0);
        totalText = `Total: Rp${grandTotal.toLocaleString('id-ID')}`;
      }
    }
  } catch (e) {
    // ignore
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
            background: '#ff5c35',
            borderRadius: '50%',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
            boxShadow: '0 8px 16px rgba(255, 92, 53, 0.4)'
          }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1v-20l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 17V7" />
          </svg>
        </div>
        <h1 style={{ fontSize: '72px', fontWeight: 'bold', margin: '0 0 20px 0', textAlign: 'center', color: '#ffffff' }}>
          {restaurantName}
        </h1>
        {totalText && (
          <p style={{ fontSize: '42px', margin: '0 0 40px 0', color: '#ff5c35', fontWeight: 'bold' }}>
            {totalText}
          </p>
        )}
        <p style={{ fontSize: '32px', color: '#888888', margin: 0 }}>
          Klik untuk bayar bagianmu di Trackster
        </p>
      </div>
    ),
    { ...size }
  );
}
