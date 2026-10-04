/** Sisa budget yang terbawa ke "hari ini". `days` = hari-hari SEBELUM hari ini di minggu yang sama
 * (Senin dulu, hari ini tidak ikut), berurutan. Sisa dibawa berantai (sisa Senin yang tidak dipakai Selasa
 * tetap ikut ke Rabu), overspend tidak mengurangi hari berikutnya — cuma menghabiskan sisa yang ada.
 * Senin selalu 0: minggu baru = alokasi baru (cron Minggu malam). */
export function calcRollover(days: { budget: number; spent: number }[]): number {
  let carry = 0;
  for (const d of days) carry = Math.max(0, carry + d.budget - d.spent);
  return carry;
}
