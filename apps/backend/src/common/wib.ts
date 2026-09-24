/** Semua boundary hari/minggu/bulan di backend harus lewat helper ini, bukan
 * `setHours`/`getDay()`/`toISOString().slice(0,10)`/`new Date(y,m,d)` langsung —
 * container jalan di UTC, bukan WIB. Lihat docs/context/Gotchas.md. */

export const WIB_OFFSET_MS = 7 * 3600_000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 'YYYY-MM-DD' menurut kalender WIB untuk instant `d`. */
export function wibDateKey(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function wibParts(d: Date): { year: number; month: number; day: number } {
  const [year, month, day] = wibDateKey(d).split('-').map(Number);
  return { year, month, day };
}

/** Instant UTC yang sesuai 00:00 WIB pada tanggal (WIB) tempat `d` berada.
 * Terima juga string 'YYYY-MM-DD' (dianggap tanggal WIB). */
export function startOfWibDay(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Date(`${wibDateKey(date)}T00:00:00+07:00`);
}

export function addWibDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** 0=Minggu .. 6=Sabtu, menurut kalender WIB — kompatibel `DailyBudget.dayOfWeek`. */
export function wibDayOfWeek(d: Date): number {
  return new Date(`${wibDateKey(d)}T00:00:00Z`).getUTCDay();
}

/** Senin 00:00 WIB dari minggu yang memuat `d`. */
export function startOfWibWeek(d: Date): Date {
  const daysSinceMonday = (wibDayOfWeek(d) + 6) % 7;
  return addWibDays(startOfWibDay(d), -daysSinceMonday);
}

/** month: 1-12. */
export function startOfWibMonth(year: number, month: number): Date {
  return new Date(`${year}-${pad2(month)}-01T00:00:00+07:00`);
}

/** end selalu eksklusif. */
export function wibRange(kind: 'day' | 'week' | 'month', anchor: Date): { start: Date; end: Date } {
  if (kind === 'day') {
    const start = startOfWibDay(anchor);
    return { start, end: addWibDays(start, 1) };
  }
  if (kind === 'week') {
    const start = startOfWibWeek(anchor);
    return { start, end: addWibDays(start, 7) };
  }
  const { year, month } = wibParts(anchor);
  const start = startOfWibMonth(year, month);
  const end = month === 12 ? startOfWibMonth(year + 1, 1) : startOfWibMonth(year, month + 1);
  return { start, end };
}

/** Apakah `d` jatuh di hari terakhir bulan (kalender WIB). Dipakai cron laporan bulanan. */
export function isLastWibDayOfMonth(d: Date): boolean {
  const { end } = wibRange('month', d);
  return addWibDays(startOfWibDay(d), 1).getTime() === end.getTime();
}
