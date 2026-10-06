import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SavingsCalculator } from './SavingsCalculator';

export const metadata: Metadata = {
  title: 'Perencana Target Tabungan',
  description:
    'Hitung setoran tabungan per minggu/bulan, bandingin instrumen (tabungan, deposito, reksa dana, emas), dan liat kapan target tercapai. Gratis, tanpa perlu bikin akun.',
};

export default function KalkulatorTabunganPage() {
  return (
    // useSearchParams() di SavingsCalculator wajib dibungkus Suspense biar lolos next build.
    <Suspense fallback={null}>
      <SavingsCalculator />
    </Suspense>
  );
}
