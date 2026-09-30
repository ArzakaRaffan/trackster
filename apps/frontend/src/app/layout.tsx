import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';
import { MotionProvider } from '@/components/MotionProvider';

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
        <MotionProvider>
          <NavBar />
          <main className="mx-auto w-full max-w-content lg:flex-1 lg:py-4 lg:pl-2 lg:pr-24 lg:pb-28">{children}</main>
        </MotionProvider>
      </body>
    </html>
  );
}
