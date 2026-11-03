const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://trackster.dev';

/** JSON-LD WebApplication untuk satu tool publik. `path` = rute tool (mis. '/savings-calculator'). */
export function WebAppLd({ name, path, description }: { name: string; path: string; description: string }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url: `${SITE_URL}${path}`,
    description,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: 'id-ID',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
    publisher: { '@type': 'Organization', name: 'Trackster', url: SITE_URL },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}
