import type { Metadata } from 'next';
import '../(legal)/legal.css';
import './pub.css';

export const metadata: Metadata = {
  title: { default: 'Trackster — Alat keuangan gratis', template: '%s — Trackster' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://trackster.dev'),
};

// Tema dibaca dari localStorage yang sama dengan app v3 ('v3-theme'), sebelum paint supaya tidak berkedip.
const THEME_INIT = `try{document.documentElement.dataset.theme=localStorage.getItem('v3-theme')==='dark'?'dark':'light'}catch(e){}`;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
