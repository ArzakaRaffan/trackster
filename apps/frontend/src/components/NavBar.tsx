'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  LayoutDashboard,
  LineChart,
  PiggyBank,
  Receipt,
  Settings,
  Sparkles,
  Sun,
  Wallet,
} from 'lucide-react';

const PRIMARY_LINKS = [
  { href: '/', label: 'Beranda', Icon: LayoutDashboard },
  { href: '/split-bills', label: 'Split Bill', Icon: Receipt },
  { href: '/insights', label: 'Analisis', Icon: LineChart },
  { href: '/settings', label: 'Setting', Icon: Settings },
];

const SECONDARY_LINKS = [
  { href: '/weekly', label: 'Mingguan', Icon: BarChart3 },
  { href: '/budget', label: 'Budget', Icon: Wallet },
  { href: '/income', label: 'Pemasukan', Icon: PiggyBank },
  { href: '/reports', label: 'Laporan', Icon: LineChart },
];

export default function NavBar() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname.startsWith('/s/')) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex bg-base/[0.92] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-md lg:static lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:bg-base lg:p-3 lg:shadow-none">
      <span className="hidden font-title text-heading font-extrabold tracking-[-1px] text-ink lg:mb-4 lg:block lg:px-3 lg:pt-2">
        Trackster
      </span>

      {/* Mobile bottom nav — primary only */}
      <div className="flex w-full items-stretch gap-1 lg:hidden">
        {PRIMARY_LINKS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-comfortable px-1 py-1.5 transition-colors duration-base ease-standard ${
                active ? 'font-bold text-ink' : 'font-normal text-ink-muted'
              }`}
            >
              <Icon size={20} />
              <span className="text-micro tracking-[0.2px]">{label}</span>
              {active && <span className="h-1 w-1 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>

      {/* Desktop sidebar — grouped links */}
      <div className="hidden w-full flex-col gap-4 lg:flex">
        <div>
          <p className="px-3 pb-1 text-micro font-bold uppercase tracking-caps text-ink-subtle">Menu utama</p>
          <div className="flex flex-col gap-1">
            {PRIMARY_LINKS.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-[44px] items-center gap-3 rounded-subtle px-3 py-2.5 transition-colors duration-base ease-standard ${
                    active ? 'bg-white/[0.07] font-bold text-ink' : 'text-ink-muted'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-label">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-3 pb-1 text-micro font-bold uppercase tracking-caps text-ink-subtle">Keuangan</p>
          <div className="flex flex-col gap-1">
            {SECONDARY_LINKS.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-[44px] items-center gap-3 rounded-subtle px-3 py-2.5 transition-colors duration-base ease-standard ${
                    active ? 'bg-white/[0.07] font-bold text-ink' : 'text-ink-muted'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-label">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
