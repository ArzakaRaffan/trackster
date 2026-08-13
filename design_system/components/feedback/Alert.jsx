import React from "react";

const TONES = {
  over: { color: "var(--status-over)", background: "var(--status-over-bg)" },
  near: { color: "var(--status-near)", background: "var(--status-near-bg)" },
  under: { color: "var(--status-under)", background: "var(--status-under-bg)" },
  info: { color: "var(--status-info)", background: "var(--status-info-bg)" },
};

export function Alert({ tone = "info", title, children, icon = null, action = null, onDismiss, style, ...rest }) {
  const t = TONES[tone] || TONES.info;
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: "var(--space-12)",
        background: t.background, borderRadius: "var(--radius-comfortable)",
        boxShadow: "inset 0 0 0 1px " + t.color, padding: "var(--space-14)", ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ color: t.color, display: "inline-flex", marginTop: 1 }}>{icon}</span> : null}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {title ? <span style={{ fontSize: "var(--text-label)", fontWeight: "var(--weight-bold)", color: t.color }}>{title}</span> : null}
        {children ? <span style={{ fontSize: "var(--text-small)", lineHeight: "var(--leading-relaxed)", color: "var(--text-secondary)" }}>{children}</span> : null}
        {action ? <span style={{ marginTop: "var(--space-6)" }}>{action}</span> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup"
          style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "var(--text-label)", padding: 0, lineHeight: 1 }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
