'use client';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled = false }: SwitchProps) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center gap-4 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      {(label || description) && (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {label && <span className="text-body font-bold text-ink">{label}</span>}
          {description && <span className="text-small leading-relaxed text-ink-muted">{description}</span>}
        </div>
      )}
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full-pill p-[3px] transition-colors duration-base ease-standard ${
          checked ? 'bg-brand justify-end' : 'bg-track justify-start shadow-[inset_0_0_0_1px_theme(colors.line.DEFAULT)]'
        }`}
      >
        <span className={`h-[22px] w-[22px] rounded-full transition-colors duration-base ease-standard ${checked ? 'bg-base' : 'bg-ink-muted'}`} />
      </span>
    </div>
  );
}
