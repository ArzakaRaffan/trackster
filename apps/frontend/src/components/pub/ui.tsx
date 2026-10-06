import type { InputHTMLAttributes, ReactNode } from 'react';

/** Field struk: label mono + input (opsional prefix/suffix). Dipakai kalkulator publik. */
export function Field({ label, hint, prefix, suffix, ...input }: { label: string; hint?: string; prefix?: string; suffix?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="pb-f">
      <span className="pb-mono">{label}</span>
      {prefix || suffix ? (
        <span className="pb-aff">
          {prefix && <span>{prefix}</span>}
          <input {...input} />
          {suffix && <span>{suffix}</span>}
        </span>
      ) : (
        <input className="pb-in" {...input} />
      )}
      {hint && <span className="pb-help">{hint}</span>}
    </label>
  );
}

/** Segmented control. */
export function Seg<T extends string>({ value, onChange, options, small }: { value: T; onChange: (v: T) => void; options: [T, string][]; small?: boolean }) {
  return (
    <div className={`pb-seg${small ? ' sm' : ''}`} role="group">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Kv({ label, value, hl, bad }: { label: ReactNode; value: ReactNode; hl?: boolean; bad?: boolean }) {
  return (
    <div className={`pb-kv${hl ? ' hl' : ''}`}>
      <span>{label}</span>
      <b className={bad ? 'bad' : undefined}>{value}</b>
    </div>
  );
}
