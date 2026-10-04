import type { Metadata } from 'next';
import Script from 'next/script';
import { V3Host } from '@/components/v3/V3Host';

export const metadata: Metadata = {
  title: {
    default: 'Trackster — Finance Tracker & Tools Keuangan Gratis',
    template: '%s — Trackster',
  },
  description:
    'Trackster adalah finance tracker & kumpulan tools keuangan gratis: split bill patungan, kalkulator target tabungan, kalkulator PayLater/cicilan, dan patungan trip. Tanpa perlu daftar.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://trackster.dev'),
  openGraph: {
    title: 'Trackster — Finance Tracker & Tools Keuangan Gratis',
    description:
      'Split bill, target tabungan, PayLater, patungan trip — gratis tanpa akun. Catat pengeluaran otomatis dari email bank.',
    url: '/',
    siteName: 'Trackster',
  },
};

// Tidak mengimpor globals.css (Tailwind preflight): desain v3 bergantung pada default browser, bukan reset Tailwind.
export default function V3Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <V3Host />
        {children}
        <Script src="/track-mascot.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
