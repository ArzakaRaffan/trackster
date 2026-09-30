import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://trackster.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Halaman privat & kelola pakai secret — jangan di-index.
        disallow: ['/app/', '/login', '/s/', '/split-bills/manage/', '/t/', '/trip/manage/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
