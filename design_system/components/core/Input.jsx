import React from "react";

export function Input({
  value,
  onChange,
  placeholder,
  label,
  type = "text",
  prefix = null,
  suffix = null,
  invalid = false,
  disabled = false,
  pill = false,
  hint,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const ring = invalid
    ? "rgb(18,18,18) 0px 1px 0px, var(--text-negative) 0px 0px 0px 1px inset"
    : focus
      ? "var(--shadow-inset-accent)"
      : "var(--shadow-inset-border)";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", ...style }}>
      {label ? (
        <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      ) : null}
      <span
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-10)",
          background: "var(--surface-interactive)",
          borderRadius: pill ? "var(--radius-pill)" : "var(--radius-comfortable)",
          padding: pill ? "12px 20px" : "12px 14px",
          boxShadow: ring, opacity: disabled ? 0.5 : 1,
          transition: "box-shadow var(--motion-base) var(--ease-standard)",
        }}
      >
        {prefix ? <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>{prefix}</span> : null}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
            color: "var(--text-base)", fontFamily: "var(--font-ui)", fontSize: "var(--text-body)",
            fontWeight: "var(--weight-regular)", fontVariantNumeric: "tabular-nums",
          }}
          {...rest}
        />
        {suffix ? <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>{suffix}</span> : null}
      </span>
      {hint ? (
        <span style={{ fontSize: "var(--text-small)", color: invalid ? "var(--text-negative)" : "var(--text-muted)" }}>{hint}</span>
      ) : null}
    </label>
  );
}
