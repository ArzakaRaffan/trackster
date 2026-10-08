'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLive } from './live/useLive';
import { LandingMotion } from './LandingMotion';

// Prototipe memakai DOM/ResizeObserver/localStorage: client-only.
const V3Logic: React.ComponentType<any> = dynamic(() => import('./logic').then((m) => m.V3Logic as any), { ssr: false });

function pageBg() {
  try {
    return localStorage.getItem('v3-theme') === 'light' ? '#F2ECDD' : '#1B1814';
  } catch {
    return '#1B1814';
  }
}

/** Menyatukan prototipe v3 dengan routing Next dan data asli. `/demo/*` = data contoh, tanpa backend. */
export function V3Host() {
  const path = usePathname() || '/';
  const router = useRouter();
  const demo = path === '/demo' || path.startsWith('/demo/');
  const [chatActive, setChatActive] = useState<number | null>(null);
  const live = useLive(!demo && path.startsWith('/app'), path, chatActive);
  // Tunggu data inti sebelum menggambar layar privat, supaya tidak ada kilatan keadaan kosong.
  if (!demo && !live.ready) return <div suppressHydrationWarning style={{ position: 'fixed', inset: 0, background: pageBg() }} />;
  return (
    <>
      {path === '/' && <LandingMotion />}
      <V3Logic
        path={path}
        base={demo ? '/demo' : '/app'}
        live={demo ? undefined : live}
        onNavigate={(p: string) => router.push(p)}
        onChatActive={setChatActive}
        mulai="beranda"
        theme="dark"
        density="lega"
        heroFocus="sisa"
        mascot="aktif"
        reducedMotion={false}
      />
    </>
  );
}
