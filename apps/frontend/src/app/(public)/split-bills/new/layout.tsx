import type { Metadata } from 'next';
import { WebAppLd } from '@/lib/seo';

const DESC =
  'Bagi tagihan makan bareng: scan struk, pajak dan service dibagi proporsional, bagikan link ke teman. Gratis, tanpa perlu bikin akun.';

export const metadata: Metadata = {
  title: 'Split Bill Online: Bagi Tagihan Patungan dari Struk',
  description: DESC,
  alternates: { canonical: '/split-bills/new' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WebAppLd name="Split Bill Trackster" path="/split-bills/new" description={DESC} />
      {children}
    </>
  );
}
