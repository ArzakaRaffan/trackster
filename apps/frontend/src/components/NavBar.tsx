'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LineChart, PiggyBank, Settings, Sparkles, Sun, Wallet } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'Hari Ini', Icon: Sun },
  { href: '/weekly', label: 'Mingguan', Icon: BarChart3 },
  { href: '/budget', label: 'Budget', Icon: Wallet },
  { href: '/income', label: 'Pemasukan', Icon: PiggyBank },
  { href: '/reports', label: 'Laporan', Icon: LineChart },
  { href: '/insights', label: 'Analisis', Icon: Sparkles },
  { href: '/settings', label: 'Setting', Icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex bg-base/[0.92] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-md lg:static lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:bg-base lg:p-3 lg:shadow-none">
      <span className="hidden font-title text-heading font-extrabold tracking-[-1px] text-ink lg:mb-4 lg:block lg:px-3 lg:pt-2">
        Trackster
      </span>
      {LINKS.map(({ href, label, Icon }) => {
        const active = pathname === href;
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
