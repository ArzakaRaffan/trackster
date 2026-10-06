import type { Metadata } from 'next';
import Legal from '@/components/legal/Legal';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Data apa yang Trackster baca dari Google, untuk apa, dan cara menghapusnya.',
};

const CONTACT = 'arzakaraffan@gmail.com';

export default function PrivacyPage() {
  return (
    <Legal
      label="Privasi"
      title="Privasi dan data kamu"
      sub="Yang dibaca, yang tidak, dan cara mencabutnya."
      updated="6 Okt 2026"
      other={{ href: '/terms', text: 'Syarat & Ketentuan' }}
      top={
        <>
          <div className="lg-pair" style={{ marginTop: 0 }}>
            <div className="yes">
              <span>DIBACA</span>
              Email notifikasi transaksi dari bank: nominal, merchant atau penerima, waktu.
            </div>
            <div className="no">
              <span>TIDAK DIBACA</span>
              Email lain, kontak, lampiran. Kami juga tidak bisa mengirim atau menghapus emailmu.
            </div>
          </div>
        </>
      }
      sections={[
        {
          title: 'Izin Google yang diminta',
          body: (
            <>
              <p>Saat kamu menghubungkan Google, ada tiga izin:</p>
              <ul>
                <li>
                  <b>Gmail, hanya baca.</b> Untuk menemukan email notifikasi dari bank dan layanan pembayaran (BCA, Jago, BRImo,
                  Flip) lalu mencatatnya sebagai transaksi.
                </li>
                <li>
                  <b>Google Calendar.</b> Untuk membuat pengingat tagihan atau cicilan.
                </li>
                <li>
                  <b>Alamat email.</b> Untuk menampilkan akun mana yang sedang terhubung.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: 'Yang kami simpan',
          body: (
            <>
              <ul>
                <li>
                  Dari tiap email transaksi: pengirim, subjek, waktu terima, nominal, merchant atau penerima, dan hasil pembacaannya.{' '}
                  <b>Isi email tidak disimpan.</b>
                </li>
                <li>Token dari Google, supaya sinkronisasi jalan tanpa login ulang.</li>
                <li>Yang kamu isi sendiri: budget, pemasukan, koreksi saldo, pengaturan.</li>
              </ul>
              <p>Semua ada di database server kami di Jakarta. Tidak dijual, tidak dibagikan, tidak dipakai untuk iklan.</p>
            </>
          ),
        },
        {
          title: 'Aturan data dari Google',
          body: (
            <p>
              Penggunaan dan transfer informasi yang diterima dari Google API oleh Trackster mematuhi{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes">
                Kebijakan Data Pengguna Layanan API Google
              </a>
              , termasuk persyaratan Limited Use. Data Gmail dan Calendar hanya dipakai untuk fitur yang kamu lihat di aplikasi.
              Tidak ada manusia yang membacanya, kecuali kamu minta dibantu atau hukum mewajibkan.
            </p>
          ),
        },
        {
          title: 'Mencabut akses dan menghapus data',
          body: (
            <ul>
              <li>
                Di Trackster: Setting, tab Koneksi, <b>Putuskan Google</b>. Token langsung dihapus.
              </li>
              <li>
                Di Google: <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
              </li>
              <li>
                Hapus semua data akunmu: kirim email ke <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
              </li>
            </ul>
          ),
        },
        {
          title: 'Kontak',
          body: (
            <p>
              Ada pertanyaan soal data? <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
