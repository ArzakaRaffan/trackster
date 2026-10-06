'use client';

import { useEffect, useState } from 'react';

// Ikon sama dengan tombol tema di /app (v3): saat gelap tampil matahari (→ terang), saat terang tampil bulan (→ gelap).
const SUN = 'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4L7 17 M17 7l1.4-1.4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === 'dark'), []);

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('v3-theme', next);
    } catch {}
    setDark(!dark);
  };

  return (
    <button className="lg-theme" onClick={toggle} aria-label="Ganti tema terang atau gelap" title="Tema" style={{ width: 44, height: 40, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dark ? SUN : MOON} />
      </svg>
    </button>
  );
}
