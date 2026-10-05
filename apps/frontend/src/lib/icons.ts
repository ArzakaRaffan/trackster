import { ICON_CATALOG } from './icon-catalog';

const LABEL = new Map(ICON_CATALOG.map((i) => [i.key, i.label]));
export const iconLabel = (key?: string | null) => (key ? LABEL.get(key) ?? key : '');

/** Inline-CSS buat tile logo (tambahkan di akhir style tile). Lucide = ikon garis, dirender lewat mask supaya
 * ikut warna teks tema; logo brand ditaruh di tile putih supaya logo gelap tetap kebaca di tema gelap. */
export function iconCss(key?: string | null): string {
  if (!key) return '';
  const u = `url(/icons/${key})`;
  // SVG tanpa width/height bawaan: ukuran harus 2 nilai eksplisit/contain, "68% auto" tidak dirender.
  return key.startsWith('decor/lucide_')
    ? `background:currentColor;color:var(--text);-webkit-mask:${u} center/58% 58% no-repeat;mask:${u} center/58% 58% no-repeat`
    : `background:#fff ${u} center/contain no-repeat;box-sizing:border-box;border:3px solid #fff`;
}

/** Logo tetap (tidak bisa diubah user): sumber transaksi & integrasi. Kunci = nama/kode sumber, case-insensitive. */
const BRAND_LOGO: Record<string, string> = {
  BCA: 'indonesia/bca.svg', JAGO: 'indonesia/bank-jago.svg', FLIP: 'indonesia/flip.svg',
  GMAIL: 'apps/Gmail.svg', SHEETS: 'apps/Google_Sheets.svg', WHATSAPP: 'apps/WhatsApp.svg', CALENDAR: 'apps/Google_Calendar.svg', TELEGRAM: 'apps/Telegram.svg',
};
/** CSS tile logo 20px, menimpa gaya penanda bentuk lama (border/rotate). '' kalau tidak dikenal → penanda lama tetap. */
export const brandCss = (name?: string | null): string => {
  const k = BRAND_LOGO[String(name ?? '').toUpperCase()];
  return k ? `width:20px;height:20px;border:0;transform:none;border-radius:5px;${iconCss(k)}` : '';
};

/** Logo otomatis dari nama merchant (alias atau raw), dicek berurutan; logo pilihan user selalu menang.
 * Tambah merchant = satu baris [regex, kunci katalog]. Merchant tanpa SVG (Kopi Kenangan, Fore, Tuku, dst) belum ada. */
const AUTO: [RegExp, string][] = [
  [/alfamidi/, 'indonesia/alfamidi.svg'], [/alfamart|alfa express/, 'indonesia/alfamart.svg'], [/indomaret|idm\b/, 'indonesia/indomaret.svg'],
  [/gopay|go-pay/, 'indonesia/go-pay.svg'], [/gojek|goride|gocar|gofood/, 'branded/Gojek.svg'], [/grab ?pay/, 'indonesia/grab-pay.svg'], [/grab/, 'branded/Grab.svg'],
  [/shopee ?pay/, 'indonesia/shopeepay.svg'], [/shopee/, 'indonesia/shopee.svg'], [/tokopedia|tokped/, 'indonesia/tokopedia.svg'], [/lazada/, 'indonesia/lazada.svg'],
  [/blibli/, 'indonesia/blibli.svg'], [/bukalapak/, 'indonesia/bukalapak.svg'], [/amazon/, 'apps/amazon.svg'],
  [/dana\b/, 'indonesia/dana.svg'], [/ovo/, 'indonesia/ovo-new.svg'], [/link ?aja/, 'indonesia/linkaja.svg'], [/qris/, 'indonesia/qris.svg'],
  [/starbucks/, 'branded/Starbucks.svg'], [/kfc/, 'branded/KFC.svg'], [/mcdonald|mcd\b/, 'branded/McDonalds.svg'], [/burger king/, 'branded/Burger_King.svg'], [/taco bell/, 'branded/Taco_Bell.svg'],
  [/netflix/, 'indonesia/netflix.svg'], [/spotify/, 'indonesia/spotify.svg'], [/youtube/, 'apps/YouTube.svg'], [/disney/, 'indonesia/disney-plus-hotstar.svg'],
  [/vidio/, 'indonesia/vidio.svg'], [/\bviu\b/, 'indonesia/viu.svg'], [/cgv/, 'indonesia/cgv.svg'], [/xxi|cinema 21/, 'indonesia/xxi-21.svg'],
  [/\bpln\b|listrik/, 'indonesia/pln.svg'], [/pdam/, 'indonesia/pdam.svg'], [/bpjs.*(kerja|tk)/, 'indonesia/bpjs-tk.svg'], [/bpjs/, 'indonesia/bpjs-kesehatan.svg'],
  [/telkomsel|simpati/, 'indonesia/telkomsel.svg'], [/indosat|\bim3\b/, 'indonesia/im3.svg'], [/\bxl\b|axiata/, 'indonesia/xl.svg'], [/\baxis\b/, 'indonesia/axis.svg'], [/smartfren/, 'indonesia/smartfren.svg'], [/by\.?u\b/, 'indonesia/byu.svg'],
  [/\bkai\b|kereta api/, 'indonesia/kai.svg'], [/\bjne\b/, 'indonesia/jne.svg'], [/sicepat/, 'indonesia/sicepat.svg'], [/anter ?aja/, 'indonesia/anter-aja.svg'], [/ninja/, 'indonesia/ninja-express.svg'], [/pos indonesia/, 'indonesia/pos-indonesia.svg'],
  [/uniqlo/, 'branded/Uniqlo.svg'], [/zara/, 'branded/Zara.svg'], [/nike/, 'branded/Nike.svg'], [/adidas/, 'branded/Adidas.svg'], [/ikea/, 'branded/IKEA.svg'], [/carrefour/, 'branded/Carrefour.svg'], [/uber/, 'branded/uber.svg'],
  [/openai|chatgpt/, 'apps/chatgpt.svg'], [/claude|anthropic/, 'apps/Claude.svg'], [/notion/, 'apps/Notion.svg'], [/figma/, 'apps/Figma.svg'], [/canva/, 'apps/Canva.svg'], [/steam/, 'apps/Steam.svg'],
  [/playstation|\bpsn\b/, 'apps/PlayStation.svg'], [/xbox/, 'apps/Xbox.svg'], [/nintendo/, 'apps/Nintendo.svg'], [/google play/, 'apps/Google_Play.svg'], [/google/, 'apps/Google.svg'], [/telegram/, 'apps/Telegram.svg'], [/whatsapp/, 'apps/WhatsApp.svg'],
];
export const autoIcon = (name?: string | null): string | null => {
  const n = String(name ?? '').toLowerCase();
  return n ? AUTO.find(([re]) => re.test(n))?.[1] ?? null : null;
};
