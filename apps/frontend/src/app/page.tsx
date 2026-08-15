import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Camera, CheckCheck, Receipt, Share2, Users2 } from 'lucide-react';

const FEATURES = [
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
        <span className="font-title text-heading font-extrabold tracking-[-1px] text-ink">
          Trackster<span className="text-brand">.</span>
        </span>
        <Link href="/app" className="text-small font-bold text-ink-muted transition-colors duration-base ease-standard hover:text-ink">
          Masuk
        </Link>
      </header>

      <div className="px-4">
        <section className="flex flex-col items-center gap-6 py-16 text-center lg:py-24">
          <span className="rounded-full bg-surface-interactive px-3 py-1 text-micro font-bold uppercase tracking-caps text-ink-muted">
            Split Bill by Trackster
          </span>
          <h1 className="max-w-[720px] font-title text-[36px] font-black leading-[1.1] tracking-[-1px] text-ink lg:text-[56px]">
            Bagi tagihan makan bareng temen, <span className="text-brand">tanpa drama.</span>
          </h1>
          <p className="max-w-[560px] text-body leading-relaxed text-ink-muted lg:text-heading">
            Scan struk, assign menu ke masing-masing orang, terus share satu link. Semua orang langsung tau harus
            bayar berapa — nggak perlu ribet ngitung manual atau grup chat penuh screenshot kalkulator.
          </p>
          <Link href="/split-bills/new">
            <Button variant="primary" size="lg" icon={<Receipt size={18} />}>
              Buat Split Bill
            </Button>
          </Link>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:pb-24">
          {FEATURES.map(({ Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-3 rounded-medium bg-surface p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/[0.14] text-brand">
                <Icon size={20} />
              </span>
              <h2 className="text-heading font-bold text-ink">{title}</h2>
              <p className="text-body leading-relaxed text-ink-muted">{description}</p>
            </div>
          ))}
        </section>
      </div>

      <footer className="border-t border-line-subtle px-4 py-8 text-center">
        <p className="text-small text-ink-muted">
          Trackster juga punya{' '}
          <Link href="/app" className="font-bold text-ink transition-colors duration-base ease-standard hover:text-brand">
            Finance Tracker
          </Link>{' '}
          pribadi — login diperlukan.
        </p>
      </footer>
    </div>
  );
}
