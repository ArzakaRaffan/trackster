import type { Metadata } from 'next';
import { SavingsCalculator } from './SavingsCalculator';

export const metadata: Metadata = {
  title: 'Kalkulator Target Tabungan - Trackster',
  description:
    'Hitung berapa yang harus kamu tabung per bulan buat capai target — motor, iPhone, DP rumah, dana darurat, atau liburan. Gratis, tanpa perlu bikin akun.',
};

export default function KalkulatorTabunganPage() {
  return <SavingsCalculator />;
}
