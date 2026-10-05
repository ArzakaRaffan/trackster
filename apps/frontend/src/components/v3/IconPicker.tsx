'use client';

import { useEffect, useMemo, useState } from 'react';
import { ICON_CATALOG } from '@/lib/icon-catalog';
import { iconCss } from '@/lib/icons';
import { css } from './css';

const GROUPS = ['Semua', 'Ikon', 'Bank & dompet ID', 'Brand', 'Aplikasi & layanan'];
const PAGE = 120; // render awal dibatasi supaya ringan; pencarian menampilkan semua yang cocok

/** Pemilih logo, bentuknya sama dengan modal v3 lain (blanket, overlay, radius & padding dari vm). onPick(null) = hapus logo. */
export function IconPicker({ vm, title, current, onPick, onClose }: { vm: any; title: string; current?: string | null; onPick: (key: string | null) => void; onClose: () => void }) {
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
  return (
    <div style={css(`position:fixed;inset:0;z-index:60;display:flex;align-items:${vm.mAlign};justify-content:center;padding:${vm.mPad};color:var(--text);font-family:'Bricolage Grotesque',system-ui,sans-serif`)}>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--blanket)', animation: 'tsFade 200ms' }} />
      <div role="dialog" aria-modal="true" aria-labelledby="ip-h" style={css(`position:relative;width:min(560px,100%);max-height:${vm.mMax};background:var(--overlay);box-shadow:var(--shadow-overlay);border-radius:${vm.mRad};padding:22px 24px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;animation:tsModal 240ms cubic-bezier(.2,0,0,1)`)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h2 id="ip-h" style={{ margin: 0, fontSize: 19, lineHeight: '26px', fontWeight: 700, minWidth: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="scp0" style={css('width:34px;height:34px;flex:none;margin:-4px -8px 0 0;border:0;border-radius:8px;background:transparent;color:var(--text-subtle);display:flex;align-items:center;justify-content:center;cursor:pointer')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={vm.ic?.x} /></svg>
          </button>
        </div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari logo" aria-label="Cari logo" style={css('height:44px;border:0;border-radius:10px;background:var(--neutral);color:var(--text);padding:0 12px;font-size:15px;box-shadow:inset 0 0 0 1px var(--border);outline:0')} />
        <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {GROUPS.map((g) => {
            const on = group === g;
            return (
              <button key={g} role="tab" aria-selected={on} onClick={() => setGroup(g)} className="scp2" style={css(`height:34px;padding:0 14px;border:1.5px solid ${on ? 'var(--brand)' : 'var(--border)'};border-radius:8px;background:${on ? 'var(--brand)' : 'transparent'};color:${on ? 'var(--on-brand)' : 'var(--text)'};font:600 13px 'Bricolage Grotesque',sans-serif;cursor:pointer`)}>{g}</button>
            );
          })}
        </div>
        <div style={css('overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;min-height:120px;align-content:start')}>
          {shown.map((i) => {
            const on = i.key === current;
            return (
              <button key={i.key} onClick={() => onPick(i.key)} title={i.label} aria-label={i.label} aria-pressed={on} className="scp3" style={css(`border:0;border-radius:10px;padding:10px 6px 8px;background:${on ? 'var(--brand-subtle)' : 'var(--neutral)'};color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:inset 0 0 0 ${on ? '2px var(--brand)' : '1px var(--border)'}`)}>
                <span style={css(`width:40px;height:40px;border-radius:8px;display:block;${iconCss(i.key)}`)} />
                <span style={css("max-width:100%;font-size:12px;line-height:16px;color:var(--text-subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{i.label}</span>
              </button>
            );
          })}
          {!shown.length && <span style={css('grid-column:1/-1;font-size:14px;color:var(--text-subtle)')}>Tidak ada logo yang cocok.</span>}
        </div>
        <div style={css('display:flex;gap:8px;justify-content:space-between;align-items:center;border-top:1.5px dashed var(--border);padding-top:14px')}>
          <button onClick={() => onPick(null)} className="scp3" style={css('height:36px;padding:0 14px;border:0;border-radius:8px;background:transparent;color:var(--danger-text);font-size:14px;font-weight:600;cursor:pointer')}>Hapus logo</button>
          {!more && !q && list.length > PAGE && <button onClick={() => setMore(true)} className="scp3" style={css('height:36px;padding:0 14px;border:0;border-radius:8px;background:var(--neutral);color:var(--text);font-size:14px;font-weight:600;cursor:pointer')}>Tampilkan semua ({list.length})</button>}
        </div>
      </div>
    </div>
  );
}
