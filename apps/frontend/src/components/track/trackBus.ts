// trackBus.ts — event bus kecil untuk reaksi mascot Track (E09-S2).
// Window CustomEvent, tanpa context global, tanpa polling baru.

export type TrackEventName =
  | 'transaction:new'
  | 'income:in'
  | 'budget:near'
  | 'budget:over'
  | 'goal:reached'
  | 'sync:start'
  | 'sync:end'
  | 'ai:thinking'
  | 'ai:reply';

const PREFIX = 'track:';

export function emitTrack(name: TrackEventName, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(`${PREFIX}${name}`, { detail }));
}

export function subscribeTrack(
  name: TrackEventName,
  handler: (detail: unknown) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(`${PREFIX}${name}`, listener);
  return () => window.removeEventListener(`${PREFIX}${name}`, listener);
}

/** Subscribe ke banyak event sekaligus. */
export function subscribeTrackAll(
  mapping: Partial<Record<TrackEventName, (detail: unknown) => void>>,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const unsubs = (Object.keys(mapping) as TrackEventName[]).map((name) =>
    subscribeTrack(name, mapping[name]!),
  );
  return () => unsubs.forEach((fn) => fn());
}
