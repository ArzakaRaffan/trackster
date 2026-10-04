import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Trackster — Perencana Target Tabungan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
            <path d="M12 8v8" />
            <path d="M8 12h8" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h1 style={{ fontSize: '64px', fontWeight: 'bold', margin: '0 0 20px 0', textAlign: 'center', color: '#ffffff' }}>
          Perencana Target Tabungan
        </h1>
        <p style={{ fontSize: '34px', margin: '0 0 40px 0', color: '#1ed760', fontWeight: 'bold' }}>
          Nabung berapa? Kapan tercapai? Sekalian ketauan.
        </p>
        <p style={{ fontSize: '28px', color: '#888888', margin: 0 }}>
          Gratis · tanpa perlu bikin akun
        </p>
      </div>
    ),
    { ...size },
  );
}
