'use client';

import { MotionConfig } from 'motion/react';
import { TRANSITION_SLOW } from '@/lib/motion';

// reducedMotion="user" makes every Motion animation in the app respect the OS-level
// prefers-reduced-motion setting automatically (transform/opacity animations get disabled,
// layout/exit animations become instant) — nothing else in the app needs to check for it.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={TRANSITION_SLOW}>
      {children}
    </MotionConfig>
  );
}
