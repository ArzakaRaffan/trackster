import Image from 'next/image';

/**
 * Trackster wordmark resmi dari `logos/logo-wide.svg` (disalin ke /public).
 * Mark: bar hijau vertikal + bar putih miring. Wordmark: "trackster." lowercase,
 * titik hijau, Figtree 900, tracking −2px.
 *
 * Rasio intrinsik 350×64; `height` mengatur tinggi render, lebar menyesuaikan.
 */
export function TracksterLogo({ height = 36, className = '' }: { height?: number; className?: string }) {
  return (
    <Image
      src="/trackster-logo.svg"
      alt="Trackster"
      width={350}
      height={64}
      unoptimized
      priority
      className={`h-auto w-auto ${className}`}
      style={{ height }}
    />
  );
}
