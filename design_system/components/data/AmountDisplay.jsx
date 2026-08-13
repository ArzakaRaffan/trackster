import React from "react";
import { formatIDR } from "./currency.js";

const SIZES = {
  hero: { fontSize: "var(--text-amount-hero)", letterSpacing: "var(--tracking-amount)", weight: "var(--weight-black)" },
  large: { fontSize: "var(--text-amount)", letterSpacing: "-1px", weight: "var(--weight-black)" },
  title: { fontSize: "var(--text-title)", letterSpacing: "normal", weight: "var(--weight-bold)" },
  body: { fontSize: "var(--text-body)", letterSpacing: "normal", weight: "var(--weight-bold)" },
  small: { fontSize: "var(--text-small)", letterSpacing: "normal", weight: "var(--weight-bold)" },
};

const TONES = {
  base: "var(--text-base)",
  muted: "var(--text-muted)",
  under: "var(--status-under)",
  near: "var(--status-near)",
  over: "var(--status-over)",
};

export function AmountDisplay({
  value,
  size = "large",
  tone = "base",
  label,
  compact = false,
  sign = false,
  caption,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.large;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", ...style }} {...rest}>
      {label ? (
        <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      ) : null}
      <span
        style={{
          fontFamily: "var(--font-title)", fontSize: s.fontSize, fontWeight: s.weight,
          letterSpacing: s.letterSpacing, lineHeight: "var(--leading-tight)",
          color: TONES[tone] || TONES.base, fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatIDR(value, { compact, sign })}
      </span>
      {caption ? (
        <span style={{ fontSize: "var(--text-label)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{caption}</span>
      ) : null}
    </div>
  );
}
