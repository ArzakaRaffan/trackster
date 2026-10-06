'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useSpring, useReducedMotion } from 'motion/react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export type LegalTldr = { Icon: LucideIcon; title: string; text: string };
export type LegalSection = { id: string; Icon: LucideIcon; title: string; body: ReactNode };

const BODY =
  'text-text-subtle leading-relaxed [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_a]:text-brand [&_a]:underline [&_b]:text-text [&_b]:font-semibold';

export default function LegalPage({
  title,
  updated,
  intro,
  tldr,
  sections,
  extra,
  other,
}: {
  title: string;
  updated: string;
  intro: string;
  tldr: LegalTldr[];
  sections: LegalSection[];
  /** Widget interaktif opsional, tampil di antara ringkasan dan isi lengkap. */
  extra?: ReactNode;
  other: { href: string; label: string };
}) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.map((s) => [s.id, true])));
  const [active, setActive] = useState(sections[0].id);
  const allOpen = sections.every((s) => open[s.id]);

  // Tandai section yang sedang dibaca untuk daftar isi.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [sections]);

  const goTo = (id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const rise = (delay = 0) =>
    reduce ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <main className="relative w-full">
      <motion.div aria-hidden className="fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-brand" style={{ scaleX: progress }} />

      <div className="mx-auto w-full max-w-content px-5 pb-24 pt-12 md:pt-16">
        <Link href="/" className="text-label text-text-subtle transition-colors hover:text-text">
          ← Trackster
        </Link>

        <header className="relative mt-6 overflow-hidden rounded-panel bg-surface px-6 py-10 shadow-hairline md:px-10 md:py-14">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
            animate={reduce ? undefined : { x: [0, -30, 0], y: [0, 20, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.h1
            className="relative font-title text-4xl font-black tracking-tight md:text-6xl"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {title}
          </motion.h1>
          <p className="relative mt-4 max-w-xl text-body leading-normal text-text-subtle">{intro}</p>
          <p className="relative mt-4 inline-block rounded-pill bg-brand-subtle px-3 py-1 text-small font-semibold text-brand">
            Diperbarui {updated}
          </p>
        </header>

        <section aria-label="Ringkasan" className="mt-8">
          <h2 className="text-small font-bold uppercase tracking-caps text-text-subtle">Singkatnya</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {tldr.map(({ Icon, title: t, text }, i) => (
              <motion.div
                key={t}
                {...rise(i * 0.08)}
                whileHover={reduce ? undefined : { y: -4 }}
                className="rounded-card-lg bg-surface p-5 shadow-hairline transition-colors hover:bg-surface-interactive"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-subtle text-brand">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 text-heading font-bold">{t}</h3>
                <p className="mt-1 text-label leading-snug text-text-subtle">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {extra && <div className="mt-8">{extra}</div>}

        <div className="mt-12 grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Daftar isi" className="hidden lg:block">
            <ul className="sticky top-8 space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => goTo(s.id)}
                    className={`relative w-full rounded-comfortable px-3 py-2 text-left text-label transition-colors ${active === s.id ? 'text-text' : 'text-text-subtle hover:text-text'}`}
                  >
                    {active === s.id && <motion.span layoutId="toc-pill" className="absolute inset-0 -z-0 rounded-comfortable bg-hover" />}
                    <span className="relative">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <div className="flex justify-end">
              <button
                onClick={() => setOpen(Object.fromEntries(sections.map((s) => [s.id, !allOpen])))}
                className="rounded-pill px-3 py-1.5 text-small font-semibold text-text-subtle shadow-hairline transition-colors hover:bg-hover hover:text-text"
              >
                {allOpen ? 'Tutup semua' : 'Buka semua'}
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {sections.map(({ id, Icon, title: t, body }, i) => (
                <motion.section key={id} id={id} {...rise()} className="scroll-mt-6 overflow-hidden rounded-card-lg bg-surface shadow-hairline">
                  <button
                    aria-expanded={!!open[id]}
                    aria-controls={`${id}-body`}
                    onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-interactive"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
                      <Icon size={18} />
                    </span>
                    <span className="flex-1 text-heading font-bold">
                      <span className="mr-2 text-small font-semibold text-text-subtlest">{String(i + 1).padStart(2, '0')}</span>
                      {t}
                    </span>
                    <motion.span animate={{ rotate: open[id] ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-text-subtle">
                      <ChevronDown size={20} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open[id] && (
                      <motion.div
                        id={`${id}-body`}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.3, 0, 0.4, 1] }}
                        className="overflow-hidden"
                      >
                        <div className={`px-5 pb-5 pl-[68px] ${BODY}`}>{body}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              ))}
            </div>

            <p className="mt-10 text-label text-text-subtle">
              Baca juga:{' '}
              <Link className="text-brand underline" href={other.href}>
                {other.label}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
