import React from "react";

export function TopBar({ title, subtitle, leading = null, actions = null, sticky = true, style, ...rest }) {
  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-12)",
        padding: "var(--space-16) var(--gutter-mobile)",
        position: sticky ? "sticky" : "static", top: 0, zIndex: 5,
        background: sticky ? "rgba(18,18,18,.86)" : "transparent",
        backdropFilter: sticky ? "var(--blur-overlay)" : "none",
        WebkitBackdropFilter: sticky ? "var(--blur-overlay)" : "none",
        ...style,
      }}
      {...rest}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {subtitle ? (
          <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)" }}>{subtitle}</span>
        ) : null}
        <h1 style={{ margin: 0, fontFamily: "var(--font-title)", fontSize: "var(--text-title)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-tight)", color: "var(--text-base)" }}>{title}</h1>
      </div>
      {actions ? <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>{actions}</div> : null}
    </header>
  );
}
