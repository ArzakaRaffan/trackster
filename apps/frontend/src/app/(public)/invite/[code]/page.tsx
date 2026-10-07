import type { Metadata } from 'next';
import AuthCodeForm from '@/components/auth/AuthCodeForm';

export const metadata: Metadata = { title: 'Undangan', robots: { index: false, follow: false } };

export default function InvitePage({ params }: { params: { code: string } }) {
  return <AuthCodeForm mode="invite" code={params.code} />;
}
