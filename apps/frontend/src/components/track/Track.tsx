'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimationFrame, useReducedMotion } from 'motion/react';
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
  | 'sad';

/** The 8 eye shapes from the epic — kept independent of mood so the playground can preview all of them. */
export type EyeShape =
  | 'normal'
  | 'happy'
  | 'excited'
  | 'sleepy'
  | 'surprised'
  | 'sad'
  | 'dizzy'
  | 'focused';

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
];

const R = 15;
const CX = 20;
const CY = 20;

interface TrackProps {
  size?: number;
  mood?: TrackMood;
  /** Playground-only override to preview a shape independent of mood. */
  eyeShapeOverride?: EyeShape;
  blobParams?: BlobParams;
  className?: string;
}

/** One eye as a filled path, `cx`/`cy` is its center, `s` scales the whole shape. */
function eyePath(shape: EyeShape, cx: number, cy: number, s: number): string {
  const w = 2.1 * s;
  const h = 2.45 * s;
  switch (shape) {
    case 'happy':
      // upward arc "^"
      return `M ${cx - w} ${cy + h * 0.3} Q ${cx} ${cy - h * 1.1} ${cx + w} ${cy + h * 0.3}`;
    case 'excited':
      // ">" / "<" chevron-ish wide oval, drawn as a fat lens shape
      return `M ${cx - w} ${cy} Q ${cx} ${cy - h * 1.3} ${cx + w} ${cy} Q ${cx} ${cy + h * 1.3} ${cx - w} ${cy} Z`;
    case 'sleepy':
      // flat line
      return `M ${cx - w} ${cy} L ${cx + w} ${cy}`;
    case 'surprised':
      // big circle
      return `M ${cx} ${cy - h * 1.5} A ${w * 1.3} ${h * 1.3} 0 1 1 ${cx - 0.01} ${cy - h * 1.5} Z`;
    case 'sad':
      // oval tilted down at the outer corner
      return `M ${cx - w} ${cy - h * 0.4} Q ${cx} ${cy + h * 0.5} ${cx + w} ${cy + h * 0.6} Q ${cx} ${cy + h * 1.3} ${cx - w} ${cy - h * 0.4} Z`;
    case 'dizzy': {
      // tiny spiral built from a short polyline
      let d = `M ${cx} ${cy}`;
      for (let i = 1; i <= 10; i++) {
        const a = i * 1.3;
        const rad = (i / 10) * w;
        d += ` L ${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
      }
      return d;
    }
    case 'focused':
      // narrowed oval
      return `M ${cx - w} ${cy} Q ${cx} ${cy - h * 0.5} ${cx + w} ${cy} Q ${cx} ${cy + h * 0.5} ${cx - w} ${cy} Z`;
    case 'normal':
    default:
      return `M ${cx - w} ${cy} Q ${cx} ${cy - h} ${cx + w} ${cy} Q ${cx} ${cy + h} ${cx - w} ${cy} Z`;
  }
}

const FILLED_SHAPES: EyeShape[] = ['normal', 'excited', 'surprised', 'sad', 'focused'];

/**
 * Procedural blob mascot — single flat color, personality from motion (see docs/revamp/epics/E09-mascot.md).
 * This is the E09-S1 engine: body wobble + blink + mood color/eye-shape. Interaction, look-at, and
 * event reactions land in E09-S2.
 */
export function Track({ size = 48, mood = 'idle', eyeShapeOverride, blobParams, className = '' }: TrackProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [path, setPath] = useState(() => blobPath(CX, CY, R, 0, blobParams ?? DEFAULT_BLOB_PARAMS));
  const [visible, setVisible] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tRef = useRef(0);
  const [blinkPhase, setBlinkPhase] = useState(0); // 0 = open, 1 = closed

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

  // Random blink every 2-6s, occasionally double.
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

  useAnimationFrame((_time, delta) => {
    if (reduceMotion || !visible || tabHidden) return;
    tRef.current += delta / 1000;
    setPath(blobPath(CX, CY, R, tRef.current, blobParams ?? DEFAULT_BLOB_PARAMS));
  });

  const color = MOOD_COLOR[mood];
  const shape = eyeShapeOverride ?? MOOD_EYE_SHAPE[mood];
  const filled = FILLED_SHAPES.includes(shape);
  const eyeYOffset = mood === 'sleepy' ? 0 : -1;

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.path
          d={reduceMotion ? blobPath(CX, CY, R, 0, blobParams ?? DEFAULT_BLOB_PARAMS) : path}
          fill={color}
          animate={{ fill: color }}
          transition={{ duration: 0.32 }}
        />
        <g transform={`translate(0 ${eyeYOffset})`}>
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
        </g>
        {mood === 'talking' && (
          <path d="M17 27c1.6 1.3 4.4 1.3 6 0" stroke="#121212" strokeWidth={1.4} strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}
