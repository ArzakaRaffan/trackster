// Tanggal WIB (UTC+7). Backend memakai WIB; browser pengguna diasumsikan sama, tapi kita hitung eksplisit.
export const DAYN = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MON_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Date yang field UTC-nya berisi jam dinding WIB. */
export const wib = (ms: number = Date.now()) => new Date(ms + 7 * 3600e3);
export const wibISO = (ms: number = Date.now()) => { const d = wib(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const wibHHMM = (iso: string) => { const d = wib(new Date(iso).getTime()); return `${pad(d.getUTCHours())}.${pad(d.getUTCMinutes())}`; };
export const addDaysISO = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400e3);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
const dowOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

export interface V3Dates {
  todayISO: string;
  todayLabel: string; // 'Rabu, 30 September'
  /** 7 hari berakhir hari ini (indeks 6 = hari ini): [singkat, 'Kamis, 24 Sep', budget] */
  days: [string, string, number][];
  dateIdx: Record<string, number>;
  todayMs: number; // tengah malam hari ini sebagai Date lokal (dipakai daysTo)
}

export function buildDates(manual: number[], now: number = Date.now()): V3Dates {
  const todayISO = wibISO(now);
  const days: V3Dates['days'] = [];
  const dateIdx: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const iso = addDaysISO(todayISO, i - 6);
    const dow = dowOf(iso);
    const [, m, d] = iso.split('-').map(Number);
    days.push([DAY_SHORT[dow], `${DAYN[dow]}, ${d} ${MON_SHORT[m - 1]}`, manual[dow] || 0]);
    dateIdx[iso] = i;
  }
  const [y, m, d] = todayISO.split('-').map(Number);
  return { todayISO, todayLabel: `${DAYN[dowOf(todayISO)]}, ${d} ${MON_LONG[m - 1]}`, days, dateIdx, todayMs: new Date(y, m - 1, d).getTime() };
}
