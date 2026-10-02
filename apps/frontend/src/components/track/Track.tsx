'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimationFrame, useReducedMotion, useSpring } from 'motion/react';
import { blobPath, DEFAULT_BLOB_PARAMS, type BlobParams } from './blobPath';

export type TrackMood =
  | 'idle'
  | 'happy'
  | 'excited'
  | 'worried'
  | 'alarm'
  | 'thinking'
  | 'talking'
  | 'sleepy'
  | 'sad'
  | 'dizzy';

/** The 8 eye shapes from the epic — kept independent of mood so the playground can preview all of them. */
export type EyeShape =
  | 'normal'
  | 'happy'
  | 'excited'
  | 'sleepy'
  | 'surprised'
  | 'sad'
  | 'dizzy'
  | 'focused'
  | 'hidden';

const MOOD_COLOR: Record<TrackMood, string> = {
  idle: '#1ed760',
  happy: '#67e79a',
  excited: '#67e79a',
  worried: '#ffa42b',
  alarm: '#f3727f',
  thinking: '#539df5',
  talking: '#1ed760',
  sleepy: '#b3b3b3',
  sad: '#7c7c7c',
  dizzy: '#b3b3b3',
};

const MOOD_EYE_SHAPE: Record<TrackMood, EyeShape> = {
  idle: 'normal',
  happy: 'happy',
  excited: 'excited',
  worried: 'focused',
  alarm: 'surprised',
  thinking: 'focused',
  talking: 'happy',
  sleepy: 'sleepy',
  sad: 'sad',
  dizzy: 'dizzy',
};

export const ALL_MOODS: TrackMood[] = [
  'idle',
  'happy',
  'excited',
  'worried',
  'alarm',
  'thinking',
  'talking',
  'sleepy',
  'sad',
  'dizzy',
];

export const ALL_EYE_SHAPES: EyeShape[] = [
  'normal',
  'happy',
  'excited',
  'sleepy',
  'surprised',
  'sad',
  'dizzy',
  'focused',
  'hidden',
];

const R = 15;
const CX = 20;
const CY = 20;
const DEFAULT_ACTIVE_MS = 60000;

interface TrackProps {
  size?: number;
  mood?: TrackMood;
  /** Playground-only override to preview a shape independent of mood. */
  eyeShapeOverride?: EyeShape;
  blobParams?: BlobParams;
  className?: string;
  /** Enable look-at pointer + tap/bounce + drag/stretch. */
  interactive?: boolean;
  /** Eye shape saat ngetik password (login 🙈). */
  hideEyes?: boolean;
  /** Auto sleep after N ms tanpa interaksi; default 60000. */
  sleepAfterMs?: number | null;
  /** Initial sleep state (digunakan oleh login aside supaya diam). */
  initialSleep?: boolean;
  /** Kalau true, hanya render blob + mata + partikel tanpa loop. */
  playPose?: boolean;
}

