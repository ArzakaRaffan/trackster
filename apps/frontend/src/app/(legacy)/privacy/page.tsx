import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Data apa yang Trackster baca dari Google, untuk apa, dan bagaimana menghapusnya.',
};

const UPDATED = '6 Oktober 2026';
const CONTACT = 'arzakaraffan@gmail.com';

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-2xl font-extrabold">Kebijakan Privasi Trackster</h1>
      <p>Terakhir diperbarui: {UPDATED}</p>

      <p>
        Trackster adalah aplikasi pencatat pengeluaran pribadi yang berjalan di trackster.dev. Halaman ini menjelaskan data
        apa yang diakses, untuk apa, dan bagaimana kamu bisa menghapusnya.
      </p>

      <h2>Data yang diakses dari akun Google</h2>
      <p>Saat kamu menghubungkan Google, Trackster meminta izin berikut:</p>
      <ul>
        <li>
          <b>Gmail (hanya baca)</b> — membaca email notifikasi transaksi dari bank dan layanan pembayaran (mis. BCA, Jago,
          BRImo, Flip) untuk mencatat pengeluaran dan pemasukan otomatis. Email lain tidak dipakai.
        </li>
        <li>
          <b>Google Calendar (event)</b> — membuat dan membaca event pengingat tagihan atau cicilan.
        </li>
        <li>
          <b>Alamat email &amp; identitas dasar</b> — untuk menampilkan akun mana yang terhubung.
        </li>
      </ul>

      <h2>Data yang kami simpan</h2>
      <ul>
        <li>Hasil ekstraksi dari email transaksi: nominal, merchant, tanggal, dan sumber rekening. Isi email lengkap tidak disimpan.</li>
        <li>Refresh token Google, agar sinkronisasi bisa berjalan tanpa login ulang.</li>
        <li>Data yang kamu input sendiri di aplikasi (budget, pemasukan, koreksi saldo, pengaturan).</li>
      </ul>
      <p>Data disimpan di database server kami sendiri (Jakarta). Tidak dijual dan tidak dibagikan ke pihak ketiga.</p>

      <h2>Penggunaan data Google (Limited Use)</h2>
      <p>
        Penggunaan dan transfer informasi yang diterima dari Google API oleh Trackster mematuhi{' '}
        <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes">
          Kebijakan Data Pengguna Layanan API Google
        </a>
        , termasuk persyaratan Limited Use. Data dari Gmail dan Calendar hanya dipakai untuk fitur yang tampil di aplikasi,
        tidak dipakai untuk iklan, dan tidak dilihat manusia kecuali kamu meminta bantuan atau diwajibkan hukum.
      </p>

      <h2>Menghapus data &amp; mencabut akses</h2>
      <ul>
        <li>Di Trackster: Setting → Koneksi → Putuskan Google. Refresh token langsung dihapus.</li>
        <li>
          Di Google: cabut akses lewat{' '}
          <a className="underline" href="https://myaccount.google.com/permissions">
            myaccount.google.com/permissions
          </a>
          .
        </li>
        <li>Untuk menghapus seluruh data akunmu dari database, kirim email ke {CONTACT}.</li>
      </ul>

      <h2>Kontak</h2>
      <p>
        Pertanyaan soal privasi: <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <p className="mt-10">
        <Link className="underline" href="/terms">Syarat &amp; Ketentuan</Link>
      </p>
    </main>
  );
}
