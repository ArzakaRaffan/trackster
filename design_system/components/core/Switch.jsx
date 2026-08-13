import React from "react";

export function Switch({ checked = false, onChange, label, description, disabled = false, style, ...rest }) {
  const toggle = () => { if (!disabled && onChange) onChange(!checked); };
  return (
    <div
      onClick={toggle}
      role="switch"
      aria-checked={checked}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-16)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...style,
      }}
      {...rest}
    >
      {label || description ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {label ? <span style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-bold)", color: "var(--text-base)" }}>{label}</span> : null}
          {description ? <span style={{ fontSize: "var(--text-small)", lineHeight: "var(--leading-relaxed)", color: "var(--text-muted)" }}>{description}</span> : null}
        </div>
      ) : null}
      <span
        style={{
          width: 48, height: 28, flex: "0 0 auto", borderRadius: "var(--radius-full-pill)",
          background: checked ? "var(--green)" : "var(--surface-track)",
          boxShadow: checked ? "none" : "inset 0 0 0 1px var(--border-default)",
          padding: 3, display: "flex", alignItems: "center",
          justifyContent: checked ? "flex-end" : "flex-start",
          transition: "background var(--motion-base) var(--ease-standard)",
        }}
      >
        <span
          style={{
            width: 22, height: 22, borderRadius: "var(--radius-circle)",
            background: checked ? "var(--pure-black)" : "var(--text-muted)",
            transition: "background var(--motion-base) var(--ease-standard)",
          }}
        />
      </span>
    </div>
  );
}
