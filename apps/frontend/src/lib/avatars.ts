/**
 * Avatar orang (kartun lucu) untuk Split Bill, patungan, dst.
 * Spec avatar = string "gaya.kulit.rambut.latar.baju.kacamata" (mis. "4.1.0.2.5.1"), disimpan di kolom `avatar` peserta.
 * Tanpa spec yang valid → diturunkan dari nama (orang yang sama selalu dapat muka yang sama).
 */

export const SKIN = ['#FFD7B5', '#F2B88C', '#D99B6C', '#B97A4B', '#8A5A36'];
export const HAIR = ['#2B1B12', '#5A3A22', '#A5622B', '#E0B14A', '#6B4FBB'];
export const HIJAB = ['#E4A0B7', '#6FA8DC', '#8E6BBF', '#4CAF7A', '#3A3631']; // gaya hijab pakai palet ini, bukan HAIR
export const BG = ['#FFE3A3', '#BFE8D2', '#BBDDF7', '#F7C6D9', '#D9CCF5', '#FFCDB2'];
export const SHIRT = ['#E4572E', '#2E86AB', '#4CAF7A', '#F2A93B', '#8E6BBF', '#D1477A'];

export type AvatarSpec = { style: number; skin: number; hair: number; bg: number; shirt: number; glasses: 0 | 1 };

// Gaya: back = digambar di belakang kepala, front = di atas kepala. c = warna rambut (atau hijab).
type Style = { label: string; group: 'Cowok' | 'Cewek'; back?: (c: string) => string; front?: (c: string) => string };
const P = (d: string, c: string, extra = '') => `<path d="${d}" fill="${c}"${extra}/>`;
export const STYLES: Style[] = [
  { label: 'Pendek', group: 'Cowok', front: (c) => P('M17 28c0-11 7-16 15-16s15 5 15 16c-4-6-9-8-15-8s-11 2-15 8z', c) },
  { label: 'Spiky', group: 'Cowok', front: (c) => P('M17 29l2-13 6 6 4-10 5 9 6-8 3 16c-4-5-9-7-15-7s-9 2-11 7z', c) },
  { label: 'Keriting', group: 'Cowok', back: (c) => `<circle cx="32" cy="25" r="18" fill="${c}"/>`, front: (c) => P('M19 30c2-8 7-10 13-10s11 2 13 10c-4-4-8-5-13-5s-9 1-13 5z', c) },
  { label: 'Gondrong', group: 'Cowok', front: (c) => P('M16 30c-1-12 6-18 16-18s17 6 16 18c-2-4-4-6-6-7-6 2-14 2-20 0-2 1-4 3-6 7z', c) + `<rect x="14" y="26" width="7" height="12" rx="3" fill="${c}"/>` },
  { label: 'Botak jenggot', group: 'Cowok', front: (c) => P('M19 38c1 9 6 13 13 13s12-4 13-13c-2 3-5 4-8 4H27c-3 0-6-1-8-4z', c) },
  { label: 'Topi', group: 'Cowok', front: (c) => P('M17 29c0-10 6-15 15-15s15 5 15 15z', c) + P('M30 27h22c0 3-4 4-10 4H30z', c) + P('M30 27h22c0 3-4 4-10 4H30z', '#000', ' opacity=".22"') },
  { label: 'Panjang', group: 'Cewek', back: (c) => P('M14 54V30c0-12 7-18 18-18s18 6 18 18v24z', c), front: (c) => P('M18 29c3-6 8-9 14-9s11 3 14 9c-5-3-9-4-14-4s-9 1-14 4z', c) },
  { label: 'Bob', group: 'Cewek', back: (c) => P('M15 40V28c0-11 7-16 17-16s17 5 17 16v12c-3 2-6 2-8 0V26H23v14c-2 2-5 2-8 0z', c), front: (c) => P('M18 28c4-5 9-7 14-7s10 2 14 7c-5-2-9-3-14-3s-9 1-14 3z', c) },
  { label: 'Cepol', group: 'Cewek', back: (c) => `<circle cx="32" cy="10" r="6" fill="${c}"/>`, front: (c) => P('M17 29c0-11 7-16 15-16s15 5 15 16c-4-5-9-7-15-7s-11 2-15 7z', c) },
  { label: 'Kuncir', group: 'Cewek', back: (c) => `<circle cx="50" cy="30" r="6" fill="${c}"/>`, front: (c) => P('M17 29c0-11 7-16 15-16s15 5 15 16c-4-5-9-7-15-7s-11 2-15 7z', c) },
  { label: 'Kepang dua', group: 'Cewek', back: (c) => `<circle cx="15" cy="38" r="6" fill="${c}"/><circle cx="49" cy="38" r="6" fill="${c}"/>`, front: (c) => P('M17 29c0-11 7-16 15-16s15 5 15 16c-4-5-9-7-15-7s-11 2-15 7z', c) },
  { label: 'Hijab', group: 'Cewek', back: (c) => P('M12 56V32c0-14 8-22 20-22s20 8 20 22v24z', c), front: (c) => P('M18 31c2-9 7-12 14-12s12 3 14 12c-3-4-8-6-14-6s-11 2-14 6z', c) },
];
export const HIJAB_STYLE = STYLES.findIndex((s) => s.label === 'Hijab');
export const hairPalette = (style: number) => (style === HIJAB_STYLE ? HIJAB : HAIR);

