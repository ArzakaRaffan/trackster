'use client';

import { V3Logic } from '@/components/v3/logic';

// Phase-1 visual baseline: the prototype running 1:1 with its mock data. Removed once every screen is wired to real data.
export default function V3Preview() {
  return <V3Logic mulai="beranda" theme="dark" density="lega" heroFocus="sisa" mascot="aktif" reducedMotion={false} />;
}
