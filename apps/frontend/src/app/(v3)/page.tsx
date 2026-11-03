import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://trackster.dev';

// Canonical hanya di beranda — layout (v3) juga dipakai /login, /app/*, dll.
export const metadata: Metadata = { alternates: { canonical: '/' } };

// Nama merek eksplisit untuk Google (hasil pencarian "trackster"); beranda sendiri digambar client-side.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Trackster',
      alternateName: ['Trackster Finance', 'Trackster Finance Tracker'],
      inLanguage: 'id-ID',
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'Trackster',
      url: SITE_URL,
      logo: `${SITE_URL}/apple-icon.png`,
    },
  ],
};

const TOOLS = [
  { href: '/split-bills/new', label: 'Split bill patungan' },
  { href: '/trip/new', label: 'Patungan trip' },
  { href: '/savings-calculator', label: 'Kalkulator target tabungan' },
  { href: '/installment-calculator', label: 'Kalkulator PayLater & cicilan' },
];

// Beranda digambar client-side (V3Host, ssr:false) → HTML server kosong. Blok ini = teks + tautan yang bisa dibaca
// crawler tanpa JS; disembunyikan secara visual (pola sr-only) dan isinya sama dengan yang tampil di landing.
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div style={SR_ONLY}>
        <p>
          Trackster adalah finance tracker: catat pengeluaran otomatis dari email bank (BCA, Jago), pantau budget harian,
          dan dapat alert Telegram. Plus tools keuangan gratis tanpa akun.
        </p>
        <nav aria-label="Tools keuangan gratis">
          <ul>
            {TOOLS.map((t) => (
              <li key={t.href}><Link href={t.href}>{t.label}</Link></li>
            ))}
            <li><Link href="/tools">Semua tools keuangan gratis</Link></li>
          </ul>
        </nav>
      </div>
    </>
  );
}
