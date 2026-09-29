/** Fixed point count so the path topology never changes between frames — no warp interpolation. */
export const BLOB_POINTS = 10;

export interface BlobParams {
  /** Harmonic amplitudes for k=2,3,4, as a fraction of radius (jelly wobble strength). */
  amplitudes: [number, number, number];
  /** Angular speed (rad/s) per harmonic. */
  speeds: [number, number, number];
  /** Phase offset (rad) per harmonic. */
  phases: [number, number, number];
}

export const DEFAULT_BLOB_PARAMS: BlobParams = {
  amplitudes: [0.02, 0.015, 0.01],
  speeds: [0.6, 0.9, 1.3],
  phases: [0, 1.7, 3.4],
};

function get<T>(pts: T[], i: number): T {
  const n = pts.length;
  return pts[((i % n) + n) % n];
}

/** Closed Catmull-Rom spline through `pts`, converted to cubic Bézier segments (SVG path `d`). */
function catmullRomClosedPath(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = get(pts, i - 1);
    const p1 = get(pts, i);
    const p2 = get(pts, i + 1);
    const p3 = get(pts, i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

/**
 * Procedural blob body: radius wobbles per r(θ,t) = R·(1 + Σ aₖ·sin(kθ + ωₖt + φₖ)), k=2..4.
 * `scaleX`/`scaleY` apply squash & stretch (spring-driven, computed by the caller).
 */
export function blobPath(
  cx: number,
  cy: number,
  r: number,
  t: number,
  params: BlobParams = DEFAULT_BLOB_PARAMS,
  scaleX = 1,
  scaleY = 1,
  points = BLOB_POINTS,
): string {
  const { amplitudes, speeds, phases } = params;
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * Math.PI * 2;
    let radius = r;
    for (let k = 0; k < 3; k++) {
      const harmonic = k + 2;
      radius += r * amplitudes[k] * Math.sin(harmonic * theta + speeds[k] * t + phases[k]);
    }
    pts.push([cx + radius * Math.cos(theta) * scaleX, cy + radius * Math.sin(theta) * scaleY]);
  }
  return catmullRomClosedPath(pts);
}
