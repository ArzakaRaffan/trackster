import type { Metadata } from 'next';
import PrivacyContent from '@/components/legal/PrivacyContent';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Data apa yang Trackster baca dari Google, untuk apa, dan bagaimana menghapusnya.',
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
