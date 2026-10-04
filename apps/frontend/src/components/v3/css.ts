import type { CSSProperties } from 'react';

const kebabToCamel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Inline-CSS string → React style object (same rules as the design prototype's runtime). */
export function css(src: unknown): CSSProperties {
  if (src && typeof src === 'object') return src as CSSProperties;
  const o: Record<string, string> = {};
  if (typeof src !== 'string') return o;
  for (const decl of src.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    o[prop.startsWith('--') ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  return o as CSSProperties;
}

export const noop = () => {};
