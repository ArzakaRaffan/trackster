'use client';

import { Calculator, FileText, Gavel, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react';
import LegalPage from '@/components/legal/LegalPage';

const CONTACT = 'arzakaraffan@gmail.com';

const SECTIONS = [
  {
    id: 'layanan',
    Icon: FileText,
    title: 'Layanan',
    body: (
      <p>
        Trackster membantu mencatat pengeluaran dan memantau budget dari email notifikasi bank, plus beberapa tools keuangan gratis
        (split bill, kalkulator tabungan, cicilan, patungan trip). Akses ke fitur dashboard bersifat undangan.
      </p>
    ),
  },
  {
    id: 'bukan-saran',
    Icon: Calculator,
    title: 'Bukan nasihat keuangan',
    body: (
      <p>
        Angka di Trackster dihitung otomatis dari email dan input kamu, bisa saja tidak lengkap atau keliru (mis. format email bank
        berubah). Saldo di aplikasi bukan saldo resmi bank. Jangan dijadikan satu-satunya dasar keputusan keuangan.
      </p>
    ),
  },
  {
    id: 'tanggung-jawab-kamu',
    Icon: UserCheck,
    title: 'Tanggung jawabmu',
    body: (
      <ul>
        <li>Gunakan hanya akun Google dan data milikmu sendiri.</li>
        <li>Jaga kerahasiaan akses akunmu.</li>
        <li>Jangan menyalahgunakan layanan atau mencoba mengakses data pengguna lain.</li>
      </ul>
    ),
  },
  {
    id: 'ketersediaan',
    Icon: Gavel,
    title: 'Ketersediaan & tanggung jawab kami',
    body: (
      <p>
        Layanan diberikan apa adanya, tanpa jaminan uptime atau kebenaran data. Sejauh diizinkan hukum, kami tidak bertanggung jawab
        atas kerugian akibat penggunaan atau gangguan layanan. Kami dapat mengubah atau menghentikan layanan, atau menangguhkan akun
        yang menyalahgunakannya.
      </p>
    ),
  },
  {
    id: 'data-pribadi',
    Icon: Lock,
    title: 'Data pribadi',
    body: (
      <p>
        Pengelolaan data diatur di <a href="/privacy">Kebijakan Privasi</a>.
      </p>
    ),
  },
  {
    id: 'kontak',
    Icon: Mail,
    title: 'Kontak',
    body: (
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    ),
  },
];

export default function TermsContent() {
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      updated="6 Oktober 2026"
      intro="Aturan mainnya singkat: pakai untuk datamu sendiri, jangan bergantung penuh pada angkanya, dan kami berhak menjaga layanan tetap aman."
      tldr={[
        { Icon: UserCheck, title: 'Datamu sendiri', text: 'Pakai akun Google dan data milikmu. Jangan akses data orang lain.' },
        { Icon: Calculator, title: 'Bukan saran keuangan', text: 'Angka dihitung otomatis dan bisa meleset. Cek ke bank untuk saldo resmi.' },
        { Icon: ShieldCheck, title: 'Apa adanya', text: 'Tanpa jaminan uptime. Layanan bisa berubah atau berhenti.' },
      ]}
      sections={SECTIONS}
      other={{ href: '/privacy', label: 'Kebijakan Privasi' }}
    />
  );
}
