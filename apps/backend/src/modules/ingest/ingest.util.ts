const FUTURE_TOLERANCE_MS = 5 * 60_000;
const OLDEST = Date.UTC(2000, 0, 1);

/** Waktu kejadian dari klien: kosong → sekarang; sedikit di masa depan (jam HP melenceng) → dijepit ke sekarang; jauh di masa depan / <2000 / tak valid → null (tolak). */
export function resolveEventTime(input: string | undefined, now = new Date()): Date | null {
  if (!input) return now;
  const t = new Date(input);
  const ms = t.getTime();
  if (Number.isNaN(ms) || ms < OLDEST) return null;
  if (ms > now.getTime() + FUTURE_TOLERANCE_MS) return null;
  return ms > now.getTime() ? now : t;
}
