import type { Metadata } from 'next';
import Legal from '@/components/legal/Legal';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Aturan pemakaian Trackster.',
};

const CONTACT = 'arzakaraffan@gmail.com';

export default function TermsPage() {
  return (
    <Legal
      label="Syarat"
      title="Syarat dan ketentuan"
      sub="Aturan pakai Trackster, singkat saja."
      updated="6 Okt 2026"
      other={{ href: '/privacy', text: 'Kebijakan Privasi' }}
      top={
        <div className="lg-note">
          <b>Versi manusia:</b> pakai untuk datamu sendiri, jangan jadikan angkanya satu-satunya patokan, dan layanan ini bisa
          berubah atau berhenti sewaktu-waktu.
        </div>
      }
      sections={[
        {
          title: 'Layanan',
          body: (
            <p>
              Trackster mencatat pengeluaran dari email notifikasi bank dan membantu memantau budget. Ada juga beberapa tools gratis:
              split bill, kalkulator tabungan, cicilan, dan patungan trip. Dashboard hanya untuk yang diundang.
            </p>
          ),
        },
        {
          title: 'Angka bisa meleset',
          body: (
            <p>
              Angka dihitung otomatis dari email dan input kamu. Kalau format email bank berubah, hasilnya bisa tidak lengkap atau
              salah. Saldo di Trackster bukan saldo resmi bank, jadi cek ke bank untuk yang pasti. Trackster bukan nasihat keuangan.
            </p>
          ),
        },
        {
          title: 'Yang diminta dari kamu',
          body: (
            <ul>
              <li>Pakai akun Google dan data milikmu sendiri.</li>
              <li>Jaga akses akunmu.</li>
              <li>Jangan menyalahgunakan layanan atau mengintip data pengguna lain.</li>
            </ul>
          ),
        },
        {
          title: 'Tanggung jawab kami',
          body: (
            <p>
              Layanan diberikan apa adanya, tanpa jaminan selalu aktif atau selalu benar. Sejauh hukum mengizinkan, kami tidak
              bertanggung jawab atas kerugian karena pemakaian atau gangguan layanan. Akun yang menyalahgunakan layanan bisa
              ditangguhkan.
            </p>
          ),
        },
        {
          title: 'Data pribadi',
          body: (
            <p>
              Cara kami mengelola datamu ada di <a href="/privacy">Kebijakan Privasi</a>.
            </p>
          ),
        },
        {
          title: 'Kontak',
          body: (
            <p>
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
            </p>
          ),
        },
      ]}
    />
  );
}
