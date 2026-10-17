/** @type {import('next').NextConfig} */

// Header keamanan semua halaman. Next & layar v3 memakai script/style inline (tanpa nonce) → 'unsafe-inline' tetap perlu,
// tapi script/koneksi/gambar/font kini hanya dari origin sendiri + API + Google Fonts: script asing tak bisa dimuat dan data
// tak bisa dikirim ke host lain bila suatu saat ada XSS. Dev butuh 'unsafe-eval' (React Refresh) & ws (HMR).
const isDev = process.env.NODE_ENV !== 'production';
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').origin;
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${apiOrigin} https://fonts.googleapis.com https://fonts.gstatic.com${isDev ? ' ws:' : ''}`, // html-to-image mengambil font untuk disematkan
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, // URL /invite/<kode>, /reset/<token>, /manage/<token> tak bocor ke situs lain
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    // Halaman Split Bill lama (untuk user login) sudah digantikan v3. /split-bills/new & /manage/* tetap publik.
    return [
      { source: '/split-bills', destination: '/app/split', permanent: true },
      { source: '/split-bills/:id(\d+)', destination: '/app/split', permanent: true },
    ];
  },
};

module.exports = nextConfig;
