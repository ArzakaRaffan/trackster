import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WebAppLd } from '@/lib/seo';
import { SavingsCalculator } from './SavingsCalculator';

const DESC =
  'Hitung setoran tabungan per minggu/bulan, bandingin instrumen (tabungan, deposito, reksa dana, emas), dan liat kapan target tercapai. Gratis, tanpa perlu bikin akun.';

export const metadata: Metadata = {
  title: 'Kalkulator Target Tabungan: Setoran, Deposito, Reksa Dana, Emas',
  description: DESC,
  alternates: { canonical: '/savings-calculator' },
};

export default function KalkulatorTabunganPage() {
  return (
    <>
      <WebAppLd name="Kalkulator Target Tabungan Trackster" path="/savings-calculator" description={DESC} />
      {/* useSearchParams() di SavingsCalculator wajib dibungkus Suspense biar lolos next build. */}
      <Suspense fallback={null}>
        <SavingsCalculator />
      </Suspense>
    </>
  );
}
