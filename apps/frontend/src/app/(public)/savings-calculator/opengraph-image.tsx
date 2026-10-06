import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Trackster — Perencana Target Tabungan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#2B2924', SUBTLE = '#6B6656', PAPER = '#FBF8EE', PAGE = '#F2ECDD', LINE = '#D9D0B8';

// Gaya struk v3 (tema terang). Font bawaan satori.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAGE, padding: 48 }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, border: `3px solid ${LINE}`, borderRadius: 20, padding: '44px 56px', color: INK }}>
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, color: SUBTLE, textTransform: 'uppercase' }}>Trackster · Kalkulator</div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 14, letterSpacing: -2 }}>Perencana target tabungan</div>
          <div style={{ display: 'flex', borderTop: `3px dashed ${LINE}`, marginTop: 30, marginBottom: 26 }} />
          <div style={{ display: 'flex', fontSize: 44, color: SUBTLE }}>Nabung berapa? Kapan tercapai? Bandingin tabungan, deposito, reksa dana, emas.</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', background: '#1ED760', color: '#04120A', fontSize: 32, fontWeight: 700, borderRadius: 14, padding: '16px 30px' }}>Coba gratis →</div>
            <div style={{ display: 'flex', fontSize: 28, color: SUBTLE }}>Tanpa daftar</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
