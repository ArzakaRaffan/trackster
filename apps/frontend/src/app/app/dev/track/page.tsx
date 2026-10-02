'use client';

import { useRef, useState } from 'react';
import { Track, type TrackHandle, type TrackMood } from '@/components/track/Track';

const MOODS: TrackMood[] = ['idle', 'happy', 'alert', 'think', 'hide'];
const REACTS: { label: string; name: 'receive' | 'hop' | 'nod' | 'shake' }[] = [
  { label: 'receive', name: 'receive' },
  { label: 'hop', name: 'hop' },
  { label: 'nod', name: 'nod' },
  { label: 'shake', name: 'shake' },
];
const SIZES = [24, 48, 96, 200];

/** Not linked from nav — playground for the <track-mascot> "Track Struk" web component. */
export default function TrackPlaygroundPage() {
  const [mood, setMood] = useState<TrackMood>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [pointer, setPointer] = useState(true);
  const stageRef = useRef<TrackHandle | null>(null);

  return (
    <div className="min-h-screen bg-surface-base p-6 text-ink">
      <h1 className="mb-1 text-large font-bold">Track playground — &lt;track-mascot&gt; (Struk)</h1>
      <p className="mb-6 text-small text-ink-muted">
        Dev-only, tidak ada di nav. Preview bentuk, mood, dan reaksi sesaat dari web component.
      </p>

      <div className="mb-8 flex flex-wrap items-end gap-6">
        {SIZES.map((s) => (
          <div key={s} className="flex flex-col items-center gap-2">
            <Track size={s} mood={mood} speaking={speaking} pointer={pointer} />
            <span className="text-micro text-ink-muted">{s}px</span>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-small font-bold uppercase tracking-caps text-ink-muted">Mood</h2>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`rounded-comfortable px-3 py-1.5 text-small ${
                mood === m ? 'bg-brand text-black' : 'bg-surface-interactive text-ink-secondary'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-small font-bold uppercase tracking-caps text-ink-muted">Reaksi sesaat (react)</h2>
        <div className="flex flex-wrap gap-2">
          {REACTS.map((r) => (
            <button
              key={r.name}
              onClick={() => stageRef.current?.react(r.name)}
              className="rounded-comfortable px-3 py-1.5 text-small bg-surface-interactive text-ink-secondary"
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-small font-bold uppercase tracking-caps text-ink-muted">Status</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSpeaking((v) => !v)}
            className={`rounded-comfortable px-3 py-1.5 text-small ${
              speaking ? 'bg-brand text-black' : 'bg-surface-interactive text-ink-secondary'
            }`}
          >
            speaking
          </button>
          <button
            onClick={() => setPointer((v) => !v)}
            className={`rounded-comfortable px-3 py-1.5 text-small ${
              pointer ? 'bg-brand text-black' : 'bg-surface-interactive text-ink-secondary'
            }`}
          >
            pointer
          </button>
        </div>
      </section>

      <div className="mt-10 flex items-end gap-6">
        <Track ref={stageRef} size={240} mood={mood} speaking={speaking} pointer={pointer} />
      </div>
    </div>
  );
}
