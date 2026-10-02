'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { TrackMascotElement, TrackMood, TrackReact } from './track-mascot.d';

export type { TrackMascotElement, TrackMood, TrackReact } from './track-mascot.d';

/** Imperative handle — lets callers trigger a transient reaction (el.react). */
export interface TrackHandle {
  react(name: TrackReact): void;
}

interface TrackProps {
  size?: number;
  mood?: TrackMood;
  className?: string;
  /** Mulut membuka-menutup saat bicara (chat "mengetik"). */
  speaking?: boolean;
  /** Mata & badan mengikuti kursor. */
  pointer?: boolean;
  /** Pose statis (ikon kecil / daftar panjang). */
  still?: boolean;
  /** Alias lama `interactive` → aktifkan look-at pointer. */
  interactive?: boolean;
  /** Tutup mata (login password 🙈) — override mood ke 'hide'. */
  hideEyes?: boolean;
}

/**
 * React wrapper for the `<track-mascot>` web component ("Track Struk").
 * Single source of truth for the mascot shape & motion lives in
 * `public/track-mascot.js`; this component only forwards attributes + the
 * `react()` imperative method.
 */
export const Track = forwardRef<TrackHandle, TrackProps>(function Track(
  {
    size = 48,
    mood = 'idle',
    className = '',
    speaking = false,
    pointer = false,
    still = false,
    interactive = false,
    hideEyes = false,
  },
  ref,
) {
  const elRef = useRef<TrackMascotElement | null>(null);

  useImperativeHandle(ref, () => ({
    react: (name: TrackReact) => elRef.current?.react(name),
  }), []);

  const effectiveMood: TrackMood = hideEyes ? 'hide' : mood;
  const attr = (v: boolean): 'true' | undefined => (v ? 'true' : undefined);

  return (
    <track-mascot
      ref={(node) => {
        elRef.current = node as TrackMascotElement | null;
      }}
      size={size}
      mood={effectiveMood}
      speaking={attr(speaking)}
      pointer={attr(pointer || interactive)}
      still={attr(still)}
      className={className}
      aria-hidden="true"
    />
  );
});
