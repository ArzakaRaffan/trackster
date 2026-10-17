import type { MetadataRoute } from 'next';

// Tanpa manifest, "Pasang ke layar utama" (Menu → PWA) hanya membuat pintasan tab browser, bukan aplikasi.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app',
    name: 'Trackster',
    short_name: 'Trackster',
    description: 'Catat pengeluaran otomatis dari email bank, jatah harian, dan laporan.',
    lang: 'id',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Hari ini', url: '/app/today', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
      { name: 'Tanya Track', url: '/app/chat', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
      { name: 'Langganan', url: '/app/subscriptions', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
    ],
  };
}
