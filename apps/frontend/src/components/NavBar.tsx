'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const LINKS = [
  { href: '/', label: 'Hari Ini' },
  { href: '/weekly', label: 'Mingguan' },
  { href: '/budget', label: 'Budget' },
  { href: '/settings', label: 'Setting' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return null;

  const handleLogout = async () => {
    await api.post('/auth/logout');
    router.push('/login');
  };

  return (
    <nav className="border-b bg-white">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">Trackster</span>
        <div className="flex gap-4 text-sm items-center">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'font-semibold text-blue-600' : 'text-gray-600'}
            >
              {link.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">
            Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
