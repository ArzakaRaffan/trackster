import React from "react";

const TONES = {
  neutral: { color: "var(--text-muted)", background: "var(--surface-track)" },
  under: { color: "var(--status-under)", background: "var(--status-under-bg)" },
  near: { color: "var(--status-near)", background: "var(--status-near-bg)" },
  over: { color: "var(--status-over)", background: "var(--status-over-bg)" },
  info: { color: "var(--status-info)", background: "var(--status-info-bg)" },
  accent: { color: "var(--text-on-accent)", background: "var(--green)" },
};

export function Badge({ children, tone = "neutral", icon = null, caps = false, style, ...rest }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "var(--space-4)",
        padding: "3px 8px", borderRadius: "var(--radius-full-pill)",
        fontFamily: "var(--font-ui)", fontSize: "var(--text-badge)",
        fontWeight: "var(--weight-semibold)", lineHeight: 1.33,
        letterSpacing: caps ? "var(--tracking-caps)" : "var(--tracking-normal)",
        textTransform: caps ? "uppercase" : "capitalize",
        whiteSpace: "nowrap", ...t, ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
