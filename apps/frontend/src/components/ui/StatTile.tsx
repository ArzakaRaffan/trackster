const TONE = {
  base: 'text-text',
  under: 'text-status-under',
  near: 'text-status-near',
  over: 'text-status-over',
  muted: 'text-text-subtle',
} as const;

const SIZE = {
  title: 'text-title',
  heading: 'text-heading',
  body: 'text-body',
} as const;

interface StatTileProps {
  label: string;
  value: string;
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
}

export function StatTile({ label, value, tone = 'base', size = 'heading' }: StatTileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-medium bg-card p-3.5 shadow-card">
      <span className="truncate text-small font-bold uppercase tracking-caps text-text-subtle">{label}</span>
      <span className={`font-title font-bold leading-tight tabular-nums ${SIZE[size]} ${TONE[tone]}`}>{value}</span>
    </div>
  );
}
