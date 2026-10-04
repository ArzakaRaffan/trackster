'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useLive } from './live/useLive';

// Prototipe memakai DOM/ResizeObserver/localStorage: client-only.
const V3Logic: React.ComponentType<any> = dynamic(() => import('./logic').then((m) => m.V3Logic as any), { ssr: false });

/** Menyatukan prototipe v3 dengan routing Next dan data asli. `/demo/*` = data contoh, tanpa backend. */
export function V3Host() {
  const path = usePathname() || '/';
  const router = useRouter();
  const demo = path === '/demo' || path.startsWith('/demo/');
  const live = useLive(!demo && path.startsWith('/app'), path);
  return (
    <V3Logic
      path={path}
      base={demo ? '/demo' : '/app'}
      live={demo ? undefined : live}
      onNavigate={(p: string) => router.push(p)}
      mulai="beranda"
      theme="dark"
      density="lega"
      heroFocus="sisa"
      mascot="aktif"
      reducedMotion={false}
    />
  );
}
