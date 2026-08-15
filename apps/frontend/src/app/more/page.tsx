'use client';

import Link from 'next/link';
import { BarChart3, ChevronRight, PiggyBank, Settings, Sparkles, Wallet } from 'lucide-react';

const LINKS = [
  { href: '/weekly', label: 'Mingguan', description: 'Rekap pengeluaran per minggu', Icon: BarChart3 },
  { href: '/budget', label: 'Budget', description: 'Atur budget harian', Icon: Wallet },
  { href: '/income', label: 'Pemasukan', description: 'Catat pemasukan manual', Icon: PiggyBank },
  { href: '/insights', label: 'Analisis', description: 'Insight pola pengeluaran', Icon: Sparkles },
  { href: '/settings', label: 'Setting', description: 'Gmail, Telegram, akun', Icon: Settings },
];

export default function MorePage() {
  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Menu Lainnya</p>
          <h1 className="font-title text-title font-bold text-ink">Lainnya</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <ul className="rounded-comfortable bg-surface p-2">
          {LINKS.map(({ href, label, description, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-[64px] items-center gap-3 rounded-standard px-3 py-2.5 transition-colors duration-fast ease-standard hover:bg-white/[0.07]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-bold text-ink">{label}</span>
                  <span className="block truncate text-small text-ink-muted">{description}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
