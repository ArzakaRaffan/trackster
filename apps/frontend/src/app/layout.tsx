import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Trackster',
  description: 'Personal finance expense tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
