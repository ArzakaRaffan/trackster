'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LineChart, MoreHorizontal, Receipt } from 'lucide-react';

// Nav disederhanakan jadi 4 item utama — sisanya (Mingguan/Budget/Pemasukan/Analisis/Setting)
// dipindah ke /app/more biar sidebar/bottom-bar nggak penuh. '/app' sekarang dashboard
// ringkas (bukan detail "Hari Ini" langsung) — itu yang jadi landing pertama begitu login.
const LINKS = [
  { href: '/app', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/split-bills', label: 'Split Bill', Icon: Receipt },
  { href: '/app/reports', label: 'Laporan', Icon: LineChart },
  { href: '/app/more', label: 'Lainnya', Icon: MoreHorizontal },
];

// Sub-halaman yang keliatan aktif di tab "Dashboard"/"Lainnya" walau URL persisnya beda
// dari href tab itu sendiri (drill-down dari dashboard, atau isi menu Lainnya).
const DASHBOARD_SUBPATHS = ['/app/today'];
const MORE_SUBPATHS = ['/app/weekly', '/app/budget', '/app/income', '/app/insights', '/app/settings'];

export default function NavBar() {
  const pathname = usePathname();

  // /split-bills/new dianggap "public-style" juga sekarang — bisa dipakai baik oleh kamu
  // (login) maupun temen yang bikin bill sendiri tanpa akun, dan buat yang anonim, nav privat
  // ini cuma nunjukin link yang bakal mental ke /login kalau diklik. Owner tetap bisa balik
  // ke /split-bills lewat tombol back di step pertama form.
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/savings-calculator' ||
    pathname === '/split-bills/new' ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/split-bills/manage/')
  )
    return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex bg-base/[0.92] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-md lg:static lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:bg-base lg:p-3 lg:shadow-none">
      <span className="hidden font-title text-heading font-extrabold tracking-[-1px] text-ink lg:mb-4 lg:block lg:px-3 lg:pt-2">
        Trackster
      </span>
      {LINKS.map(({ href, label, Icon }) => {
        const active =
          href === '/app/more'
            ? pathname === '/app/more' || MORE_SUBPATHS.includes(pathname)
            : href === '/app'
              ? pathname === '/app' || DASHBOARD_SUBPATHS.includes(pathname)
              : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-comfortable px-1 py-1.5 transition-colors duration-base ease-standard lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-subtle lg:px-3 lg:py-2.5 ${
              active ? 'font-bold text-ink lg:bg-white/[0.07]' : 'font-normal text-ink-muted'
            }`}
          >
            <Icon size={20} />
            <span className="text-micro tracking-[0.2px] lg:text-label lg:tracking-normal">{label}</span>
            {active && <span className="h-1 w-1 rounded-full bg-brand lg:hidden" />}
          </Link>
        );
      })}
    </nav>
  );
}