/** One eye as a filled path, `cx`/`cy` is its center, `s` scales the whole shape. */
function eyePath(shape: EyeShape, cx: number, cy: number, s: number): string {
  const w = 2.1 * s;
  const h = 2.45 * s;
  switch (shape) {
    case 'happy':
      return `M ${cx - w} ${cy + h * 0.3} Q ${cx} ${cy - h * 1.1} ${cx + w} ${cy + h * 0.3}`;
    case 'excited':
      return `M ${cx - w} ${cy} Q ${cx} ${cy - h * 1.3} ${cx + w} ${cy} Q ${cx} ${cy + h * 1.3} ${cx - w} ${cy} Z`;
    case 'sleepy':
      return `M ${cx - w} ${cy} L ${cx + w} ${cy}`;
    case 'surprised':
      return `M ${cx} ${cy - h * 1.5} A ${w * 1.3} ${h * 1.3} 0 1 1 ${cx - 0.01} ${cy - h * 1.5} Z`;
    case 'sad':
      return `M ${cx - w} ${cy - h * 0.4} Q ${cx} ${cy + h * 0.5} ${cx + w} ${cy + h * 0.6} Q ${cx} ${cy + h * 1.3} ${cx - w} ${cy - h * 0.4} Z`;
    case 'dizzy': {
      let d = `M ${cx} ${cy}`;
      for (let i = 1; i <= 10; i++) {
        const a = i * 1.3;
        const rad = (i / 10) * w;
        d += ` L ${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
      }
      return d;
    }
    case 'focused':
      return `M ${cx - w} ${cy} Q ${cx} ${cy - h * 0.5} ${cx + w} ${cy} Q ${cx} ${cy + h * 0.5} ${cx - w} ${cy} Z`;
    case 'hidden':
      return `M ${cx - w} ${cy} L ${cx + w} ${cy}`;
    case 'normal':
    default:
      return `M ${cx - w} ${cy} Q ${cx} ${cy - h} ${cx + w} ${cy} Q ${cx} ${cy + h} ${cx - w} ${cy} Z`;
  }
}

const FILLED_SHAPES: EyeShape[] = ['normal', 'excited', 'surprised', 'sad', 'focused'];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Particle {
  id: string;
  kind: 'sweat' | 'zzz' | 'sparkle' | 'coin' | 'confetti' | 'dot';
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
}

function makeParticle(kind: Particle['kind'], x: number, y: number, color = '#1ed760'): Particle {
  const life = kind === 'zzz' ? 2200 : kind === 'confetti' ? 1800 : 1300;
  return {
    id: `${kind}-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    kind,
    x,
    y,
    dx: kind === 'zzz' ? -6 - Math.random() * 4 : (Math.random() - 0.5) * 44,
    dy: kind === 'zzz' ? -14 - Math.random() * 8 : -24 - Math.random() * 36,
    life: 0,
    maxLife: life,
    size: kind === 'sweat' ? 4.2 : kind === 'zzz' ? 12 : kind === 'coin' ? 5 : 5.5,
    color,
    rot: Math.random() * 360,
  };
}

const dot = (cx: number, cy: number, r: number, color: string) =>
  `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;

export function Track({
  size = 48,
  mood = 'idle',
  eyeShapeOverride,
  blobParams,
  className = '',
  interactive = false,
  hideEyes = false,
  sleepAfterMs = DEFAULT_ACTIVE_MS,
  initialSleep = false,
  playPose = false,
}: TrackProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [path, setPath] = useState(() => blobPath(CX, CY, R, 0, blobParams ?? DEFAULT_BLOB_PARAMS));
  const [visible, setVisible] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tRef = useRef(0);
  const [blinkPhase, setBlinkPhase] = useState(0);
  const [moodInternal, setMoodInternal] = useState<TrackMood>(initialSleep ? 'sleepy' : mood);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [lookX, setLookX] = useState(0);
  const [lookY, setLookY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastActiveRef = useRef(Date.now());
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodRef = useRef(moodInternal);
  moodRef.current = moodInternal;
  const hideEyesRef = useRef(hideEyes);
  hideEyesRef.current = hideEyes;
  const particleColorRef = useRef(MOOD_COLOR[moodInternal]);
  particleColorRef.current = MOOD_COLOR[moodInternal];

  // squash & stretch, volume preserved
  const squash = useSpring(1, { stiffness: 200, damping: 18 });
  const stretch = useSpring(1, { stiffness: 200, damping: 18 });

  // sinkron mood external → internal (kecuali sedang drag / happy sementara)
  useEffect(() => {
    setMoodInternal((cur) => {
      if (isDragging) return cur;
      if (mood === 'sleepy') return 'sleepy';
      if (mood === 'idle' && cur === 'sleepy') return cur; // tidur tetap sampai bangun oleh interaksi
      return mood;
    });
  }, [mood, isDragging]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.01,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const emit = useCallback((name: string, detail?: unknown) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(`track:${name}`, { detail }));
  }, []);

  const burst = useCallback((kinds: Particle['kind'][]) => {
    if (reduceMotion) return;
    setParticles((prev) => [
      ...prev,
      ...kinds.map((kind, i) =>
        makeParticle(kind, CX + (i % 3 - 1) * 5, CY - 14 - (i % 2) * 5, particleColorRef.current),
      ),
    ]);
  }, [reduceMotion]);

  const wake = useCallback(() => {
    lastActiveRef.current = Date.now();
    if (moodRef.current === 'sleepy') {
      setMoodInternal('idle');
      burst(['sparkle']);
    }
  }, [burst]);

  const handleTap = useCallback(() => {
    wake();
    if (isDragging) return;
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 4) {
      tapCountRef.current = 0;
      setMoodInternal('dizzy');
      burst(['dot', 'sparkle']);
      tapTimerRef.current = setTimeout(() => setMoodInternal('idle'), 1200);
      return;
    }
    squash.set(0.82);
    stretch.set(1.22);
    setTimeout(() => {
      squash.set(1);
      stretch.set(1);
    }, 160);
    setMoodInternal('happy');
    burst(['coin']);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
      if (moodRef.current === 'happy') setMoodInternal('idle');
    }, 550);
  }, [burst, isDragging, squash, stretch, wake]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      wake();
      if (isDragging) {
        // stretch mengikuti arah tarikan; volume dijaga squash = 1/stretch
        const rect = wrapRef.current?.getBoundingClientRect();
        if (rect) {
          const dy = e.clientY - (rect.top + rect.height / 2);
          const dx = e.clientX - (rect.left + rect.width / 2);
          const mag = Math.min(Math.hypot(dx, dy) / rect.width, 2.2);
          const stretchVal = clamp(1 + mag * 0.35, 1, 1.7);
          stretch.set(stretchVal);
          squash.set(1 / stretchVal);
        }
        return;
      }
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nx = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
      const ny = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1);
      setLookX(nx);
      setLookY(ny);
    },
    [isDragging, squash, stretch, wake],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      wake();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // drag hanya saat pointer di area blob; tap dihitung di onPointerUp bila gerakan kecil
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) {
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        if (Math.hypot(dx, dy) > rect.width * 0.55) return;
      }
      setIsDragging(true);
      emit('track:grab');
      squash.set(0.9);
      stretch.set(1.12);
    },
    [emit, squash, stretch, wake],
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    squash.set(1);
    stretch.set(1);
    emit('track:drop');
    setMoodInternal('happy');
    burst(['confetti']);
    setTimeout(() => {
      if (moodRef.current === 'happy') setMoodInternal('idle');
    }, 700);
  }, [burst, emit, isDragging, squash, stretch]);

  const onPointerLeave = useCallback(() => {
    setLookX(0);
    setLookY(0);
  }, []);

  // auto sleep
  useEffect(() => {
    if (!interactive || sleepAfterMs === null || reduceMotion) return;
    const t = setInterval(() => {
      const idleMs = Date.now() - lastActiveRef.current;
      if (idleMs > sleepAfterMs && moodRef.current !== 'sleepy') {
        setMoodInternal('sleepy');
        burst(['zzz']);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [interactive, sleepAfterMs, reduceMotion, burst]);

  // auto sleep on playPose (tidak ada interaksi)
  useEffect(() => {
    if (playPose && sleepAfterMs === null && initialSleep) {
      setMoodInternal('sleepy');
    }
  }, [playPose, sleepAfterMs, initialSleep]);

  // random blink every 2-6s, occasionally double
  useEffect(() => {
    if (reduceMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      timer = setTimeout(() => {
        setBlinkPhase(1);
        setTimeout(() => setBlinkPhase(0), 90);
        if (Math.random() < 0.25) {
          setTimeout(() => setBlinkPhase(1), 220);
          setTimeout(() => setBlinkPhase(0), 310);
        }
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  // auto small idle actions 8-20s (look around, hop, stretch)
  useEffect(() => {
    if (reduceMotion || !interactive) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 8000 + Math.random() * 12000;
      timer = setTimeout(() => {
        if (moodRef.current === 'sleepy' || isDragging) {
          schedule();
          return;
        }
        const r = Math.random();
        if (r < 0.4) {
          setLookX((x) => (x === 0 ? 0.8 : 0));
        } else if (r < 0.7) {
          squash.set(0.92);
          stretch.set(1.08);
          setTimeout(() => {
            squash.set(1);
            stretch.set(1);
          }, 180);
        } else {
          setLookX((x) => (x === 0 ? -0.8 : 0));
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [reduceMotion, interactive, isDragging, squash, stretch]);

  useAnimationFrame((_time, delta) => {
    if (reduceMotion || !visible || tabHidden) return;
    tRef.current += delta / 1000;
    setPath(blobPath(CX, CY, R, tRef.current, blobParams ?? DEFAULT_BLOB_PARAMS, squash.get(), stretch.get()));
  });

  // update particles
  useAnimationFrame((_time, delta) => {
    if (reduceMotion) return;
    setParticles((prev) => {
      if (prev.length === 0) return prev;
      const dt = Math.min(delta / 1000, 0.05);
      const next = prev
        .map((p) => {
          const life = p.life + dt * 1000;
          return {
            ...p,
            life,
            x: p.x + p.dx * dt,
            y: p.y + p.dy * dt,
            rot: p.rot + dt * 40,
          };
        })
        .filter((p) => p.life < p.maxLife);
      return next;
    });
  });

  const color = MOOD_COLOR[moodInternal];
  const shape = hideEyesRef.current ? 'hidden' : eyeShapeOverride ?? MOOD_EYE_SHAPE[moodInternal];
  const filled = FILLED_SHAPES.includes(shape);
  const eyeYOffset = moodInternal === 'sleepy' ? 0 : -1;
  const lookL = {
    transform: `translate(${lookX * 2.2}px ${lookY * 1.6}px)`,
  };
  const lookR = {
    transform: `translate(${lookX * 2.2}px ${lookY * 1.6}px)`,
  };
  const mouthPath =
    moodInternal === 'happy'
      ? 'M15.5 25.5c2.4 2.6 6.6 2.6 9 0'
      : moodInternal === 'alarm'
        ? 'M16.5 26.5c1.6-1.5 5.4-1.5 7 0'
        : moodInternal === 'sleepy'
          ? 'M16.5 25.8c2 1.5 5 1.5 7 0'
          : 'M16.5 25.8c2 1.5 5 1.5 7 0';

  const showMouth = moodInternal === 'talking' || moodInternal === 'happy' || moodInternal === 'alarm';

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size, touchAction: interactive ? 'none' : undefined }}
      aria-hidden
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerLeave={interactive ? onPointerLeave : undefined}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.path
          d={reduceMotion ? blobPath(CX, CY, R, 0, blobParams ?? DEFAULT_BLOB_PARAMS) : path}
          fill={color}
          animate={{ fill: color }}
          transition={{ duration: 0.32 }}
        />
        <g transform={`translate(0 ${eyeYOffset})`}>
          <motion.g style={lookL}>
            <motion.path
              d={eyePath(shape, 14.5, 18, 1)}
              fill={filled ? '#121212' : 'none'}
              stroke={filled ? 'none' : '#121212'}
              strokeWidth={filled ? 0 : 1.6}
              strokeLinecap="round"
              animate={{ scaleY: blinkPhase ? 0.08 : 1 }}
              style={{ originX: '14.5px', originY: '18px' }}
              transition={{ duration: 0.08 }}
              id={`${uid}-eye-l`}
            />
          </motion.g>
          <motion.g style={lookR}>
            <motion.path
              d={eyePath(shape, 25.5, 18, 1)}
              fill={filled ? '#121212' : 'none'}
              stroke={filled ? 'none' : '#121212'}
              strokeWidth={filled ? 0 : 1.6}
              strokeLinecap="round"
              animate={{ scaleY: blinkPhase ? 0.08 : 1 }}
              style={{ originX: '25.5px', originY: '18px' }}
              transition={{ duration: 0.08 }}
              id={`${uid}-eye-r`}
            />
          </motion.g>
        </g>
        {showMouth && (
          <path d={mouthPath} stroke="#121212" strokeWidth={1.4} strokeLinecap="round" fill="none" />
        )}
        {particles.map((p) => {
          const alpha = 1 - p.life / p.maxLife;
          const pos = `${p.x} ${p.y}`;
          switch (p.kind) {
            case 'zzz':
              return (
                <text
                  key={p.id}
                  x={p.x}
                  y={p.y}
                  fontSize="12"
                  fontWeight="800"
                  fill="#fff"
                  opacity={alpha}
                >
                  z
                </text>
              );
            case 'sweat':
              return <path key={p.id} d={dot(p.x, p.y, p.size * alpha, p.color)} fill={p.color} opacity={alpha} />;
            case 'coin':
              return (
                <circle key={p.id} cx={p.x} cy={p.y} r={p.size} fill="#ffd34d" opacity={alpha} stroke="#b8860b" strokeWidth={1} />
              );
            case 'sparkle':
              return (
                <path
                  key={p.id}
                  d={`M ${p.x} ${p.y - p.size} L ${p.x + 1} ${p.y - 1} L ${p.x + p.size} ${p.y} L ${p.x + 1} ${p.y + 1} L ${p.x} ${p.y + p.size} L ${p.x - 1} ${p.y + 1} L ${p.x - p.size} ${p.y} L ${p.x - 1} ${p.y - 1} Z`}
                  fill="#fff"
                  opacity={alpha}
                  transform={`rotate(${p.rot} ${p.x} ${p.y})`}
                />
              );
            case 'confetti':
              return (
                <rect
                  key={p.id}
                  x={p.x - p.size / 2}
                  y={p.y - p.size / 2}
                  width={p.size}
                  height={p.size}
                  rx={1}
                  fill={p.color}
                  opacity={alpha}
                  transform={`rotate(${p.rot} ${p.x} ${p.y})`}
                />
              );
            case 'dot':
              return <circle key={p.id} cx={p.x} cy={p.y} r={1.6} fill={p.color} opacity={alpha} />;
            default:
              return null;
          }
        })}
      </svg>
    </span>
  );
}
