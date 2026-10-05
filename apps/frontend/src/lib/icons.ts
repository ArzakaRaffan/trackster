import { ICON_CATALOG } from './icon-catalog';

const LABEL = new Map(ICON_CATALOG.map((i) => [i.key, i.label]));
export const iconLabel = (key?: string | null) => (key ? LABEL.get(key) ?? key : '');

/** Inline-CSS buat tile logo (tambahkan di akhir style tile). Lucide = ikon garis, dirender lewat mask supaya
 * ikut warna teks tema; logo brand ditaruh di tile putih supaya logo gelap tetap kebaca di tema gelap. */
export function iconCss(key?: string | null): string {
  if (!key) return '';
  const u = `url(/icons/${key})`;
  return key.startsWith('decor/lucide_')
    ? `background:currentColor;color:var(--text);-webkit-mask:${u} center/58% no-repeat;mask:${u} center/58% no-repeat`
    : `background:#fff ${u} center/68% no-repeat`;
}

/** Logo tetap (tidak bisa diubah user): sumber transaksi & integrasi. Kunci = nama/kode sumber, case-insensitive. */
const BRAND_LOGO: Record<string, string> = {
  BCA: 'indonesia/bca.svg', JAGO: 'indonesia/bank-jago.svg', FLIP: 'indonesia/flip.svg',
  GMAIL: 'apps/Gmail.svg', CALENDAR: 'apps/Google_Calendar.svg', TELEGRAM: 'apps/Telegram.svg',
};
/** CSS tile logo 20px, menimpa gaya penanda bentuk lama (border/rotate). '' kalau tidak dikenal → penanda lama tetap. */
export const brandCss = (name?: string | null): string => {
  const k = BRAND_LOGO[String(name ?? '').toUpperCase()];
  return k ? `width:20px;height:20px;border:0;transform:none;border-radius:5px;${iconCss(k)}` : '';
};
