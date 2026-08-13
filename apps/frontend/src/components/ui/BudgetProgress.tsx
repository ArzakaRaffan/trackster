const rp = (n: number) => 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');

export function BudgetProgress({
  spent,
  budget,
  isOverBudget,
  height = 10,
  showLegend = true,
}: {
  spent: number;
  budget: number;
  isOverBudget?: boolean;
  height?: number;
  showLegend?: boolean;
}) {
  const ratio = budget > 0 ? spent / budget : 0;
  const over = isOverBudget ?? ratio > 1;
  const status = over ? 'over' : ratio >= 0.8 ? 'near' : 'under';
  const barColor = { over: 'bg-status-over', near: 'bg-status-near', under: 'bg-status-under' }[status];
  const textColor = { over: 'text-status-over', near: 'text-status-near', under: 'text-status-under' }[status];
  const fill = Math.max(0, Math.min(1, ratio)) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`overflow-hidden rounded-pill ${over ? 'bg-status-over-bg' : 'bg-track'}`}
        style={{ height }}
      >
        <div
          className={`h-full rounded-pill transition-[width] duration-slow ease-expressive ${barColor}`}
          style={{ width: `${over ? 100 : fill}%` }}
        />
      </div>
      {showLegend && (
        <div className="flex items-baseline justify-between gap-3 tabular-nums">
          <span className={`text-small font-bold ${textColor}`}>{Math.round(ratio * 100)}% terpakai</span>
          <span className="text-small text-ink-muted">
            {over ? `lewat ${rp(spent - budget)}` : `${rp(budget - spent)} sisa`}
          </span>
        </div>
      )}
    </div>
  );
}
