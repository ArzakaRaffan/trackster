'use client';

import { useState } from 'react';
import { ALL_EYE_SHAPES, ALL_MOODS, Track, type EyeShape, type TrackMood } from '@/components/track/Track';
import { DEFAULT_BLOB_PARAMS, type BlobParams } from '@/components/track/blobPath';

const SIZES = [24, 48, 96, 200];

/** Not linked from nav — E09-S1 playground for Arzaka to eyeball shape/proportions/color before E09-S2/S3. */
export default function TrackPlaygroundPage() {
  const [mood, setMood] = useState<TrackMood>('idle');
  const [eyeShapeOverride, setEyeShapeOverride] = useState<EyeShape | undefined>(undefined);
  const [params, setParams] = useState<BlobParams>(DEFAULT_BLOB_PARAMS);

  const setAmplitude = (i: 0 | 1 | 2, v: number) => {
    const amplitudes = [...params.amplitudes] as BlobParams['amplitudes'];
    amplitudes[i] = v;
    setParams({ ...params, amplitudes });
  };
  const setSpeed = (i: 0 | 1 | 2, v: number) => {
    const speeds = [...params.speeds] as BlobParams['speeds'];
    speeds[i] = v;
    setParams({ ...params, speeds });
  };

  return (
    <div className="min-h-screen bg-surface-base p-6 text-ink">
      <h1 className="mb-1 text-large font-bold">Track playground (E09-S1)</h1>
      <p className="mb-6 text-small text-ink-muted">
        Dev-only, tidak ada di nav. Cek bentuk, proporsi mata, warna sebelum lanjut E09-S2.
      </p>

      <div className="mb-8 flex flex-wrap items-end gap-6">
        {SIZES.map((s) => (
          <div key={s} className="flex flex-col items-center gap-2">
            <Track size={s} mood={mood} eyeShapeOverride={eyeShapeOverride} blobParams={params} />
            <span className="text-micro text-ink-muted">{s}px</span>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-small font-bold uppercase tracking-caps text-ink-muted">Mood</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_MOODS.map((m) => (
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

      <section className="mb-8">
        <h2 className="mb-2 text-small font-bold uppercase tracking-caps text-ink-muted">
          Eye shape override (preview semua 8 bentuk lepas dari mood)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEyeShapeOverride(undefined)}
            className={`rounded-comfortable px-3 py-1.5 text-small ${
              eyeShapeOverride === undefined ? 'bg-brand text-black' : 'bg-surface-interactive text-ink-secondary'
            }`}
          >
            (ikut mood)
          </button>
          {ALL_EYE_SHAPES.map((s) => (
            <button
              key={s}
              onClick={() => setEyeShapeOverride(s)}
              className={`rounded-comfortable px-3 py-1.5 text-small ${
                eyeShapeOverride === s ? 'bg-brand text-black' : 'bg-surface-interactive text-ink-secondary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-small font-bold uppercase tracking-caps text-ink-muted">Jelly params</h2>
        <div className="grid max-w-md grid-cols-1 gap-3">
          {([0, 1, 2] as const).map((i) => (
            <div key={i} className="flex items-center gap-3 text-small text-ink-secondary">
              <span className="w-24">amp k={i + 2}</span>
              <input
                type="range"
                min={0}
                max={0.08}
                step={0.005}
                value={params.amplitudes[i]}
                onChange={(e) => setAmplitude(i, Number(e.target.value))}
              />
              <span className="w-12 tabular-nums">{params.amplitudes[i].toFixed(3)}</span>
              <span className="w-14">speed</span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={params.speeds[i]}
                onChange={(e) => setSpeed(i, Number(e.target.value))}
              />
              <span className="w-10 tabular-nums">{params.speeds[i].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
