'use client';

import type { Ref } from 'react';

type Props = {
  size?: string | number;
  mood?: string;
  speaking?: string | boolean;
  pointer?: string | boolean;
  still?: string | boolean;
  ref?: Ref<HTMLElement>;
};

/** `<track-mascot>` web component (public/track-mascot.js) with the prototype's attribute surface. */
export function TrackMascot({ size, mood, speaking, pointer, still, ref }: Props) {
  const s = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
  return <track-mascot ref={ref as never} size={s(size)} mood={mood as never} speaking={s(speaking) as never} pointer={s(pointer) as never} still={s(still) as never} />;
}
