import { formatRupiahCompact } from '@/lib/format';

export interface DayBarDatum {
  label: string;
  spent: number;
  budget?: number;
  isOverBudget?: boolean;
  isToday?: boolean;
}

export function DayBarChart({
  days,
  height = 140,
  onBarClick,
}: {
  days: DayBarDatum[];
  height?: number;
  onBarClick?: (index: number) => void;
}) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.spent || 0, d.budget || 0)));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-stretch gap-2" style={{ height }}>
        {days.map((d, i) => {
          const over = d.isOverBudget ?? d.spent > (d.budget || 0);
          const ratio = d.spent / max;
          const budgetLine = d.budget ? (d.budget / max) * 100 : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onBarClick?.(i)}
              className="group flex flex-1 min-w-0 flex-col items-center justify-end gap-2 outline-none"
              aria-label={`${d.label} ${formatRupiahCompact(d.spent)}`}
            >
              <div className="relative flex w-full flex-1 min-h-0 items-end">
                <div
                  className={`w-full rounded-subtle transition-[height] duration-slow ease-expressive ${
                    over ? 'bg-status-over' : d.isToday ? 'bg-brand' : 'bg-track'
                  } ${onBarClick ? 'group-hover:opacity-80' : ''}`}
                  style={{ height: `${Math.max(3, ratio * 100)}%` }}
                />
                {budgetLine != null && (
                  <div
                    className="absolute inset-x-0 z-[1] border-t border-dashed border-text-subtlest"
                    style={{ bottom: `${budgetLine}%` }}
                  />
                )}
              </div>
              <span className={`text-micro font-bold uppercase tracking-caps ${d.isToday ? 'text-text' : 'text-text-subtle'}`}>
                {d.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-small tabular-nums text-text-subtle">
        <span>Garis putus-putus = budget harian</span>
        <span>Puncak {formatRupiahCompact(max)}</span>
      </div>
    </div>
  );
}
