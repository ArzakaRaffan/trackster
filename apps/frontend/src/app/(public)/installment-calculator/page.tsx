import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WebAppLd } from '@/lib/seo';
import { InstallmentCalculator } from './InstallmentCalculator';

const DESC =
  'Hitung cicilan PayLater per bulan, total biaya tambahan, jadwal cicilan, dan bunga efektif per tahun (IRR). Biar tau bunga flat 2,95%/bulan itu setara berapa persen setahun.';

export const metadata: Metadata = {
  title: 'Kalkulator PayLater & Cicilan: Bunga Efektif per Tahun (IRR)',
  description: DESC,
  alternates: { canonical: '/installment-calculator' },
  openGraph: {
    title: 'Kalkulator PayLater & Cicilan - Trackster',
    description: 'Cicilan per bulan, biaya tambahan, dan bunga efektif per tahun — gratis tanpa akun.',
  },
};

export default function InstallmentCalculatorPage() {
  return (
    <>
      <WebAppLd name="Kalkulator PayLater & Cicilan Trackster" path="/installment-calculator" description={DESC} />
      {/* useSearchParams() di InstallmentCalculator wajib dibungkus Suspense biar lolos next build. */}
      <Suspense fallback={null}>
        <InstallmentCalculator />
      </Suspense>
    </>
  );
}
