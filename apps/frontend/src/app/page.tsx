'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { TRANSITION_SLOW } from '@/lib/motion';
import {
  ArrowRight,
  Bell,
  Camera,
  CheckCheck,
  LineChart,
  Lock,
  PiggyBank,
  Receipt,
  Share2,
  Sparkles,
  Target,
  Users2,
  Wallet,
} from 'lucide-react';

const PILLARS = [
  {
    key: 'split-bill',
    Icon: Receipt,
    badge: 'Gratis · tanpa akun',
    badgeTone: 'live' as const,
    title: 'Split Bill',
    description: 'Bagi tagihan makan bareng temen tanpa drama itung-itungan manual.',
    bullets: ['Scan struk otomatis lewat AI', 'Assign menu per orang, pajak dibagi rata', 'Satu link, temen nggak perlu akun'],
    href: '/split-bills/new',
    cta: 'Buat Split Bill',
  },
  {
    key: 'calculator',
    Icon: Target,
    badge: 'Gratis · tanpa akun',
    badgeTone: 'live' as const,
    title: 'Kalkulator Target Tabungan',
    description: 'Mau nabung buat motor, HP baru, atau DP rumah? Langsung ketauan nabungnya berapa per bulan.',
    bullets: ['Preset goal ala Indonesia', 'Kalkulasi real-time, nggak perlu submit', 'Hasil bisa didownload buat di-share'],
    href: '/savings-calculator',
    cta: 'Coba Kalkulator',
  },
  {
    key: 'tracker',
    Icon: Wallet,
    badge: 'Private · segera buat publik',
    badgeTone: 'soon' as const,
    title: 'Finance Tracker',
    description: 'Ini yang tiap hari dipake mantau duit sendiri. Sekarang masih private, tapi bakal segera bisa kamu pake juga.',
    bullets: [
      'Sync otomatis dari email BCA & Jago, nol input manual',
      'Budget harian + alert Telegram pas kelewat',
      'Laporan & insight pola belanja tiap bulan',
      'Saldo tiap rekening ke-track live',
    ],
    href: '/app',
    cta: 'Buat yang udah punya akses',
  },
];

