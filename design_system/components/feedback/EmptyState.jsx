import React from "react";

export function EmptyState({ icon = null, title, description, action = null, style, ...rest }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        gap: "var(--space-12)", padding: "var(--space-32) var(--space-20)",
        borderRadius: "var(--radius-comfortable)",
        boxShadow: "inset 0 0 0 1px var(--border-subtle)", ...style,
      }}
      {...rest}
    >
      {icon ? (
        <span style={{ width: 48, height: 48, borderRadius: "var(--radius-circle)", background: "var(--surface-interactive)", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      ) : null}
      {title ? <span style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-bold)", color: "var(--text-base)" }}>{title}</span> : null}
      {description ? <span style={{ fontSize: "var(--text-small)", lineHeight: "var(--leading-relaxed)", color: "var(--text-muted)", maxWidth: 280 }}>{description}</span> : null}
      {action}
    </div>
  );
}
