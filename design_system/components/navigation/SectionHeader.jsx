import React from "react";

export function SectionHeader({ title, meta, action = null, style, ...rest }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-12)", ...style }} {...rest}>
      <h2 style={{ margin: 0, flex: 1, minWidth: 0, fontFamily: "var(--font-ui)", fontSize: "var(--text-heading)", fontWeight: "var(--weight-semibold)", lineHeight: "var(--leading-snug)", color: "var(--text-base)" }}>
        {title}
      </h2>
      {meta ? <span style={{ fontSize: "var(--text-small)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{meta}</span> : null}
      {action}
    </div>
  );
}
