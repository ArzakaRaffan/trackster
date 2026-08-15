'use client';

import { InputHTMLAttributes, ReactNode, useState } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
  pill?: boolean;
  hint?: string;
}

export function Input({
  label,
  prefix,
  suffix,
  invalid = false,
  pill = false,
  hint,
  className = '',
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focus, setFocus] = useState(false);
  const shadow = invalid ? 'shadow-field-error' : focus ? 'shadow-field-focus' : 'shadow-field';

  return (
    <label className="flex flex-col gap-2">
      {label && <span className="text-small font-bold uppercase tracking-caps text-ink-muted">{label}</span>}
      <span
        className={`flex items-center gap-2.5 bg-surface-interactive px-3.5 py-3 transition-shadow duration-base ease-standard ${
          pill ? 'rounded-pill px-5' : 'rounded-comfortable'
        } ${shadow}`}
      >
        {prefix && <span className="inline-flex text-ink-muted">{prefix}</span>}
        <input
          className={`min-w-0 flex-1 bg-transparent text-body font-normal text-ink outline-none tabular-nums placeholder:text-ink-subtle disabled:opacity-50 ${className}`}
          {...rest}
          onFocus={(e) => {
            setFocus(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            onBlur?.(e);
          }}
        />
        {suffix && <span className="inline-flex text-ink-muted">{suffix}</span>}
      </span>
      {hint && <span className={`text-small ${invalid ? 'text-status-over' : 'text-ink-muted'}`}>{hint}</span>}
    </label>
  );
}
