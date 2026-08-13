export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/** Compact rupiah for dense tiles/charts: Rp1,2jt / Rp150rb. */
export function formatRupiahCompact(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const trim = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (abs >= 1_000_000) return `Rp${trim(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `Rp${trim(abs / 1_000)}rb`;
  return `Rp${abs.toLocaleString('id-ID')}`;
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
