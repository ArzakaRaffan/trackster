import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Landmark, Receipt, Route, Wallet } from 'lucide-react';

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
  {
    key: 'split-bill',
    Icon: Receipt,
    title: 'Split Bill',
    desc: 'Bagi tagihan makan bareng temen: scan struk, pajak & service dibagi proporsional.',
    href: '/split-bills/new',
    cta: 'Buat Split Bill',
  },
  {
    key: 'trip',
    Icon: Route,
    title: 'Patungan Trip',
    desc: 'Banyak pengeluaran, banyak pembayar. Akhir tinggal transfer seminimal mungkin.',
    href: '/trip/new',
    cta: 'Buat Trip',
  },
  {
    key: 'savings',
    Icon: Landmark,
    title: 'Target Tabungan',
    desc: 'Nabung buat motor, HP, atau DP rumah — tau setoran per minggu/bulan & kapan tercapai.',
    href: '/savings-calculator',
    cta: 'Coba Kalkulator',
  },
  {
    key: 'installment',
    Icon: Wallet,
    title: 'PayLater & Cicilan',
    desc: 'Bunga flat terlihat kecil? Lihat bunga efektif per tahun & hemat kalau nabung dulu.',
    href: '/installment-calculator',
    cta: 'Coba Kalkulator',
  },
];

export default function ToolsHubPage() {
  return (
    <div className="min-h-screen bg-base px-4 text-ink">
      <header className="mx-auto flex max-w-content flex-col items-center gap-3 py-12 text-center">
        <span className="rounded-full bg-surface-interactive px-3 py-1 text-micro font-bold uppercase tracking-caps text-ink-muted">
          Gratis · tanpa akun
        </span>
        <h1 className="font-title text-title font-black tracking-[-1px] lg:text-[40px]">
          Semua tools keuangan Trackster
        </h1>
        <p className="max-w-[520px] text-body leading-relaxed text-ink-muted">
          Satu tempat buat urusan duit bareng: patungan, tabungan, sampai cicilan. Buka, pakai, share — nggak perlu daftar.
        </p>
      </header>

      <section className="mx-auto grid max-w-content gap-4 pb-16 sm:grid-cols-2">
        {TOOLS.map(({ key, Icon, title, desc, href, cta }) => (
          <Link
            key={key}
            href={href}
            className="group flex flex-col gap-3 rounded-panel bg-surface p-6 transition-colors duration-base ease-standard hover:bg-surface-interactive"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/[0.14] text-brand">
              <Icon size={20} />
            </span>
            <h2 className="text-heading font-bold">{title}</h2>
            <p className="flex-1 text-small leading-relaxed text-ink-muted">{desc}</p>
            <span className="flex items-center gap-1.5 text-label font-bold text-ink transition-colors duration-base ease-standard group-hover:text-brand">
              {cta} <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