/** Samakan dengan validasi di backend (`avatar` peserta split bill). */
const SPEC_RE = /^([0-9]|1[01])\.([0-4])\.([0-4])\.([0-5])\.([0-5])\.([01])$/;

export const encodeSpec = (s: AvatarSpec) => `${s.style}.${s.skin}.${s.hair}.${s.bg}.${s.shirt}.${s.glasses}`;

function parseSpec(v?: string | null): AvatarSpec | null {
  const m = v ? SPEC_RE.exec(v) : null;
  return m ? { style: +m[1], skin: +m[2], hair: +m[3], bg: +m[4], shirt: +m[5], glasses: +m[6] as 0 | 1 } : null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Spec dari pilihan user kalau valid, kalau tidak dari nama. */
export function specFor(name: string, avatar?: string | null): AvatarSpec {
  const saved = parseSpec(avatar);
  if (saved) return saved;
  const h = hash(name.trim().toLowerCase() || '?');
  const f = (shift: number, n: number) => ((h >>> shift) & 0xff) % n;
  return { style: f(0, STYLES.length), skin: f(8, SKIN.length), hair: f(16, 5), bg: f(4, BG.length), shirt: f(12, SHIRT.length), glasses: ((h >>> 24) & 1) as 0 | 1 };
}

export function avatarSvg(s: AvatarSpec): string {
  const st = STYLES[s.style] ?? STYLES[0];
  const hairC = hairPalette(s.style)[s.hair] ?? HAIR[0];
  const eye = '#2B1B12';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${BG[s.bg] ?? BG[0]}"/>` +
    `${st.back?.(hairC) ?? ''}` +
    `<path d="M10 64c1-12 9-17 22-17s21 5 22 17z" fill="${SHIRT[s.shirt] ?? SHIRT[0]}"/>` +
    `<circle cx="32" cy="32" r="14" fill="${SKIN[s.skin] ?? SKIN[0]}"/>` +
    `${st.front?.(hairC) ?? ''}` +
    `<circle cx="26" cy="33" r="2" fill="${eye}"/><circle cx="38" cy="33" r="2" fill="${eye}"/>` +
    `<circle cx="22.5" cy="38" r="2.4" fill="#FF8FA3" opacity=".55"/><circle cx="41.5" cy="38" r="2.4" fill="#FF8FA3" opacity=".55"/>` +
    `<path d="M28 39c2 3 6 3 8 0" fill="none" stroke="${eye}" stroke-width="1.8" stroke-linecap="round"/>` +
    (s.glasses ? `<g fill="none" stroke="${eye}" stroke-width="1.5"><circle cx="26" cy="33" r="4.5"/><circle cx="38" cy="33" r="4.5"/><path d="M30.5 33h3"/></g>` : '') +
    `</svg>`
  );
}

/** Inline-CSS buat tile avatar (tambahkan di style; ukuran & bentuk diatur pemanggil). Aman dipakai di string `css()` — tanpa ';' mentah. */
export const avatarCssOf = (s: AvatarSpec): string => `background:url("data:image/svg+xml,${encodeURIComponent(avatarSvg(s))}") center/cover no-repeat`;
export const avatarCss = (name: string, avatar?: string | null): string => avatarCssOf(specFor(name, avatar));
