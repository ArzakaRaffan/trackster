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
const SIZE = 56; // h-14 w-14
const MARGIN = 8;
// Gerakan di bawah ambang ini dianggap tap (buka bubble), bukan drag.
const DRAG_THRESHOLD = 6;

type Pos = { x: number; y: number };

function clampPos(p: Pos): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(Math.max(p.x, MARGIN), Math.max(MARGIN, vw - SIZE - MARGIN)),
    y: Math.min(Math.max(p.y, MARGIN), Math.max(MARGIN, vh - SIZE - MARGIN)),
  };
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') return null;
    return clampPos(p);
  } catch {
    return null;
  }
}

export function MascotWidget() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [eventMood, setEventMood] = useState<TrackMood>('idle');
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Posisi disimpan di ref + diterapkan langsung ke style DOM saat drag, supaya
  // pointermove tidak memicu re-render React tiap frame (sumber utama drag
  // "patah-patah"). State React hanya disentuh sekali saat pointerup.
  const posRef = useRef<Pos | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [, forceRender] = useState(0);
  const lastMessageRef = useRef<string | null>(null);
  const { data, isLoading } = useSWR('/ai/mascot-tip', fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
  });

  const applyPos = useCallback((p: Pos) => {
    posRef.current = p;
    const el = rootRef.current;
    if (el) {
      // translate3d memaksa compositor → drag mulus tanpa layout thrash.
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    }
  }, []);

  // posisi default + hydrate dari localStorage (hanya client)
  useEffect(() => {
    const initial = posRef.current ?? loadPos() ?? clampPos({ x: window.innerWidth - SIZE - 24, y: window.innerHeight - SIZE - 96 });
    applyPos(initial);
    forceRender((n) => n + 1); // pastikan elemen sudah ke-render sebelum style diterapkan
  }, [applyPos]);

  // Jaga mascot tetap di dalam layar saat window di-resize / rotasi HP.
  useEffect(() => {
    const onResize = () => {
      if (posRef.current) applyPos(clampPos(posRef.current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyPos]);

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
      'budget:over': () => setEventMood('alert'),
      'budget:near': () => setEventMood('alert'),
      'transaction:new': () => setEventMood('happy'),
      'income:in': () => setEventMood('happy'),
      'goal:reached': () => setEventMood('happy'),
      'sync:start': () => setEventMood('think'),
      'sync:end': () => setEventMood('idle'),
      'ai:thinking': () => setEventMood('think'),
      'ai:reply': () => setEventMood('happy'),
    });
  }, []);

  const isReminder = data?.kind === 'reminder';
  const showBadge = isReminder && !open && !dismissed;
  const effectiveMood: TrackMood =
    eventMood !== 'idle'
      ? eventMood
      : isLoading
        ? 'think'
        : open
          ? isReminder
            ? 'alert'
            : 'happy'
          : showBadge
            ? 'alert'
            : 'idle';

  // --- Drag: pointer capture di tombolnya sendiri --------------------------------
  // Tanpa setPointerCapture, pointer yang bergerak cepat keluar dari elemen kecil
  // (56px) akan "putus" karena pointermove berhenti sampai — itulah kenapa versi
  // lama terasa patah-patah. Dengan capture, semua event dialirkan ke tombol ini
  // sampai pointerup, di mana pun kursor berada.
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = posRef.current;
      if (!p) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        baseX: p.x,
        baseY: p.y,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      applyPos(clampPos({ x: drag.baseX + dx, y: drag.baseY + dy }));
    },
    [applyPos],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      if (drag.moved) {
        // Klik bawaan <button> tetap terpicu setelah drag — tahan sekali supaya
        // bubble tidak ikut kebuka/ke-tutup tepat setelah user selesai drag.
        suppressClickRef.current = true;
        const p = posRef.current;
        if (p) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p));
          } catch {
            /* private mode / full */
          }
        }
      }
    },
    [],
  );

  const onClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen((o) => !o);
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed left-0 top-0 z-30 will-change-transform"
      style={{ transform: 'translate3d(-100px, -100px, 0)' }}
    >
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.24, ease: EASE_ENTER }}
            className="absolute bottom-full right-0 mb-3 w-[min(18.5rem,calc(100vw-2rem))] overflow-hidden rounded-panel bg-overlay shadow-overlay"
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
                <Track mood={isReminder ? 'alert' : 'happy'} size={28} />
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
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        disabled={isLoading && !data}
        aria-label="Buka tips Trackster AI (geser untuk memindahkan)"
        aria-expanded={open}
        animate={{ scale: dragging ? 1.08 : 1 }}
        whileTap={{ scale: 0.94 }}
        transition={TRANSITION_BASE}
        className={`relative flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-card ring-1 ring-border transition-[box-shadow,background-color] hover:bg-card-hover ${
          dragging ? 'cursor-grabbing shadow-overlay' : 'cursor-grab shadow-card'
        }`}
      >
        {/* pointer-events-none: semua gesture ditangani tombol. Kalau Track ikut
            menerima pointerdown (mode interactive), state drag internalnya tidak
            pernah menerima pointerup begitu pointer capture aktif di tombol →
            blob "nyangkut" dalam pose ketarik. */}
        <span className="pointer-events-none flex items-center justify-center">
          <Track mood={effectiveMood} size={44} />
        </span>
        {showBadge && <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-warning ring-2 ring-page" />}
      </motion.button>
    </div>
  );
}

