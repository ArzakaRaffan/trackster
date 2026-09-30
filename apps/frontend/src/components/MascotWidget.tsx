'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { EASE_ENTER, TRANSITION_BASE } from '@/lib/motion';
import { MessageCircle, X } from 'lucide-react';
import { TracksterMascot, type MascotMood } from '@/components/TracksterMascot';

interface MascotTip {
  kind: 'reminder' | 'fact';
  message: string;
}

const fetcher = (path: string) => api.get<MascotTip>(path);
const REFRESH_MS = 10 * 60 * 1000;
const AUTO_HIDE_MS = 10000;

export function MascotWidget() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastMessageRef = useRef<string | null>(null);
  const { data, isLoading } = useSWR('/ai/mascot-tip', fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
  });

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

  const mood: MascotMood = isLoading
    ? 'thinking'
    : open
      ? isReminder
        ? 'alert'
        : 'tip'
      : showBadge
        ? 'alert'
        : 'idle';

  return (
    <div className="fixed bottom-24 right-4 z-30 lg:bottom-6 lg:right-6">
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.24, ease: EASE_ENTER }}
            className="absolute bottom-full right-0 mb-3 w-[18.5rem] overflow-hidden rounded-panel bg-overlay shadow-overlay"
          >
            <div
              className={`h-1 w-full ${isReminder ? 'bg-warning' : 'bg-brand'}`}
              aria-hidden
            />
            <div className="relative p-4 pt-3.5">
              <button
                onClick={() => {
                  setOpen(false);
                  setDismissed(true);
                }}
                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-text-subtlest transition-colors hover:bg-hover hover:text-text"
                aria-label="Tutup"
              >
                <X size={14} />
              </button>

              <div className="mb-2.5 flex items-center gap-2.5 pr-7">
                <TracksterMascot mood={isReminder ? 'alert' : 'happy'} size="sm" />
                <div className="min-w-0">
                  <p className="text-micro font-bold uppercase tracking-caps text-text-subtle">
                    {isReminder ? 'Pengingat' : 'Tips dari Track'}
                  </p>
                  <p className="truncate text-small font-bold text-text">Trackster AI</p>
                </div>
              </div>

              <p className="text-small leading-relaxed text-text-subtle">{data.message}</p>

              <Link
                href="/app/chat"
                onClick={() => setOpen(false)}
                className="mt-3.5 flex items-center justify-center gap-2 rounded-medium bg-neutral px-3 py-2.5 text-small font-bold text-text transition-colors hover:bg-neutral-hover"
              >
                <MessageCircle size={14} className="text-brand" />
                Tanya lebih lanjut
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading && !data}
        aria-label="Buka tips Trackster AI"
        aria-expanded={open}
        whileTap={{ scale: 0.92 }}
        transition={TRANSITION_BASE}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-card ring-1 ring-border transition-colors hover:bg-card-hover"
      >
        <TracksterMascot mood={mood} size="md" />
        {showBadge && (
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-warning ring-2 ring-page" />
        )}
      </motion.button>
    </div>
  );
}
