import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';

// Substituted for the proprietary SpotifyMixUI/CircularSp — swap for licensed
// @font-face binaries when available (see design_system/readme.md, Gaps & substitutions).
const ui = Figtree({ subsets: ['latin'], weight: ['400', '600', '700', '800', '900'] });

export const metadata: Metadata = {
  title: 'Trackster',
  description: 'Personal finance expense tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${ui.className} min-h-screen bg-base text-ink lg:flex`}>
        <NavBar />
        <main className="mx-auto w-full max-w-content lg:flex-1">{children}</main>
      </body>
    </html>
  );
}
