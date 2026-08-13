import React from "react";
import { formatIDR } from "./currency.js";

export function BudgetProgress({
  spent = 0,
  budget = 0,
  isOverBudget,
  height = 10,
  showLegend = true,
  nearThreshold = 0.8,
  style,
  ...rest
}) {
  const ratio = budget > 0 ? spent / budget : 0;
  const over = typeof isOverBudget === "boolean" ? isOverBudget : ratio > 1;
  const status = over ? "over" : ratio >= nearThreshold ? "near" : "under";
  const color = "var(--status-" + status + ")";
  const fill = Math.max(0, Math.min(1, ratio)) * 100;
  const overflow = over && budget > 0 ? Math.min(1, (spent - budget) / budget) * 100 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", ...style }} {...rest}>
      <div
        style={{
          position: "relative", height, borderRadius: "var(--radius-full-pill)",
          background: over ? "var(--status-over-bg)" : "var(--surface-track)", overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0, width: (over ? 100 : fill) + "%",
            background: color, borderRadius: "var(--radius-full-pill)",
            transition: "width var(--motion-slow) var(--ease-out), background var(--motion-base) var(--ease-standard)",
          }}
        />
        {overflow > 0 ? (
          <div
            style={{
              position: "absolute", top: 0, bottom: 0, right: 0, width: overflow + "%",
              background: "var(--status-over)", opacity: 0.55,
              borderLeft: "2px solid var(--surface-base)",
            }}
          />
        ) : null}
      </div>
      {showLegend ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-12)", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-bold)", color }}>
            {Math.round(ratio * 100)}% terpakai
          </span>
          <span style={{ fontSize: "var(--text-small)", color: "var(--text-muted)" }}>
            {over ? "lewat " + formatIDR(spent - budget) : formatIDR(budget - spent) + " sisa"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
