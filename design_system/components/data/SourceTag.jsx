import React from "react";

const SOURCES = {
  BCA: { label: "BCA", color: "var(--source-bca)", background: "var(--source-bca-bg)" },
  JAGO: { label: "Jago", color: "var(--source-jago)", background: "var(--source-jago-bg)" },
};

export function SourceTag({ source = "BCA", size = "md", style, ...rest }) {
  const key = String(source).toUpperCase();
  const s = SOURCES[key] || { label: String(source), color: "var(--text-muted)", background: "var(--surface-track)" };
  const dims = size === "sm"
    ? { fontSize: "var(--text-micro)", padding: "2px 6px" }
    : { fontSize: "var(--text-badge)", padding: "3px 8px" };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "var(--space-4)",
        borderRadius: "var(--radius-subtle)", fontFamily: "var(--font-ui)",
        fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-caps)",
        textTransform: "uppercase", whiteSpace: "nowrap",
        color: s.color, background: s.background, ...dims, ...style,
      }}
      {...rest}
    >
      {s.label}
    </span>
  );
}
