import { Source, Category } from '@prisma/client';

export interface RawEmail {
  id: string; // Gmail message ID, dipakai untuk deduplication (emailId)
  from: string;
  subject: string;
  body: string; // plain text body
  internalDate: string; // epoch ms string dari Gmail API, fallback kalau parsing tanggal dari body gagal
}

export interface ParseResult {
  amount: number;
  description: string;
  source: Source;
  occurredAt: Date;
  excluded: boolean; // true = internal transfer, jangan disimpan sebagai expense
  excludeReason?: string;
  /**
   * Kalau excluded=true DAN balanceOnly=true, uang beneran keluar dari `source` (transfer ke
   * rekening sendiri) → gmail-sync tetap mendebit saldo (tanpa bikin Transaction), dicatat sebagai
   * jejak di EmailParseLog. Default/undefined = tidak gerak sama sekali (mis. BCA→FLIPTECH, SoF
   * yang belum final — expense/pemasukannya nanti dari email lain).
   */
  balanceOnly?: boolean;
  /**
   * Hint kategori dari parser — dipakai pipeline kategorisasi (E00-S3) sebelum rule/AI.
   * Kalau E00-S3 belum jalan, caller boleh ignore dan pakai AI biasa.
   */
  categoryHint?: Category;
  /** 'INCOME' = dana masuk (Jago "menerima uang", dst) — gmail-sync route ke IncomeService, bukan
   * TransactionService. Default undefined = EXPENSE (perilaku lama, tidak berubah). */
  kind?: 'EXPENSE' | 'INCOME';
}

export interface EmailParser {
  /** Cek apakah email ini cocok ditangani parser ini (biasanya cek sender/from) */
  canHandle(email: RawEmail): boolean;
  /** Parse body email jadi data transaksi. Return null kalau bukan notifikasi transaksi yang relevan (OTP, promo, dll) */
  parse(email: RawEmail): ParseResult | null;
}

/**
 * Konversi HTML ke plain text — fungsi murni, bisa dipakai di check script tanpa NestJS context.
 * Buang <style>, <script>, <head> dulu sebelum strip tag lain supaya CSS/JS noise tidak ikut.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(td|tr|p|div|br|table|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Ambil value untuk sebuah label dari body email yang sudah dipecah per baris.
 * Mendukung dua pola:
 * 1. "Label : Value" atau "Label: Value" dalam satu baris (format teks polos)
 * 2. Label berdiri sendiri di satu baris, value-nya di baris berikutnya (struktur tabel HTML title/content
 *    seperti pada email BCA & Jago asli, yang secara visual di Gmail terlihat sejajar tapi di HTML source-nya terpisah baris)
 *
 * Opsi `exact`: kalau true, label harus cocok persis dengan bagian awal baris (bukan substring).
 * Pakai untuk label pendek seperti "Name", "Amount", "To" yang bisa false-positive di label lain
 * (contoh: "Name" nyangkut di "Company/Product Name" tanpa opsi ini).
 */
export function extractField(body: string, label: string, opts?: { exact?: boolean }): string | null {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const labelLower = label.toLowerCase();
  const exact = opts?.exact ?? false;

  // Strategi 1: cari "Label: Value" dalam satu baris
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    let idx: number;

    if (exact) {
      // Label harus di awal baris (boleh ada spasi/titik dua setelahnya)
      if (!lineLower.startsWith(labelLower)) continue;
      idx = 0;
    } else {
      idx = lineLower.indexOf(labelLower);
      if (idx === -1) continue;
    }

    const afterLabel = line.slice(idx + label.length);
    const colonIdx = afterLabel.indexOf(':');
    if (colonIdx === -1) continue;
    const value = afterLabel.slice(colonIdx + 1).trim();
    if (value) return value;
  }

  // Strategi 2: baris label berdiri sendiri (exact match), value ada di baris berikutnya.
  // Beberapa email (BCA) punya kolom pemisah ":" sendiri di antara label dan value, jadi skip baris
  // yang isinya cuma tanda baca separator (":", "-", dst) sebelum ambil value asli.
  const isSeparatorOnly = (line: string) => /^[:\-–—.]+$/.test(line);

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase() === labelLower) {
      let j = i + 1;
      while (j < lines.length && isSeparatorOnly(lines[j])) {
        j++;
      }
      const value = lines[j];
      if (value) return value;
    }
  }

  return null;
}

/**
 * Parse tanggal format "10 Aug 2026 14:13:15" (BCA) atau "10 August 2026 15:53 WIB" / "10 August 2026, 16:48 WIB" (Jago).
 * Return null kalau gagal parse (caller sebaiknya fallback ke email.internalDate).
 */
export function parseEmailDate(raw: string): Date | null {
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  // buang koma, "WIB", dan rapikan spasi
  const cleaned = raw.replace(/,/g, ' ').replace(/WIB/gi, '').trim().replace(/\s+/g, ' ');
  const match = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const [, day, monthName, year, hour, minute, second] = match;
  const monthIdx = months[monthName.toLowerCase().slice(0, 3)];
  if (monthIdx === undefined) return null;

  // Email menyatakan waktu WIB (UTC+7)
  const date = new Date(
    Date.UTC(
      parseInt(year, 10),
      monthIdx,
      parseInt(day, 10),
      parseInt(hour, 10) - 7,
      parseInt(minute, 10),
      second ? parseInt(second, 10) : 0,
    ),
  );
  return date;
}

/** Parse nominal Rupiah dari string seperti "IDR 3,330.00", "Rp10.000", "Rp 6.392" */
export function parseRupiah(raw: string): number {
  // buang semua kecuali digit dan titik/koma
  let cleaned = raw.replace(/[^0-9.,]/g, '');

  // Format "IDR 3,330.00" -> koma = ribuan, titik = desimal -> buang koma, ambil sebelum titik desimal
  if (/,\d{3}/.test(cleaned) && /\.\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '').split('.')[0];
  } else {
    // Format "Rp10.000" atau "Rp 6.392" -> titik = pemisah ribuan, buang semua titik
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '');
  }
  return parseInt(cleaned, 10) || 0;
}
