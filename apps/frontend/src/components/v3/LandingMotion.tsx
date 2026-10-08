'use client';

import { useEffect } from 'react';
import './landing-motion.css';

// Elemen yang di-reveal saat scroll; tiap selector = satu grup stagger. Menempel ke markup LandingView (digenerate).
const GROUPS = [
  '[data-sec=fitur] > div:first-child',
  '[data-sec=fitur] + section > h2',
  '[data-sec=fitur] + section > div > span',
  '#alat > div:first-child',
  '#alat a',
  '[data-sec=harga] > div:first-child',
  '[data-sec=harga] > div:nth-child(2) > div',
  '[data-sec=faq] > h2',
  '[data-sec=faq] > div',
  '[data-sec=cta]',
];
// Anak-anak yang diberi --i (urutan) untuk stagger di CSS.
const KIDS = ['[data-rv] > div:first-child', '[data-rv] > div:last-child', '[data-rv="5"] svg + div'];
const SPOT = '[data-rv] > div:last-child, [data-sec=harga] > div:nth-child(2) > div';

/**
 * Motion landing: reveal saat scroll, tilt 3D kartu hero, sorotan kursor di kartu. Semua gaya ada di landing-motion.css
 * dan hanya berlaku selama html[data-lpm] terpasang. Matikan sementara: buka `/?motion=0`.
 */
export function LandingMotion() {
  useEffect(() => {
    if (new URLSearchParams(location.search).get('motion') === '0') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    root.setAttribute('data-lpm', '');
    const timers: number[] = [];
    const settle = (el: Element, attr: string) => timers.push(window.setTimeout(() => el.setAttribute(attr, '2'), 1800));

    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          const el = e.target;
          io.unobserve(el);
          if (el.hasAttribute('data-rv')) el.setAttribute('data-m', '1'), settle(el, 'data-m');
          else el.setAttribute('data-mr', '1'), settle(el, 'data-mr');
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );

    const scan = () => {
      GROUPS.forEach((sel) =>
        document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
          if (el.hasAttribute('data-mr')) return;
          el.style.setProperty('--d', Math.min(i, 10) * 60 + 'ms');
          el.setAttribute('data-mr', '0');
          io.observe(el);
        }),
      );
      document.querySelectorAll('[data-rv]:not([data-m])').forEach((el) => io.observe(el));
      KIDS.forEach((sel) =>
        document.querySelectorAll(sel).forEach((p) => Array.from(p.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i)))),
      );
      const hero = document.querySelector('[data-sec=hero]');
      const head = hero?.parentElement?.previousElementSibling;
      if (head?.tagName === 'HEADER') head.setAttribute('data-lp-head', '');
    };

    // LandingView dirender belakangan (logic di-load dinamis) dan menambah node saat demo berjalan: scan ulang per frame.
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();

    // Tilt kartu hero + sorotan kursor di kartu (hanya pointer presisi).
    const fine = matchMedia('(pointer: fine)').matches;
    const onMove = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest) return;
      const card = t.closest<HTMLElement>(SPOT);
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      }
      const wrap = document.querySelector<HTMLElement>('[data-sec=hero] > div:nth-child(2)');
      if (!wrap) return;
      const hero = wrap.parentElement!.getBoundingClientRect();
      const inHero = e.clientY >= hero.top && e.clientY <= hero.bottom;
      const r = wrap.getBoundingClientRect();
      const tx = inHero ? Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 + 200))) : 0;
      const ty = inHero ? Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2 + 120))) : 0;
      wrap.style.setProperty('--tx', tx.toFixed(3));
      wrap.style.setProperty('--ty', ty.toFixed(3));
    };
    if (fine) window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      root.removeAttribute('data-lpm');
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);
  return null;
}
