'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { EASE_ENTER, TRANSITION_BASE } from '@/lib/motion';
import { MessageCircle, X } from 'lucide-react';
import { Track, type TrackMood } from '@/components/track/Track';
import { subscribeTrackAll } from '@/components/track/trackBus';

interface MascotTip {
  kind: 'reminder' | 'fact';
  message: string;
}

const fetcher = (path: string) => api.get<MascotTip>(path);
const REFRESH_MS = 10 * 60 * 1000;
const AUTO_HIDE_MS = 10000;
const POS_KEY = 'trackster:floating-track-pos';

type Pos = { x: number; y: number };

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return { x: Math.min(Math.max(p.x, 0), vw - 64), y: Math.min(Math.max(p.y, 0), vh - 64) };
  } catch {
    return null;
  }
}

export function MascotWidget() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [eventMood, setEventMood] = useState<TrackMood>('idle');
  const [pos, setPos] = useState<Pos | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const { data, isLoading } = useSWR('/ai/mascot-tip', fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
  });

  // posisi default + hydrate dari localStorage (hanya client)
  useEffect(() => {
    setPos((p) => p ?? loadPos() ?? { x: window.innerWidth - 88, y: window.innerHeight - 120 });
  }, []);

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

  // event bus: reaksi Track ke event app (E09-S2)
  useEffect(() => {
    return subscribeTrackAll({
      'budget:over': () => setEventMood('alarm'),
      'budget:near': () => setEventMood('worried'),
      'transaction:new': () => setEventMood('excited'),
      'income:in': () => setEventMood('excited'),
      'goal:reached': () => setEventMood('excited'),
      'sync:start': () => setEventMood('thinking'),
      'sync:end': () => setEventMood('idle'),
      'ai:thinking': () => setEventMood('thinking'),
      'ai:reply': () => setEventMood('happy'),
    });
  }, []);

  const isReminder = data?.kind === 'reminder';
  const showBadge = isReminder && !open && !dismissed;
  const effectiveMood: TrackMood =
    eventMood !== 'idle'
      ? eventMood
      : isLoading
        ? 'thinking'
        : open
          ? isReminder
            ? 'alarm'
            : 'happy'
          : showBadge
            ? 'alarm'
            : 'idle';

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos?.x ?? 0, baseY: pos?.y ?? 0 };
    },
    [pos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nx = drag.baseX + (e.clientX - drag.startX);
    const ny = drag.baseY + (e.clientY - drag.startY);
    setPos({ x: Math.min(Math.max(nx, 0), window.innerWidth - 64), y: Math.min(Math.max(ny, 0), window.innerHeight - 64) });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPos((p) => {
      if (p) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(p));
        } catch {
          /* private mode / full */
        }
      }
      return p;
    });
  }, []);

  if (!pos) {
    return null;
  }

  return (
    <div
      className="fixed z-30"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.24, ease: EASE_ENTER }}
            className="absolute bottom-full right-0 mb-3 w-[18.5rem] overflow-hidden rounded-panel bg-overlay shadow-overlay"
          >
            <div className={`h-1 w-full ${isReminder ? 'bg-warning' : 'bg-brand'}`} aria-hidden />
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
                <Track mood={isReminder ? 'alarm' : 'happy'} size={28} />
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
        <Track mood={effectiveMood} size={44} interactive />
        {showBadge && <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-warning ring-2 ring-page" />}
      </motion.button>
    </div>
  );
}
