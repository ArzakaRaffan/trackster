'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TracksterLogo } from '@/components/TracksterLogo';
import {
  BarChart3,
  Bot,
  ChevronDown,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MoreHorizontal,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Sparkles,
  Sun,
  Target,
  Wallet,
} from 'lucide-react';

// Sidebar desktop (Redesign v2): 6 menu utama + grup "Lainnya" yang bisa dibuka-tutup,
// plus status sinkron di bawah. Bottom nav mobile (4 item + /app/more) tetap dipertahankan
// biar fungsi di HP nggak berubah.
const MAIN_LINKS = [
  { href: '/app', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/app/today', label: 'Hari ini', Icon: Sun },
  { href: '/app/weekly', label: 'Mingguan', Icon: BarChart3 },
  { href: '/app/budget', label: 'Budget', Icon: Wallet },
  { href: '/app/income', label: 'Pemasukan', Icon: PiggyBank },
  { href: '/app/income/checkin', label: 'Check-in', Icon: ListChecks },
];

const MORE_LINKS = [
  { href: '/split-bills', label: 'Split bill', Icon: Receipt },
  { href: '/app/reports', label: 'Laporan', Icon: LineChart },
  { href: '/app/chat', label: 'Tanya Track', Icon: Bot },
  { href: '/app/subscriptions', label: 'Langganan', Icon: Repeat },
  { href: '/app/goals', label: 'Target tabungan', Icon: Target },
  { href: '/app/settings', label: 'Setting', Icon: Settings },
  { href: '/app/insights', label: 'Analisis', Icon: Sparkles },
  { href: '/app/categorize', label: 'Rapikan kategori', Icon: ListChecks },
];

// Bottom nav mobile: 4 item utama, sisanya di /app/more.
const MOBILE_LINKS = [
  { href: '/app', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/split-bills', label: 'Split Bill', Icon: Receipt },
  { href: '/app/reports', label: 'Laporan', Icon: LineChart },
  { href: '/app/more', label: 'Lainnya', Icon: MoreHorizontal },
];

const MOBILE_SUBPATHS = [
  '/app/weekly',
  '/app/budget',
  '/app/income',
  '/app/income/checkin',
  '/app/insights',
  '/app/categorize',
  '/app/settings',
  '/app/chat',
  '/app/chat/memory',
  '/app/goals',
  '/app/subscriptions',
];

const isPath = (pathname: string, href: string) =>
  href === '/app/chat' ? pathname === '/app/chat' || pathname === '/app/chat/memory' : pathname === href;

export default function NavBar() {
  const pathname = usePathname();
  const moreActive = MORE_LINKS.some((l) => isPath(pathname, l.href));
  const [moreOpen, setMoreOpen] = useState(moreActive);

  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/savings-calculator' ||
    pathname === '/tools' ||
    pathname === '/installment-calculator' ||
    pathname === '/split-bills/new' ||
    pathname === '/trip/new' ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/split-bills/manage/') ||
    pathname.startsWith('/t/') ||
    pathname.startsWith('/trip/manage/')
  )
    return null;

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden h-screen w-[228px] shrink-0 flex-col gap-6 overflow-y-auto p-5 pl-3 lg:sticky lg:top-0 lg:flex">
        <div className="flex items-center gap-2.5 px-2.5">
          <TracksterLogo height={28} />
        </div>

        <nav aria-label="Navigasi utama" className="flex flex-col gap-0.5">
          {MAIN_LINKS.map(({ href, label, Icon }) => {
            const active = isPath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-3 rounded-medium px-2.5 text-label transition-colors duration-fast ease-standard ${
                  active ? 'bg-neutral font-bold text-text' : 'font-medium text-text-subtle hover:bg-hover hover:text-text'
                }`}
              >
                <Icon size={20} />
                <span className="flex-1">{label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="mt-2 flex h-10 items-center gap-3 rounded-medium px-2.5 text-label font-medium text-text-subtle transition-colors duration-fast ease-standard hover:bg-hover hover:text-text"
          >
            <MoreHorizontal size={20} />
            <span className="flex-1 text-left">Lainnya</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-base ease-standard ${moreOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div
            className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
            style={{ gridTemplateRows: moreOpen ? '1fr' : '0fr' }}
          >
            <div className="flex flex-col gap-0.5 overflow-hidden pl-8">
              {MORE_LINKS.map(({ href, label }) => {
                const active = isPath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    tabIndex={moreOpen ? 0 : -1}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-[34px] items-center rounded-comfortable px-2.5 text-label transition-colors duration-fast ease-standard ${
                      active
                        ? 'bg-neutral font-bold text-text'
                        : 'font-medium text-text-subtle hover:bg-hover hover:text-text'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5 px-2.5 text-[13px] leading-[18px] text-text-subtle">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full-pill bg-brand" />
          <span>BCA, Jago · sinkron otomatis</span>
        </div>
      </aside>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex bg-base/[0.92] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-md lg:hidden">
        {MOBILE_LINKS.map(({ href, label, Icon }) => {
          const active =
            href === '/app/more'
              ? pathname === '/app/more' || MOBILE_SUBPATHS.includes(pathname)
              : href === '/app'
                ? pathname === '/app' || pathname === '/app/today'
                : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-comfortable px-1 py-1.5 transition-colors duration-base ease-standard ${
                active ? 'font-bold text-text' : 'font-normal text-text-subtle'
              }`}
            >
              <Icon size={20} />
              <span className="text-micro tracking-[0.2px]">{label}</span>
              {active && <span className="h-1 w-1 rounded-full bg-brand lg:hidden" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
