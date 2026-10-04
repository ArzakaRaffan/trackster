import type { Metadata } from 'next';
import { InstallmentCalculator } from './InstallmentCalculator';

export const metadata: Metadata = {
  title: 'Kalkulator PayLater & Cicilan',
  description:
    'Hitung cicilan PayLater per bulan, total biaya tambahan, dan bunga efektif per tahun (IRR). Biar tau bunga flat 2,95%/bulan itu setara berapa persen setahun.',
  openGraph: {
    title: 'Kalkulator PayLater & Cicilan - Trackster',
    description: 'Cicilan per bulan, biaya tambahan, dan bunga efektif per tahun — gratis tanpa akun.',
  },
};

export default function InstallmentCalculatorPage() {
  return <InstallmentCalculator />;
}