const SPLIT_BILL_DETAILS = [
  {
    Icon: Camera,
    title: 'Scan struk, bukan ketik manual',
    description: 'Foto struk, item & harga langsung ke-extract otomatis lewat AI. Tinggal koreksi kalau ada yang meleset.',
  },
  {
    Icon: Users2,
    title: 'Assign menu per orang',
    description: 'Tambah nama, centang siapa pesan apa. Pajak & service fee dibagi rata otomatis ke semua peserta.',
  },
  {
    Icon: Share2,
    title: 'Satu link buat semua',
    description: 'Share link ke grup chat. Temen kamu buka langsung liat tagihannya masing-masing — nggak perlu install apa-apa atau bikin akun.',
  },
  {
    Icon: CheckCheck,
    title: 'Tandai lunas, beres',
    description: 'Tiap orang tandai sendiri kalau udah transfer. Kamu tinggal pantau siapa yang belum bayar dari satu halaman.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <header className="flex items-center justify-between px-4 py-6">
        <Image src="/trackster-logo.png" alt="Trackster" width={509} height={198} className="h-10 w-auto" priority />
        <Link href="/app" className="text-small font-bold text-ink-muted transition-colors duration-base ease-standard hover:text-ink">
          Masuk
        </Link>
      </header>

      <div className="px-4">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION_SLOW}
          className="flex flex-col items-center gap-6 py-16 text-center lg:py-24"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-surface-interactive px-3 py-1 text-micro font-bold uppercase tracking-caps text-ink-muted">
            <Sparkles size={12} className="text-brand" />
            Temen ngatur duit kamu
          </span>
          <h1 className="max-w-[720px] font-title text-[36px] font-black leading-[1.1] tracking-[-1px] text-ink lg:text-[56px]">
            Kenalan sama Trackster, <span className="text-brand">finance buddy</span> kamu.
          </h1>
          <p className="max-w-[600px] text-body leading-relaxed text-ink-muted lg:text-heading">
            Dari bagi tagihan bareng temen, itung target tabungan, sampai — segera — nge-track tiap rupiah otomatis
            dari email bank kamu. Trackster ada buat semua itu, bukan cuma satu hal doang.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/split-bills/new">
              <Button variant="primary" size="lg" icon={<Receipt size={18} />}>
                Buat Split Bill
              </Button>
            </Link>
            <Link href="/savings-calculator">
              <Button variant="outlined" size="lg" icon={<Target size={18} />}>
                Coba Kalkulator Tabungan
              </Button>
            </Link>
          </div>
        </motion.section>

        <section className="pb-16 lg:pb-24">
          <div className="mb-6 text-center">
            <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Satu temen, tiga cara bantuin</p>
            <h2 className="mt-2 font-title text-heading font-bold text-ink lg:text-title">Apa aja yang Trackster bisa</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PILLARS.map((pillar, i) => (
              <motion.div
                key={pillar.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...TRANSITION_SLOW, delay: i * 0.08 }}
                className={`flex flex-col gap-4 rounded-medium p-6 ${
                  pillar.badgeTone === 'soon' ? 'bg-surface shadow-[inset_0_0_0_1px_theme(colors.line.subtle)]' : 'bg-surface'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/[0.14] text-brand">
                    <pillar.Icon size={20} />
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-bold uppercase tracking-caps ${
                      pillar.badgeTone === 'live' ? 'bg-status-under-bg text-status-under' : 'bg-status-info-bg text-status-info'
                    }`}
                  >
                    {pillar.badgeTone === 'soon' && <Lock size={10} />}
                    {pillar.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-heading font-bold text-ink">{pillar.title}</h3>
                  <p className="mt-1 text-body leading-relaxed text-ink-muted">{pillar.description}</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {pillar.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-small leading-relaxed text-ink-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
                      {b}
                    </li>
                  ))}
                </ul>
                {pillar.badgeTone === 'live' ? (
                  <Link
                    href={pillar.href}
                    className="mt-auto flex items-center gap-1.5 pt-2 text-label font-bold text-ink transition-colors duration-base ease-standard hover:text-brand"
                  >
                    {pillar.cta} <ArrowRight size={15} />
                  </Link>
                ) : (
                  <Link
                    href={pillar.href}
                    className="mt-auto flex items-center gap-1.5 pt-2 text-small font-bold text-ink-subtle transition-colors duration-base ease-standard hover:text-ink-muted"
                  >
                    {pillar.cta} <ArrowRight size={13} />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        <section className="pb-16 lg:pb-24">
          <div className="mb-6">
            <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Kenapa Split Bill Trackster beda</p>
            <h2 className="mt-2 font-title text-heading font-bold text-ink lg:text-title">Detail yang bikin nggak ribet</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SPLIT_BILL_DETAILS.map(({ Icon, title, description }) => (
              <div key={title} className="flex flex-col gap-3 rounded-medium bg-surface p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/[0.14] text-brand">
                  <Icon size={20} />
                </span>
                <h3 className="text-heading font-bold text-ink">{title}</h3>
                <p className="text-body leading-relaxed text-ink-muted">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-16 lg:pb-24">
          <div className="overflow-hidden rounded-panel bg-surface">
            <div className="bg-gradient-to-b from-status-info/[0.12] to-transparent px-6 pb-8 pt-8 text-center sm:px-10">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-info-bg text-status-info">
                <LineChart size={22} />
              </span>
              <p className="mt-3 text-micro font-bold uppercase tracking-caps text-ink-muted">Sneak peek</p>
              <h2 className="mt-1 font-title text-title font-bold text-ink">Finance Tracker yang lagi disiapin</h2>
              <p className="mx-auto mt-2 max-w-[520px] text-body leading-relaxed text-ink-muted">
                Ini yang tiap hari Trackster pake buat mantau budget sendiri — otomatis, bukan nyatet manual. Masih
                private buat sekarang, tapi arahnya emang bakal segera bisa kamu pake juga.
              </p>
            </div>
            <div className="grid gap-px border-t border-line-subtle bg-line-subtle sm:grid-cols-2">
              {[
                { Icon: Bell, text: 'Transaksi ke-catat otomatis dari notifikasi email BCA & Jago — nol input manual' },
                { Icon: Wallet, text: 'Budget harian + alert Telegram detik itu juga begitu kelewat' },
                { Icon: LineChart, text: 'Laporan & insight otomatis, ketauan pola belanja kamu kemana' },
                { Icon: PiggyBank, text: 'Saldo tiap rekening ke-track live, bukan estimasi kasar' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-start gap-3 bg-surface p-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
                    <Icon size={15} />
                  </span>
                  <p className="text-small leading-relaxed text-ink-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-line-subtle px-4 py-8 text-center">
        <p className="text-small text-ink-muted">
          Udah punya akses Finance Tracker?{' '}
          <Link href="/app" className="font-bold text-ink transition-colors duration-base ease-standard hover:text-brand">
            Masuk di sini
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
