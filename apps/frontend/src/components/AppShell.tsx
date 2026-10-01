'use client';

import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { MotionProvider } from '@/components/MotionProvider';

// Halaman publik (marketing/tools/landing/login) render full-bleed tanpa sidebar
// dan tanpa wrapper `main` yang dipakai dashboard privat. Daftar ini harus sama
// dengan early-return di NavBar dan PUBLIC_* di middleware.
const PUBLIC_EXACT = [
  '/',
  '/login',
  '/savings-calculator',
  '/tools',
  '/installment-calculator',
  '/split-bills/new',
  '/trip/new',
];
const PUBLIC_PREFIX = ['/s/', '/split-bills/manage/', '/t/', '/trip/manage/'];

function isPublic(pathname: string) {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublic(pathname)) {
    return <>{children}</>;
  }

  return (
    <MotionProvider>
      <NavBar />
      <main className="mx-auto w-full max-w-content lg:flex-1 lg:py-4 lg:pl-2 lg:pr-24 lg:pb-28">
        {children}
      </main>
    </MotionProvider>
  );
}
