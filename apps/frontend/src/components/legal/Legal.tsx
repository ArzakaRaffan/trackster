import type { ReactNode } from 'react';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export type LegalSection = { title: string; body: ReactNode };

/** Halaman hukum bergaya struk v3: kertas krem, label DM Mono, garis putus-putus. Server component; hanya tombol tema yang client. */
export default function Legal({
  label,
  title,
  sub,
  updated,
  top,
  sections,
  other,
}: {
  label: string;
  title: string;
  sub: string;
  updated: string;
  /** Ringkasan di atas sebelum bagian-bagian. */
  top: ReactNode;
  sections: LegalSection[];
  other: { href: string; text: string };
}) {
  return (
    <main className="lg">
      <div className="lg-top">
        <Link href="/">← Trackster</Link>
        <ThemeToggle />
      </div>

      <article className="lg-receipt">
        <div className="lg-mono">Trackster · {label}</div>
        <h1>{title}</h1>
        <p className="lg-sub">{sub}</p>
        <div className="lg-mono" style={{ marginTop: 12 }}>
          Diperbarui {updated}
        </div>
        <hr />
        {top}
        <hr />
        {sections.map((s, i) => (
          <details key={s.title} open>
            <summary>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </summary>
            <div className="body">{s.body}</div>
          </details>
        ))}
      </article>
      <div className="lg-tear" />

      <p className="lg-foot">
        Baca juga: <Link href={other.href}>{other.text}</Link>
      </p>
    </main>
  );
}
