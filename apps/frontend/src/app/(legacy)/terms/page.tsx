import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Aturan pemakaian Trackster.',
};

const UPDATED = '6 Oktober 2026';
const CONTACT = 'arzakaraffan@gmail.com';

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-2xl font-extrabold">Syarat &amp; Ketentuan Trackster</h1>
      <p>Terakhir diperbarui: {UPDATED}</p>

      <p>Dengan memakai Trackster (trackster.dev) kamu setuju dengan syarat di bawah ini.</p>

      <h2>Layanan</h2>
      <p>
        Trackster membantu mencatat pengeluaran dan memantau budget dari email notifikasi bank, plus beberapa tools keuangan
        gratis (split bill, kalkulator tabungan, cicilan, patungan trip). Akses ke fitur dashboard bersifat undangan.
      </p>

      <h2>Bukan nasihat keuangan</h2>
      <p>
        Angka di Trackster dihitung otomatis dari email dan input kamu, bisa saja tidak lengkap atau keliru (mis. format email
        bank berubah). Saldo di aplikasi bukan saldo resmi bank. Jangan dijadikan satu-satunya dasar keputusan keuangan.
      </p>

      <h2>Tanggung jawabmu</h2>
      <ul>
        <li>Gunakan hanya akun Google dan data milikmu sendiri.</li>
        <li>Jaga kerahasiaan akses akunmu.</li>
        <li>Jangan menyalahgunakan layanan atau mencoba mengakses data pengguna lain.</li>
      </ul>

      <h2>Ketersediaan &amp; tanggung jawab kami</h2>
      <p>
        Layanan diberikan apa adanya, tanpa jaminan uptime atau kebenaran data. Sejauh diizinkan hukum, kami tidak bertanggung
        jawab atas kerugian akibat penggunaan atau gangguan layanan. Kami dapat mengubah atau menghentikan layanan, atau
        menangguhkan akun yang menyalahgunakannya.
      </p>

      <h2>Data pribadi</h2>
      <p>
        Pengelolaan data diatur di <Link className="underline" href="/privacy">Kebijakan Privasi</Link>.
      </p>

      <h2>Kontak</h2>
      <p>
        <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </main>
  );
}
