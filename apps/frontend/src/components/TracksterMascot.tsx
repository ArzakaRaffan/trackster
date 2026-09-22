'use client';

import { motion, useReducedMotion } from 'motion/react';
import { EASE_EXPRESSIVE, EASE_STANDARD } from '@/lib/motion';

export type MascotMood = 'idle' | 'tip' | 'alert' | 'thinking' | 'happy';
export type MascotSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<MascotSize, number> = { sm: 28, md: 44, lg: 64 };

interface TracksterMascotProps {
  mood?: MascotMood;
  size?: MascotSize;
  className?: string;
  /** Soft glow behind the blob (widget FAB). */
  glow?: boolean;
}

/**
 * Animated blob mascot — Trackster's on-screen AI buddy.
 * Pure SVG + Motion; no emoji, no Lucide icon stand-in.
 */
export function TracksterMascot({
  mood = 'idle',
  size = 'md',
  className = '',
  glow = false,
}: TracksterMascotProps) {
  const reduceMotion = useReducedMotion();
  const px = SIZE_PX[size];
  const isAlert = mood === 'alert';
  const isThinking = mood === 'thinking';
  const isHappy = mood === 'happy' || mood === 'tip';

  const bodyColor = isAlert ? '#ffa42b' : '#1ed760';
  const bodyDark = isAlert ? '#e08916' : '#1aa34a';
  const eyeY = isHappy ? 19 : isThinking ? 17 : 18;
  const mouthPath = isHappy
    ? 'M16 26c2.2 2.4 5.8 2.4 8 0'
    : isAlert
      ? 'M17 27c1.5-1.6 4.5-1.6 6 0'
      : isThinking
        ? 'M18 27h6'
        : 'M17.5 26.5c1.8 1.4 4.2 1.4 6 0';

  const bob = reduceMotion
    ? undefined
    : {
        y: [0, -3, 0],
        rotate: isAlert ? [0, -4, 4, -2, 0] : [0, 2.5, -2, 0],
        transition: {
          duration: isAlert ? 0.9 : 3.2,
          repeat: Infinity,
          ease: EASE_EXPRESSIVE,
        },
      };

  const blink = reduceMotion
    ? 1
    : {
        scaleY: [1, 1, 0.12, 1, 1],
        transition: {
          duration: 4.2,
          repeat: Infinity,
          times: [0, 0.82, 0.86, 0.9, 1],
          ease: EASE_STANDARD,
        },
      };

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {glow && (
        <span
          className="absolute inset-[-18%] rounded-full opacity-40 blur-md"
          style={{ background: bodyColor }}
        />
      )}
      <motion.span
        className="relative block"
        style={{ width: px, height: px }}
        animate={bob}
      >
        <svg viewBox="0 0 40 40" width={px} height={px} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="tmBlob" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#6bff9a" />
              <stop offset="55%" stopColor={bodyColor} />
              <stop offset="100%" stopColor={bodyDark} />
            </radialGradient>
            <filter id="tmSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Soft organic blob body */}
          <motion.path
            filter="url(#tmSoft)"
            fill="url(#tmBlob)"
            d="M20 4.5c6.2 0 11.8 3.4 13.8 9.1 1.6 4.5.4 9.2-2.8 12.6-3.4 3.6-8.4 5.3-13 4.6-4.8-.7-9-3.8-10.6-8.5C5.6 17 7.2 11.2 11.4 7.8 14 5.6 17 4.5 20 4.5Z"
            animate={
              reduceMotion
                ? undefined
                : {
                    d: [
                      'M20 4.5c6.2 0 11.8 3.4 13.8 9.1 1.6 4.5.4 9.2-2.8 12.6-3.4 3.6-8.4 5.3-13 4.6-4.8-.7-9-3.8-10.6-8.5C5.6 17 7.2 11.2 11.4 7.8 14 5.6 17 4.5 20 4.5Z',
                      'M20 3.8c6.6.4 12.2 3.8 13.4 9.6 1 4.8-.6 9.4-4 12.4-3.2 2.9-7.8 4.4-12.2 3.9-5-.6-9.6-3.2-11.4-8-1.8-4.9.4-10.2 4.8-13.2C13.4 5.6 16.6 3.5 20 3.8Z',
                      'M20 4.5c6.2 0 11.8 3.4 13.8 9.1 1.6 4.5.4 9.2-2.8 12.6-3.4 3.6-8.4 5.3-13 4.6-4.8-.7-9-3.8-10.6-8.5C5.6 17 7.2 11.2 11.4 7.8 14 5.6 17 4.5 20 4.5Z',
                    ],
                    transition: { duration: 3.6, repeat: Infinity, ease: EASE_EXPRESSIVE },
                  }
            }
          />

          {/* Specular highlight */}
          <ellipse cx="14.5" cy="12" rx="4.2" ry="2.6" fill="#fff" opacity="0.28" transform="rotate(-28 14.5 12)" />

          {/* Eyes */}
          <motion.g style={{ originX: '20px', originY: `${eyeY}px` }} animate={{ scaleY: blink as any }}>
            <ellipse cx="14.5" cy={eyeY} rx="2.15" ry="2.5" fill="#121212" />
            <ellipse cx="25.5" cy={eyeY} rx="2.15" ry="2.5" fill="#121212" />
            <circle cx="15.2" cy={eyeY - 0.7} r="0.7" fill="#fff" opacity="0.85" />
            <circle cx="26.2" cy={eyeY - 0.7} r="0.7" fill="#fff" opacity="0.85" />
          </motion.g>

          {/* Mouth */}
          <path d={mouthPath} stroke="#121212" strokeWidth="1.6" strokeLinecap="round" fill="none" />

          {/* Thinking dots */}
          {isThinking && !reduceMotion && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: EASE_STANDARD }}
            >
              <circle cx="31.5" cy="8" r="1.1" fill="#fff" />
              <circle cx="34.2" cy="5.8" r="0.85" fill="#fff" />
              <circle cx="36.2" cy="3.8" r="0.65" fill="#fff" />
            </motion.g>
          )}
        </svg>
      </motion.span>
    </span>
  );
}