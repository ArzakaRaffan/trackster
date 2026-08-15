/**
 * Local date key (YYYY-MM-DD) based on the user's local timezone.
 * Avoids `new Date().toISOString().slice(0, 10)` which can shift by one day
 * in timezones where local midnight is not UTC midnight.
 */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
