'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import { X } from 'lucide-react';

interface MascotTip {
  kind: 'reminder' | 'fact';
  message: string;
}

const fetcher = (path: string) => api.get<MascotTip>(path);
const REFRESH_MS = 10 * 60 * 1000; // fetch tip baru tiap 10 menit, cukup buat "fresh" tanpa spam AI call
const AUTO_HIDE_MS = 9000; // bubble auto-nutup sendiri kalau nggak disentuh, biar nggak ganggu terus

export function MascotWidget() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastMessageRef = useRef<string | null>(null);
  const { data, isLoading } = useSWR('/ai/mascot-tip', fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
  });

  // Tiap kali tip BERUBAH (termasuk load pertama), buka bubble otomatis sebentar —
  // jangan nunggu diklik, biar kerasa "hidup" bukan cuma tombol statis di pojok.
  useEffect(() => {
    if (!data || data.message === lastMessageRef.current) return;
    lastMessageRef.current = data.message;
    setDismissed(false);
    setOpen(true);
  }, [data]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [open, data?.message]);

  const isReminder = data?.kind === 'reminder';
  const showBadge = isReminder && !open && !dismissed;

  return (
    <div className="fixed bottom-24 right-4 z-30 lg:bottom-6 lg:right-6">
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={TRANSITION_SLOW}
            className="absolute bottom-full right-1 mb-3 w-64 rounded-comfortable bg-surface-overlay p-3.5 shadow-lg after:absolute after:right-5 after:top-full after:h-3 after:w-3 after:-translate-y-1.5 after:rotate-45 after:rounded-[2px] after:bg-surface-overlay"
          >
            <button
              onClick={() => {
                setOpen(false);
                setDismissed(true);
              }}
              className="absolute right-2 top-2 text-ink-subtle hover:text-ink"
              aria-label="Tutup"
            >
              <X size={14} />
            </button>
            <p className="pr-4 text-small leading-snug text-ink-secondary">{data.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading}
        aria-label="Trackster mascot"
        animate={!open ? { y: [0, -5, 0] } : { y: 0 }}
        transition={!open ? { duration: 1.8, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' } : TRANSITION_BASE}
        whileTap={{ scale: 0.92 }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl shadow-[0_4px_18px_rgba(30,215,96,0.45)]"
      >
        🐿️
        {showBadge && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-status-over ring-2 ring-base"
          />
        )}
      </motion.button>
    </div>
  );
}
