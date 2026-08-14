'use client';

import { AnimatePresence, motion } from 'motion/react';
import { TRANSITION_SLOW } from '@/lib/motion';

/** Crossfades tab content on switch (Laporan's Bulanan/All Time, Analisis' 30 Hari/All Time) —
 * old and new content animate simultaneously (no `mode="wait"`) so the switch stays fast; the
 * page's own mount animation already covers first paint, so this only plays on actual switches. */
export function AnimatedTabContent({ tabKey, children }: { tabKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={TRANSITION_SLOW}
        className="flex flex-col gap-3"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
