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

export function Input({ label, prefix, suffix, invalid = false, pill = false, hint, className = '', ...rest }: InputProps) {
  const [focus, setFocus] = useState(false);
  const shadow = invalid ? 'shadow-field-error' : focus ? 'shadow-field-focus' : 'shadow-field';

  return (
    <label className="flex flex-col gap-2">
      {label && <span className="text-small font-bold uppercase tracking-caps text-text-subtle">{label}</span>}
      <span
        className={`flex items-center gap-2.5 bg-neutral px-3.5 py-3 transition-shadow duration-base ease-standard ${
          pill ? 'rounded-pill px-5' : 'rounded-medium'
        } ${shadow}`}
      >
        {prefix && <span className="inline-flex text-text-subtle">{prefix}</span>}
        <input
          className={`min-w-0 flex-1 bg-transparent text-body font-normal text-text outline-none tabular-nums placeholder:text-text-subtlest disabled:opacity-50 focus-visible:outline-none ${className}`}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {suffix && <span className="inline-flex text-text-subtle">{suffix}</span>}
      </span>
      {hint && <span className={`text-small ${invalid ? 'text-danger' : 'text-text-subtle'}`}>{hint}</span>}
    </label>
  );
}
