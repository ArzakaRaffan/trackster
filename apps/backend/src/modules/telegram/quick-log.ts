import { Source } from '@prisma/client';

// Catat cepat lewat Telegram tanpa AI: "kopi 25rb", "parkir 5000 jago", "/catat makan siang 35k", "kopi 25rb kemarin",
// pemasukan diawali "+": "+gaji 5jt jago".
// Pesan yang tidak jelas formatnya tetap diteruskan ke chat AI — parser ini sengaja konservatif.

export type QuickLog = { kind: 'expense' | 'income'; description: string; amount: number; source: Source | null; daysAgo: 0 | 1 };

const UNIT: Record<string, number> = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6 };
// Kalimat tanya / perintah laporan → bukan catatan belanja, biarkan AI yang menjawab.
const QUESTION = /\?|\b(berapa|apa|apakah|kenapa|mengapa|gimana|bagaimana|kapan|mana|siapa|total|sisa|budget|laporan|pengeluaran|pemasukan|saldo|tahun|bulan|minggu|tanggal|tgl|jam)\b/i;
const SOURCES = Object.values(Source) as string[];

/** "25rb" / "25.000" / "1,5jt" / "35k" → rupiah; null kalau bukan nominal. */
export function parseAmount(token: string, unitToken?: string): { value: number; explicit: boolean } | null {
  const m = /^(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta)?$/i.exec(token);
  if (!m) return null;
  const unit = (m[2] || unitToken || '').toLowerCase();
  const raw = m[1];
  let value: number;
  if (unit) {
    // Satuan: koma/titik = desimal ("1,5jt", "2.5k").
    value = Number(raw.replace(',', '.')) * UNIT[unit];
  } else {
    // Tanpa satuan: titik/koma = pemisah ribuan ("25.000"), selain itu angka utuh.
    if (/[.,]\d{1,2}$/.test(raw)) return null; // "12,5" tanpa satuan → ambigu
    value = Number(raw.replace(/[.,]/g, ''));
  }
  if (!Number.isFinite(value)) return null;
  return { value: Math.round(value), explicit: !!unit || /[.,]/.test(raw) };
}

export function parseQuickLog(text: string): QuickLog | null {
  let t = text.trim().replace(/\s+/g, ' ');
  const forced = /^\/catat(@\w+)?\b/i.test(t);
  if (forced) t = t.replace(/^\/catat(@\w+)?\s*/i, '');
  if (!t || t.startsWith('/') || t.length > 80) return null;
  if (!forced && QUESTION.test(t)) return null;
  const kind = t.startsWith('+') ? 'income' : 'expense';
  if (kind === 'income') t = t.slice(1).trim();

  let words = t.split(' ');
  // "kemarin" di awal/akhir → dicatat untuk kemarin.
  let daysAgo: 0 | 1 = 0;
  const yIdx = [words.length - 1, 0].find((i) => words[i]?.toLowerCase() === 'kemarin');
  if (yIdx !== undefined && words.length > 2) {
    daysAgo = 1;
    words = words.filter((_, i) => i !== yIdx);
  }
  // Bank opsional di awal/akhir: "kopi 25rb jago", "bca bensin 50rb".
  let source: Source | null = null;
  const srcIdx = [words.length - 1, 0].find((i) => SOURCES.includes(words[i]?.toUpperCase()));
  if (srcIdx !== undefined && words.length > 2) {
    source = words[srcIdx].toUpperCase() as Source;
    words = words.filter((_, i) => i !== srcIdx);
  }

  // Nominal di akhir ("kopi 25rb", "kopi 25 rb") atau di awal ("25rb kopi").
  const tryAt = (amountIdx: number, unitIdx: number | null) => {
    const unitTok = unitIdx === null ? undefined : words[unitIdx];
    if (unitTok !== undefined && !UNIT[unitTok.toLowerCase()]) return null;
    const a = parseAmount(words[amountIdx], unitTok);
    if (!a) return null;
    const used = new Set([amountIdx, ...(unitIdx === null ? [] : [unitIdx])]);
    const desc = words.filter((_, i) => !used.has(i)).join(' ');
    return { a, desc };
  };
  const n = words.length;
  const hit = (n >= 3 ? tryAt(n - 2, n - 1) : null) ?? tryAt(n - 1, null) ?? (n >= 3 ? tryAt(0, 1) : null) ?? tryAt(0, null);
  if (!hit) return null;
  const { a, desc } = hit;
  if (!/[a-z]/i.test(desc) || desc.split(' ').length > 6) return null;
  // Tanpa satuan & tanpa pemisah ribuan: hanya terima ≥ 1.000 dan bukan bentuk tahun ("laptop 2025").
  if (!forced && !a.explicit && (a.value < 1000 || /^(19|20)\d\d$/.test(String(a.value)))) return null;
  if (a.value < 100 || a.value > 100_000_000) return null;
  return { kind, description: desc.charAt(0).toUpperCase() + desc.slice(1), amount: a.value, source, daysAgo };
}
