'use client';

import { useEffect, useState } from 'react';

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
    <button className="lg-theme" onClick={toggle} aria-label="Ganti tema">
      {dark ? 'Terang' : 'Gelap'}
    </button>
  );
}
