/**
 * Shared date formatting helpers that produce keys based on the local timezone,
 * NOT UTC. Several places in the backend previously used `toISOString().slice(0, X)`
 * which shifted dates/times to UTC and could group transactions into the wrong day
 * (especially in Asia/Jakarta UTC+7).
 */

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
