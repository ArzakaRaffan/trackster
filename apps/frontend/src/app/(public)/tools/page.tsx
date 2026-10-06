import type { Metadata } from 'next';
import Link from 'next/link';
import ThemeToggle from '@/components/legal/ThemeToggle';

export const metadata: Metadata = {
  title: 'Tools Keuangan Gratis',
  description:
    'Kalkulator keuangan gratis tanpa akun: split bill patungan, target tabungan, cicilan PayLater, dan patungan trip. Bantu anak muda Indonesia ngatur duit bareng.',
  openGraph: {
    title: 'Tools Keuangan Gratis - Trackster',
    description: 'Split bill, target tabungan, cicilan PayLater, patungan trip — gratis tanpa akun.',
  },
};

const TOOLS = [
  { no: '01', title: 'Split bill', desc: 'Bagi tagihan makan bareng temen: scan struk, pajak dan service dibagi proporsional, pilih avatar tiap orang.', href: '/split-bills/new', cta: 'Buat' },
  { no: '02', title: 'Patungan trip', desc: 'Banyak pengeluaran, banyak pembayar. Akhirnya tinggal transfer seminimal mungkin.', href: '/trip/new', cta: 'Buat' },
  { no: '03', title: 'Target tabungan', desc: 'Setoran per minggu atau bulan, kapan tercapai, dan bandingin tabungan, deposito, reksa dana, emas.', href: '/savings-calculator', cta: 'Hitung' },
  { no: '04', title: 'PayLater dan cicilan', desc: 'Bunga flat kelihatan kecil? Lihat bunga efektif per tahun, jadwal cicilan, dan bandingin tenor.', href: '/installment-calculator', cta: 'Hitung' },
];

export default function ToolsHubPage() {
  return (
    <main className="pb">
      <div className="pb-top">
        <Link href="/">← Trackster</Link>
        <ThemeToggle />
      </div>

      <article className="pb-receipt">
        <div className="pb-mono">Trackster · Alat gratis · tanpa daftar</div>
        <h1>Semua tools keuangan</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-subtle)' }}>Satu tempat buat urusan duit bareng: patungan, tabungan, sampai cicilan. Buka, pakai, share. Nggak perlu daftar.</p>
        <hr />
        <div className="pb-mono" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12 }}>
          <span>Struk alat gratis</span>
          <span>Qty {TOOLS.length}</span>
        </div>
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="pb-tool">
            <span className="no">{t.no}</span>
            <span className="tx">
              <b>{t.title}</b>
              <span>{t.desc}</span>
            </span>
            <span className="go">{t.cta} →</span>
          </Link>
        ))}
        <div className="pb-kv" style={{ marginTop: 6 }}>
          <span className="pb-mono">Total bayar</span>
          <b style={{ fontSize: 22 }}>Rp0</b>
        </div>
      </article>
      <div className="pb-tear" />

      <div className="pb-cta">
        <span>
          <b>Mau dicatat otomatis?</b> Trackster baca email bank BCA dan Jago, lalu hitung sisa budget harianmu.
        </span>
        <Link className="pb-btn pri" href="/">
          Kenalan sama Trackster
        </Link>
      </div>
    </main>
  );
}
