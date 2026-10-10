'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLive } from './live/useLive';
import { LandingMotion } from './LandingMotion';

// Prototipe memakai DOM/ResizeObserver/localStorage: client-only.
const V3Logic: React.ComponentType<any> = dynamic(() => import('./logic').then((m) => m.V3Logic as any), { ssr: false });

function isLight() {
  try {
    return localStorage.getItem('v3-theme') === 'light';
  } catch {
    return false;
  }
}

/** Sebelum data inti siap: latar polos ("Memuat data…" baru muncul kalau lama). Gagal dimuat: pesan + coba lagi, bukan angka bawaan prototipe. */
function LiveGate({ failed, retry }: { failed: boolean; retry: () => void }) {
  const light = isLight();
  return (
    <div suppressHydrationWarning style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: light ? '#F2ECDD' : '#1B1814', color: light ? '#1B1814' : '#EFE8D6', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      <style>{'@keyframes v3GateIn{from{opacity:0}to{opacity:1}}'}</style>
      {failed ? (
        <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 340 }}>
          <strong style={{ fontSize: 18 }}>Data belum bisa dimuat</strong>
          <span style={{ fontSize: 15, lineHeight: '22px' }}>Server Trackster tidak bisa dihubungi. Cek koneksi internetmu, lalu coba lagi.</span>
          <button onClick={retry} style={{ height: 44, padding: '0 20px', border: '1.5px solid currentColor', borderRadius: 8, background: 'transparent', color: 'inherit', font: "700 15px 'Bricolage Grotesque', sans-serif", cursor: 'pointer' }}>Coba lagi</button>
        </div>
      ) : (
        <span role="status" style={{ fontSize: 14, animation: 'v3GateIn 200ms 600ms both' }}>Memuat data…</span>
      )}
    </div>
  );
}

/** Menyatukan prototipe v3 dengan routing Next dan data asli. `/demo/*` = data contoh, tanpa backend. */
export function V3Host() {
  const path = usePathname() || '/';
  const router = useRouter();
  const demo = path === '/demo' || path.startsWith('/demo/');
  const [chatActive, setChatActive] = useState<number | null>(null);
  const live = useLive(!demo && path.startsWith('/app'), path, chatActive);
  // Tunggu data inti sebelum menggambar layar privat, supaya tidak ada kilatan keadaan kosong.
  if (!demo && (!live.ready || live.failed)) return <LiveGate failed={live.failed} retry={live.refresh} />;
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
