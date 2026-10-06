import type { Metadata } from 'next';
import TermsContent from '@/components/legal/TermsContent';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Aturan pemakaian Trackster.',
};

export default function TermsPage() {
  return <TermsContent />;
}
