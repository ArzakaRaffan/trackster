'use client';

import { motion, useReducedMotion } from 'motion/react';
import { EASE_EXPRESSIVE, EASE_STANDARD } from '@/lib/motion';

export type MascotMood = 'idle' | 'tip' | 'alert' | 'thinking' | 'happy';
export type MascotSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<MascotSize, number> = { sm: 28, md: 44, lg: 64 };

/** Stable rounded bean — no path morphing (that caused the weird shape glitch). */
const BODY_PATH =
  'M20 5c7.2 0 13 5.4 13 12.2 0 7.2-5.4 12.8-13 12.8S7 24.4 7 17.2C7 10.4 12.8 5 20 5Z';

interface TracksterMascotProps {
  mood?: MascotMood;
  size?: MascotSize;
  className?: string;
  /** Deprecated: README v2 mascot is flat (no gradient/glow). Kept for call-site compat; ignored. */
  glow?: boolean;
}

/**
 * Flat blob mascot — Trackster's on-screen AI buddy.
 * Solid body (#1ED760, alert #FFA42B), no radial gradient or glow, eyes/mouth #121212.
 * Motion limited to float / blink so the silhouette stays cute. Disabled on reduced motion.
 */
export function TracksterMascot({
  mood = 'idle',
  size = 'md',
  className = '',
}: TracksterMascotProps) {
  const reduceMotion = useReducedMotion();
  const px = SIZE_PX[size];
  const isAlert = mood === 'alert';
  const isThinking = mood === 'thinking';
  const isHappy = mood === 'happy' || mood === 'tip';

  const bodyColor = isAlert ? '#ffa42b' : '#1ed760';
  const eyeY = isHappy ? 18.5 : isThinking ? 17 : 18;
  const mouthPath = isHappy
    ? 'M15.5 25.5c2.4 2.6 6.6 2.6 9 0'
    : isAlert
      ? 'M16.5 26.5c1.6-1.5 5.4-1.5 7 0'
      : isThinking
        ? 'M17 26.5h6'
        : 'M16.5 25.8c2 1.5 5 1.5 7 0';

  const floatAnim = reduceMotion
    ? undefined
    : {
        y: [0, -2.5, 0],
        rotate: isAlert ? [0, -3, 3, 0] : [0, 1.5, -1.2, 0],
        scale: [1, 1.035, 1],
        transition: {
          duration: isAlert ? 1.1 : 3.6,
          repeat: Infinity,
          ease: EASE_EXPRESSIVE,
        },
      };

  const blinkAnim = reduceMotion
    ? undefined
    : {
        scaleY: [1, 1, 0.08, 1, 1],
        transition: {
          duration: 4.5,
          repeat: Infinity,
          times: [0, 0.84, 0.88, 0.92, 1],
          ease: EASE_STANDARD,
        },
      };

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      <motion.span
        className="relative block"
        style={{ width: px, height: px, transformOrigin: '50% 70%' }}
        animate={floatAnim}
      >
        <svg viewBox="0 0 40 40" width={px} height={px} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill={bodyColor} d={BODY_PATH} />

          <motion.g style={{ originX: '20px', originY: `${eyeY}px` }} animate={blinkAnim}>
            <ellipse cx="14.5" cy={eyeY} rx="2.1" ry="2.45" fill="#121212" />
            <ellipse cx="25.5" cy={eyeY} rx="2.1" ry="2.45" fill="#121212" />
            <circle cx="15.15" cy={eyeY - 0.65} r="0.65" fill="#fff" opacity="0.9" />
            <circle cx="26.15" cy={eyeY - 0.65} r="0.65" fill="#fff" opacity="0.9" />
          </motion.g>

          <path d={mouthPath} stroke="#121212" strokeWidth="1.55" strokeLinecap="round" fill="none" />

          {isThinking && !reduceMotion && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: EASE_STANDARD }}
            >
              <circle cx="31.5" cy="8.5" r="1.05" fill="#fff" />
              <circle cx="34" cy="6.2" r="0.8" fill="#fff" />
              <circle cx="36" cy="4.2" r="0.6" fill="#fff" />
            </motion.g>
          )}
        </svg>
      </motion.span>
    </span>
  );
}
