/** Avatar orang (kartun lucu) untuk Split Bill, patungan, dst. Deterministik dari nama: orang yang sama selalu dapat muka yang sama, tanpa kolom DB. */

const SKIN = ['#FFD7B5', '#F2B88C', '#D99B6C', '#B97A4B', '#8A5A36'];
const HAIR = ['#2B1B12', '#5A3A22', '#A5622B', '#E0B14A', '#6B4FBB'];
const BG = ['#FFE3A3', '#BFE8D2', '#BBDDF7', '#F7C6D9', '#D9CCF5', '#FFCDB2'];
const SHIRT = ['#E4572E', '#2E86AB', '#4CAF7A', '#F2A93B', '#8E6BBF', '#D1477A'];

// Gaya rambut: 4 cowok, 4 cewek (satu berhijab). Digambar di belakang (back) dan di depan kepala (front).
type Hair = { back?: (c: string) => string; front?: (c: string) => string };
const STYLES: Hair[] = [
  { front: (c) => `<path d="M17 28c0-11 7-16 15-16s15 5 15 16c-4-6-9-8-15-8s-11 2-15 8z" fill="${c}"/>` }, // pendek
  { front: (c) => `<path d="M17 29l2-13 6 6 4-10 5 9 6-8 3 16c-4-5-9-7-15-7s-9 2-11 7z" fill="${c}"/>` }, // spiky
  { back: (c) => `<circle cx="32" cy="25" r="18" fill="${c}"/>`, front: (c) => `<path d="M19 30c2-8 7-10 13-10s11 2 13 10c-4-4-8-5-13-5s-9 1-13 5z" fill="${c}"/>` }, // keriting
  { front: (c) => `<path d="M16 30c-1-12 6-18 16-18s17 6 16 18c-2-4-4-6-6-7-6 2-14 2-20 0-2 1-4 3-6 7z" fill="${c}"/><rect x="14" y="26" width="7" height="12" rx="3" fill="${c}"/>` }, // gondrong ala boyband
  { back: (c) => `<path d="M14 54V30c0-12 7-18 18-18s18 6 18 18v24z" fill="${c}"/>`, front: (c) => `<path d="M18 29c3-6 8-9 14-9s11 3 14 9c-5-3-9-4-14-4s-9 1-14 4z" fill="${c}"/>` }, // panjang
  { back: (c) => `<path d="M15 40V28c0-11 7-16 17-16s17 5 17 16v12c-3 2-6 2-8 0V26H23v14c-2 2-5 2-8 0z" fill="${c}"/>` , front: (c) => `<path d="M18 28c4-5 9-7 14-7s10 2 14 7c-5-2-9-3-14-3s-9 1-14 3z" fill="${c}"/>` }, // bob
  { back: (c) => `<circle cx="32" cy="10" r="6" fill="${c}"/>`, front: (c) => `<path d="M17 29c0-11 7-16 15-16s15 5 15 16c-4-5-9-7-15-7s-11 2-15 7z" fill="${c}"/>` }, // cepol
  { back: (c) => `<path d="M12 56V32c0-14 8-22 20-22s20 8 20 22v24z" fill="${c}"/>`, front: (c) => `<path d="M18 31c2-9 7-12 14-12s12 3 14 12c-3-4-8-6-14-6s-11 2-14 6z" fill="${c}"/>` }, // hijab (c = warna hijab)
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function avatarSvg(name: string): string {
  const h = hash(name.trim().toLowerCase() || '?');
  const pick = <T,>(a: T[], shift: number) => a[((h >>> shift) & 0xff) % a.length];
  const skin = pick(SKIN, 0), bg = pick(BG, 4), shirt = pick(SHIRT, 8);
  const styleIdx = ((h >>> 12) & 0xff) % STYLES.length, st = STYLES[styleIdx];
  const hairC = styleIdx === 7 ? pick(SHIRT, 16) : pick(HAIR, 16); // hijab ikut palet baju
  const glasses = (h >>> 20) & 1;
  const eye = '#2B1B12';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>` +
    `${st.back?.(hairC) ?? ''}` +
    `<path d="M10 64c1-12 9-17 22-17s21 5 22 17z" fill="${shirt}"/>` +
    `<circle cx="32" cy="32" r="14" fill="${skin}"/>` +
    `${st.front?.(hairC) ?? ''}` +
    `<circle cx="26" cy="33" r="2" fill="${eye}"/><circle cx="38" cy="33" r="2" fill="${eye}"/>` +
    `<circle cx="22.5" cy="38" r="2.4" fill="#FF8FA3" opacity=".55"/><circle cx="41.5" cy="38" r="2.4" fill="#FF8FA3" opacity=".55"/>` +
    `<path d="M28 39c2 3 6 3 8 0" fill="none" stroke="${eye}" stroke-width="1.8" stroke-linecap="round"/>` +
    (glasses ? `<g fill="none" stroke="${eye}" stroke-width="1.5"><circle cx="26" cy="33" r="4.5"/><circle cx="38" cy="33" r="4.5"/><path d="M30.5 33h3"/></g>` : '') +
    `</svg>`
  );
}

/** Inline-CSS buat tile avatar bulat (tambahkan di akhir style; ukuran & bentuk diatur pemanggil). */
export const avatarCss = (name: string): string =>
  `background:url("data:image/svg+xml,${encodeURIComponent(avatarSvg(name))}") center/cover no-repeat`;
