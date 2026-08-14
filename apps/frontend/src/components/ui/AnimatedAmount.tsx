'use client';

import { useEffect, useState } from 'react';
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react';
import { TRANSITION_SLOW } from '@/lib/motion';

const rp = (n: number) => 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');

/** Tweens the displayed rupiah figure whenever `value` changes, instead of snapping straight to
 * the new number — used for totals that visibly move after a user action (save budget, add/
 * delete income, correct a balance). Respects prefers-reduced-motion via MotionProvider. */
export function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useMotionValueEvent(motionValue, 'change', (latest) => setDisplay(latest));

  useEffect(() => {
    const controls = animate(motionValue, value, TRANSITION_SLOW);
    return () => controls.stop();
  }, [value, motionValue]);

  return <span className={className}>{rp(display)}</span>;
}
