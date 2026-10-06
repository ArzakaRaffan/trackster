'use client';

import { useEffect, useState } from 'react';
import { BG, SHIRT, SKIN, STYLES, avatarCssOf, encodeSpec, hairPalette, specFor, type AvatarSpec } from '@/lib/avatars';

// Hanya pakai token yang ada di v3 DAN halaman publik (legal.css); sisanya punya fallback.
const CSS = `
.avp{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;font-family:'Bricolage Grotesque',system-ui,sans-serif;color:var(--text)}
.avp-bg{position:absolute;inset:0;background:var(--blanket,rgba(0,0,0,.5));animation:avpFade 200ms}
.avp-box{position:relative;width:100%;max-width:520px;max-height:92dvh;overflow-y:auto;box-sizing:border-box;background:var(--overlay,var(--card));box-shadow:0 0 0 1.5px var(--border);border-radius:16px 16px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;animation:avpUp 240ms cubic-bezier(.2,0,0,1)}
@media(min-width:600px){.avp{align-items:center;padding:24px}.avp-box{border-radius:16px;padding:22px 24px 24px}}
.avp-head{display:flex;align-items:center;gap:14px}
.avp-prev{width:72px;height:72px;flex:none;border-radius:50%;box-shadow:0 0 0 2px var(--border)}
.avp-title{margin:0;font-size:19px;line-height:26px;font-weight:700;min-width:0;overflow-wrap:anywhere}
.avp-sub{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-subtle)}
.avp-lbl{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-subtle);margin:0 0 8px}
.avp-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}@media(max-width:360px){.avp-grid{gap:6px}}
.avp-tile{aspect-ratio:1;border:0;border-radius:12px;padding:0;cursor:pointer;background-color:var(--card);box-shadow:inset 0 0 0 1.5px var(--border)}
.avp-tile[aria-pressed=true]{box-shadow:0 0 0 3px var(--brand)}
.avp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.avp-dot{width:34px;height:34px;border-radius:50%;border:0;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.18)}
.avp-dot[aria-pressed=true]{box-shadow:0 0 0 3px var(--brand)}
.avp-btn{height:40px;padding:0 16px;border:0;border-radius:8px;font:600 14px 'Bricolage Grotesque',system-ui,sans-serif;cursor:pointer;background:var(--neutral,var(--hover));color:var(--text)}
.avp-btn.pri{background:var(--brand);color:var(--on-brand);font-weight:700}
.avp-btn[aria-pressed=true]{background:var(--brand);color:var(--on-brand)}
.avp-btn:disabled{opacity:.5;cursor:default}
.avp-foot{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;border-top:1.5px dashed var(--border);padding-top:14px}
.avp button:focus-visible{outline:2px solid var(--text);outline-offset:2px}
@keyframes avpFade{from{opacity:0}to{opacity:1}}
@keyframes avpUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.avp-bg,.avp-box{animation:none}}
`;

const rand = (n: number) => Math.floor(Math.random() * n);

/** Pemilih avatar orang: gaya (cowok/cewek), warna kulit, rambut, latar, baju, kacamata. Bottom-sheet di HP, dialog di layar lebar. */
export function AvatarPicker({ name, value, onSave, onClose }: { name: string; value?: string | null; onSave: (spec: string) => Promise<unknown> | void; onClose: () => void }) {
  const [s, setS] = useState<AvatarSpec>(() => specFor(name, value));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<AvatarSpec>) => setS((z) => ({ ...z, ...p }));

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(encodeSpec(s));
    } finally {
      setBusy(false);
    }
  };

  const hairs = hairPalette(s.style);
  const swatches = (list: string[], cur: number, key: 'skin' | 'hair' | 'bg' | 'shirt', label: string) => (
    <div className="avp-row">
      {list.map((c, i) => (
        <button key={c} type="button" className="avp-dot" style={{ background: c }} aria-pressed={cur === i} aria-label={`${label} ${i + 1}`} onClick={() => set({ [key]: i })} />
      ))}
    </div>
  );

  return (
    <div className="avp">
      <style>{CSS}</style>
      <div className="avp-bg" onClick={onClose} aria-hidden="true" />
      <div className="avp-box" role="dialog" aria-modal="true" aria-label={`Pilih avatar ${name}`}>
        <div className="avp-head">
          <span className="avp-prev" style={cssObj(avatarCssOf(s))} aria-hidden="true" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="avp-sub">Pilih avatar</div>
            <h2 className="avp-title">{name}</h2>
          </div>
          <button type="button" className="avp-btn" onClick={() => setS({ style: rand(STYLES.length), skin: rand(SKIN.length), hair: rand(5), bg: rand(BG.length), shirt: rand(SHIRT.length), glasses: rand(2) as 0 | 1 })}>
            Acak
          </button>
        </div>

        {(['Cowok', 'Cewek'] as const).map((g) => (
          <div key={g}>
            <p className="avp-lbl">{g}</p>
            <div className="avp-grid">
              {STYLES.map((st, i) =>
                st.group === g ? (
                  <button key={st.label} type="button" className="avp-tile" title={st.label} aria-label={`${g} ${st.label}`} aria-pressed={s.style === i} onClick={() => set({ style: i, hair: Math.min(s.hair, hairPalette(i).length - 1) })} style={cssObj(avatarCssOf({ ...s, style: i }))} />
                ) : null,
              )}
            </div>
          </div>
        ))}

        <div>
          <p className="avp-lbl">Kulit</p>
          {swatches(SKIN, s.skin, 'skin', 'Warna kulit')}
        </div>
        <div>
          <p className="avp-lbl">{STYLES[s.style].label === 'Hijab' ? 'Warna hijab' : 'Warna rambut'}</p>
          {swatches(hairs, s.hair, 'hair', 'Warna rambut')}
        </div>
        <div>
          <p className="avp-lbl">Baju</p>
          {swatches(SHIRT, s.shirt, 'shirt', 'Warna baju')}
        </div>
        <div>
          <p className="avp-lbl">Latar</p>
          {swatches(BG, s.bg, 'bg', 'Warna latar')}
        </div>
        <div className="avp-row">
          <button type="button" className="avp-btn" aria-pressed={s.glasses === 1} onClick={() => set({ glasses: s.glasses ? 0 : 1 })}>
            Kacamata
          </button>
        </div>

        <div className="avp-foot">
          <button type="button" className="avp-btn" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="avp-btn pri" onClick={save} disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan avatar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "background:url(...) center/cover no-repeat" → objek style React (satu deklarasi, nilai boleh mengandung ':'). */
function cssObj(decl: string): React.CSSProperties {
  const i = decl.indexOf(':');
  return { [decl.slice(0, i)]: decl.slice(i + 1) } as React.CSSProperties;
}
