import { formatRupiahCompact } from '@/lib/format';

// "Rp" + id-ID grouping, no space — matches the design system exactly (lib/format.ts's
// formatRupiah has a legacy space, kept there for the pages that already depend on it).
const rp = (n: number) => 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');

const SIZES = {
  hero: 'text-amount-hero tracking-amount font-black',
  large: 'text-amount tracking-[-1px] font-black',
  title: 'text-title font-bold',
  body: 'text-body font-bold',
  small: 'text-small font-bold',
} as const;

const TONES = {
  base: 'text-ink',
  muted: 'text-ink-muted',
  under: 'text-status-under',
  near: 'text-status-near',
  over: 'text-status-over',
} as const;

export function AmountDisplay({
  value,
  size = 'large',
  tone = 'base',
  label,
  compact = false,
  sign = false,
  caption,
}: {
  value: number;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  label?: string;
  compact?: boolean;
  sign?: boolean;
  caption?: string;
}) {
  const abs = compact ? formatRupiahCompact(Math.abs(value)) : rp(value);
  const prefix = sign ? (value < 0 ? '−' : '+') : '';
  const formatted = prefix + abs;

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-small font-bold uppercase tracking-caps text-ink-muted">{label}</span>}
      <span className={`font-title leading-tight tabular-nums ${SIZES[size]} ${TONES[tone]}`}>{formatted}</span>
      {caption && <span className="text-label tabular-nums text-ink-muted">{caption}</span>}
    </div>
  );
}
