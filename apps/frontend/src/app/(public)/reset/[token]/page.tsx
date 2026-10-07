import type { Metadata } from 'next';
import AuthCodeForm from '@/components/auth/AuthCodeForm';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false, follow: false } };

export default function ResetPage({ params }: { params: { token: string } }) {
  return <AuthCodeForm mode="reset" code={params.token} />;
}
