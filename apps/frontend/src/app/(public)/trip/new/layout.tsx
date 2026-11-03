import type { Metadata } from 'next';
import { WebAppLd } from '@/lib/seo';

const DESC =
  'Banyak pengeluaran, banyak pembayar? Catat semua biaya trip bareng teman, lalu lihat siapa transfer ke siapa dengan transfer seminimal mungkin. Gratis, tanpa akun.';

export const metadata: Metadata = {
  title: 'Patungan Trip: Hitung Bagi Biaya Liburan Bareng Teman',
  description: DESC,
  alternates: { canonical: '/trip/new' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WebAppLd name="Patungan Trip Trackster" path="/trip/new" description={DESC} />
      {children}
    </>
  );
}
