import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// JSX intrinsic element + imperative handle for the <track-mascot> web component
// (see public/track-mascot.js — "Track Struk" design, single source of truth for the mascot).

export type TrackMood = 'idle' | 'happy' | 'alert' | 'think' | 'hide';

export type TrackReact = 'receive' | 'hop' | 'nod' | 'shake';

type TrackMascotProps = {
  size?: number | string;
  mood?: TrackMood;
  speaking?: boolean | 'true' | 'false';
  pointer?: boolean | 'true' | 'false';
  still?: boolean | 'true' | 'false';
};

// React 19: namespace JSX global dihapus, augmentasi lewat modul 'react'.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'track-mascot': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & TrackMascotProps;
    }
  }
}

export interface TrackMascotElement extends HTMLElement {
  react(name: TrackReact): void;
}
