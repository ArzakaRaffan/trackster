import React from "react";

export function Select({ value, onChange, options = [], label, disabled = false, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", ...style }}>
      {label ? (
        <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      ) : null}
      <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            appearance: "none", WebkitAppearance: "none", width: "100%",
            background: "var(--surface-interactive)", color: "var(--text-base)",
            border: "none", outline: "none",
            boxShadow: focus ? "var(--shadow-inset-accent)" : "var(--shadow-inset-border)",
            borderRadius: "var(--radius-comfortable)", padding: "12px 40px 12px 14px",
            fontFamily: "var(--font-ui)", fontSize: "var(--text-body)", cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1, transition: "box-shadow var(--motion-base) var(--ease-standard)",
          }}
          {...rest}
        >
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value} style={{ background: "var(--surface-interactive)" }}>{opt.label}</option>;
          })}
        </select>
        <span style={{ position: "absolute", right: 14, pointerEvents: "none", color: "var(--text-muted)", fontSize: "var(--text-small)" }}>▾</span>
      </span>
    </label>
  );
}
