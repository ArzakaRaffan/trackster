import React from "react";
import { formatIDR } from "./currency.js";

const SIZES = { title: "var(--text-title)", heading: "var(--text-heading)", body: "var(--text-body)" };

export function StatTile({ label, value, delta, tone = "base", size = "title", format = "currency", compact = true, style, ...rest }) {
  const color = { base: "var(--text-base)", under: "var(--status-under)", near: "var(--status-near)", over: "var(--status-over)", muted: "var(--text-muted)" }[tone];
  const deltaTone = delta == null ? null : delta > 0 ? "var(--status-over)" : "var(--status-under)";
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: "var(--space-6)",
        background: "var(--surface-card)", borderRadius: "var(--radius-comfortable)",
        padding: "var(--space-14)", minWidth: 0, ...style,
      }}
      {...rest}
    >
      <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-title)", fontSize: SIZES[size] || SIZES.title, fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-tight)", whiteSpace: "nowrap", color, fontVariantNumeric: "tabular-nums" }}>
        {format === "currency" ? formatIDR(value, { compact }) : value}
      </span>
      {delta != null ? (
        <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-bold)", color: deltaTone, fontVariantNumeric: "tabular-nums" }}>
          {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}% vs minggu lalu
        </span>
      ) : null}
    </div>
  );
}
