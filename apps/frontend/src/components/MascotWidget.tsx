'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { TRANSITION_BASE } from '@/lib/motion';
import { X } from 'lucide-react';

interface MascotTip {
  kind: 'reminder' | 'fact';
  message: string;
}

const fetcher = (path: string) => api.get<MascotTip>(path);
const REFRESH_MS = 10 * 60 * 1000; // fetch tip baru tiap 10 menit, cukup buat "fresh" tanpa spam AI call

export function MascotWidget() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSWR('/ai/mascot-tip', fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
  });

  const isReminder = data?.kind === 'reminder';

  return (
    <div className="fixed bottom-24 right-4 z-30 lg:bottom-6 lg:right-6">
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={TRANSITION_BASE}
            className="absolute bottom-full right-0 mb-3 w-64 rounded-comfortable bg-surface-overlay p-3.5 shadow-lg"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 text-ink-subtle hover:text-ink"
              aria-label="Tutup"
            >
              <X size={14} />
            </button>
            <p className="pr-4 text-small leading-snug text-ink-secondary">{data.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading}
        aria-label="Trackster mascot"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl shadow-lg transition-transform active:scale-95"
      >
        🐿️
        {isReminder && !open && (
          <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-status-over ring-2 ring-base" />
        )}
      </button>
    </div>
  );
}
