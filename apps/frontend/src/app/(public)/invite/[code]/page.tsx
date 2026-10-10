import type { Metadata } from 'next';
import AuthCodeForm from '@/components/auth/AuthCodeForm';

export const metadata: Metadata = { title: 'Undangan', robots: { index: false, follow: false } };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  return <AuthCodeForm mode="invite" code={(await params).code} />;
}
