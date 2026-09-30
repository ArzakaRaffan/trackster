import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://trackster.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const publicPages = [
    { path: '/', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/tools', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/split-bills/new', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/savings-calculator', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/installment-calculator', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/trip/new', priority: 0.8, changeFrequency: 'monthly' as const },
  ];

  return publicPages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
