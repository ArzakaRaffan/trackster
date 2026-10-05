'use client';

import { useEffect, useMemo, useState } from 'react';
import { ICON_CATALOG } from '@/lib/icon-catalog';
import { iconCss } from '@/lib/icons';
import { css } from './css';

const GROUPS = ['Ikon', 'Bank & dompet ID', 'Brand', 'Aplikasi & layanan'];
const PAGE = 120; // batas render awal supaya picker ringan; pencarian menampilkan semua yang cocok

/** Pemilih logo: katalog SVG di /public/icons. onPick(null) = hapus logo. Gaya = token v3 (CSS variable di root). */
export function IconPicker({ title, current, onPick, onClose }: { title: string; current?: string | null; onPick: (key: string | null) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('Semua');
  const [more, setMore] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return ICON_CATALOG.filter((i) => (group === 'Semua' || i.group === group) && (!n || i.label.toLowerCase().includes(n)));
  }, [q, group]);
  const shown = more || q ? list : list.slice(0, PAGE);
  const chip = (g: string) => (
    <button key={g} onClick={() => setGroup(g)} style={css(`height:32px;padding:0 12px;border:0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:${group === g ? 'var(--brand)' : 'var(--neutral)'};color:${group === g ? 'var(--on-brand)' : 'var(--text)'}`)}>{g}</button>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={css('position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px')}>
      <div onClick={(e) => e.stopPropagation()} style={css("width:min(560px,100%);max-height:min(640px,90vh);background:var(--card);color:var(--text);border-radius:12px;box-shadow:var(--shadow-card);display:flex;flex-direction:column;gap:12px;padding:var(--pad);font-family:'Bricolage Grotesque',system-ui,sans-serif")}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
          <span style={css('font-size:17px;font-weight:700')}>{title}</span>
          <button onClick={onClose} aria-label="Tutup" style={css('width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:var(--text-subtle);font-size:18px;cursor:pointer')}>✕</button>
        </div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari logo…" aria-label="Cari logo" style={css('height:44px;border:0;border-radius:10px;background:var(--neutral);color:var(--text);padding:0 12px;font-size:15px;box-shadow:inset 0 0 0 1px var(--border);outline:0')} />
        <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>{['Semua', ...GROUPS].map(chip)}</div>
        <div style={css('overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;min-height:120px')}>
          {shown.map((i) => (
            <button key={i.key} onClick={() => onPick(i.key)} title={i.label} aria-label={i.label} style={css(`border:0;border-radius:10px;padding:8px 4px;background:${i.key === current ? 'var(--brand-subtle)' : 'var(--neutral)'};color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;box-shadow:${i.key === current ? 'inset 0 0 0 2px var(--brand)' : 'none'}`)}>
              <span style={css(`width:40px;height:40px;border-radius:8px;${iconCss(i.key)}`)} />
              <span style={css('max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{i.label}</span>
            </button>
          ))}
          {!shown.length && <span style={css('grid-column:1/-1;color:var(--text-subtle);font-size:14px')}>Tidak ada logo yang cocok.</span>}
        </div>
        {!more && !q && list.length > PAGE && <button onClick={() => setMore(true)} style={css('height:36px;border:0;border-radius:8px;background:var(--neutral);color:var(--text);font-weight:600;cursor:pointer')}>Tampilkan semua ({list.length})</button>}
        <button onClick={() => onPick(null)} style={css('height:40px;border:0;border-radius:8px;background:transparent;color:var(--danger-text);font-weight:600;cursor:pointer')}>Hapus logo</button>
      </div>
    </div>
  );
}
