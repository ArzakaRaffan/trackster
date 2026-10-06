'use client';

import { Eye, Lock, Mail, Scale, Server, ShieldCheck, Trash2 } from 'lucide-react';
import LegalPage from '@/components/legal/LegalPage';
import PermissionExplorer from '@/components/legal/PermissionExplorer';

const CONTACT = 'arzakaraffan@gmail.com';

const SECTIONS = [
  {
    id: 'data-google',
    Icon: Mail,
    title: 'Data yang diakses dari akun Google',
    body: (
      <>
        <p>Saat kamu menghubungkan Google, Trackster meminta izin berikut:</p>
        <ul>
          <li>
            <b>Gmail (hanya baca)</b> — membaca email notifikasi transaksi dari bank dan layanan pembayaran (mis. BCA, Jago, BRImo,
            Flip) untuk mencatat pengeluaran dan pemasukan otomatis. Email lain tidak dipakai.
          </li>
          <li>
            <b>Google Calendar (event)</b> — membuat dan membaca event pengingat tagihan atau cicilan.
          </li>
          <li>
            <b>Alamat email &amp; identitas dasar</b> — untuk menampilkan akun mana yang terhubung.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'data-disimpan',
    Icon: Server,
    title: 'Data yang kami simpan',
    body: (
      <>
        <ul>
          <li>Hasil ekstraksi dari email transaksi: nominal, merchant, tanggal, dan sumber rekening. Isi email lengkap tidak disimpan.</li>
          <li>Refresh token Google, agar sinkronisasi bisa berjalan tanpa login ulang.</li>
          <li>Data yang kamu input sendiri di aplikasi (budget, pemasukan, koreksi saldo, pengaturan).</li>
        </ul>
        <p>Data disimpan di database server kami sendiri (Jakarta). Tidak dijual dan tidak dibagikan ke pihak ketiga.</p>
      </>
    ),
  },
  {
    id: 'limited-use',
    Icon: Scale,
    title: 'Penggunaan data Google (Limited Use)',
    body: (
      <p>
        Penggunaan dan transfer informasi yang diterima dari Google API oleh Trackster mematuhi{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes">
          Kebijakan Data Pengguna Layanan API Google
        </a>
        , termasuk persyaratan Limited Use. Data dari Gmail dan Calendar hanya dipakai untuk fitur yang tampil di aplikasi, tidak
        dipakai untuk iklan, dan tidak dilihat manusia kecuali kamu meminta bantuan atau diwajibkan hukum.
      </p>
    ),
  },
  {
    id: 'hapus',
    Icon: Trash2,
    title: 'Menghapus data & mencabut akses',
    body: (
      <ul>
        <li>Di Trackster: Setting → Koneksi → Putuskan Google. Refresh token langsung dihapus.</li>
        <li>
          Di Google: cabut akses lewat <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
        </li>
        <li>Untuk menghapus seluruh data akunmu dari database, kirim email ke {CONTACT}.</li>
      </ul>
    ),
  },
  {
    id: 'kontak',
    Icon: Mail,
    title: 'Kontak',
    body: (
      <p>
        Pertanyaan soal privasi: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    ),
  },
];

export default function PrivacyContent() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      updated="6 Oktober 2026"
      intro="Trackster mencatat pengeluaranmu dari email notifikasi bank. Ini penjelasan jujur soal data apa yang disentuh, untuk apa, dan cara mencabutnya kapan saja."
      tldr={[
        { Icon: Eye, title: 'Hanya baca', text: 'Gmail dibaca read-only. Kami tidak bisa mengirim atau menghapus emailmu.' },
        { Icon: Lock, title: 'Tidak dijual', text: 'Data tinggal di server kami. Tidak dibagikan ke pihak ketiga, tidak dipakai untuk iklan.' },
        { Icon: ShieldCheck, title: 'Cabut kapan saja', text: 'Putuskan Google dari Setting, token langsung terhapus.' },
      ]}
      extra={<PermissionExplorer />}
      sections={SECTIONS}
      other={{ href: '/terms', label: 'Syarat & Ketentuan' }}
    />
  );
}
