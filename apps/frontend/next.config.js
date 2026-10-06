/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    // Halaman Split Bill lama (untuk user login) sudah digantikan v3. /split-bills/new & /manage/* tetap publik.
    return [
      { source: '/split-bills', destination: '/app/split', permanent: true },
      { source: '/split-bills/:id(\d+)', destination: '/app/split', permanent: true },
    ];
  },
};

module.exports = nextConfig;
