/** @type {import('next').NextConfig} */

// Header keamanan semua halaman. CSP sengaja minimal (tanpa script-src): layar v3 & Next memakai script/style inline;
// yang dikunci = framing (clickjacking), <base>, plugin, dan tujuan form.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, // URL /invite/<kode>, /reset/<token>, /manage/<token> tak bocor ke situs lain
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
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
