// Shared Motion transition tokens — MUST stay in sync with the CSS keyframe durations/easings
// already defined in tailwind.config.js (animation: fade-in-up / fade-in / slide-up), so every
// animation in the app — CSS or Motion-driven — reads as one consistent system.
export const EASE_EXPRESSIVE = [0.16, 1, 0.3, 1] as const; // matches Tailwind's ease-expressive
export const EASE_STANDARD = [0.3, 0, 0.4, 1] as const; // matches Tailwind's ease-standard

/** 320ms/expressive — matches CSS fade-in-up & slide-up (page mounts, sheet entrances). */
export const TRANSITION_SLOW = { duration: 0.32, ease: EASE_EXPRESSIVE };
/** 200ms/standard — matches CSS fade-in (sheet backdrops). */
export const TRANSITION_BASE = { duration: 0.2, ease: EASE_STANDARD };
/** 120ms/standard — matches the duration-fast utility used for hover/press states. */
export const TRANSITION_FAST = { duration: 0.12, ease: EASE_STANDARD };
