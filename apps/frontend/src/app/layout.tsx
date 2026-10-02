import type { Metadata } from 'next';
import Script from 'next/script';
import { Figtree } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';

// Substituted for the proprietary SpotifyMixUI/CircularSp — swap for licensed
// @font-face binaries when available (see design_system/readme.md, Gaps & substitutions).
const ui = Figtree({ subsets: ['latin'], weight: ['400', '600', '700', '800', '900'] });

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${ui.className} min-h-screen bg-page text-text lg:flex`}>
        <AppShell>{children}</AppShell>
        {/* <track-mascot> web component — single source of truth for the mascot (Track Struk). */}
        <Script src="/track-mascot.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
