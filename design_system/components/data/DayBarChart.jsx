import React from "react";
import { formatIDR } from "./currency.js";

export function DayBarChart({ days = [], height = 140, onSelect, selected, style, ...rest }) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.spent || 0, d.budget || 0)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)", ...style }} {...rest}>
      <div style={{ display: "flex", alignItems: "stretch", gap: "var(--space-8)", height }}>
        {days.map((d, i) => {
          const over = typeof d.isOverBudget === "boolean" ? d.isOverBudget : (d.spent || 0) > (d.budget || 0);
          const ratio = (d.spent || 0) / max;
          const budgetLine = d.budget ? (d.budget / max) * 100 : null;
          const isSel = selected === d.label || selected === i;
          return (
            <div
              key={d.label || i}
              onClick={onSelect ? () => onSelect(d, i) : undefined}
              style={{
                flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                alignItems: "center", gap: "var(--space-8)", cursor: onSelect ? "pointer" : "default",
              }}
            >
              <div style={{ position: "relative", width: "100%", flex: "1 1 0", minHeight: 0, display: "flex", alignItems: "flex-end" }}>
                <div
                  style={{
                    width: "100%", height: Math.max(3, ratio * 100) + "%",
                    background: over ? "var(--status-over)" : isSel ? "var(--green)" : "var(--surface-track)",
                    borderRadius: "var(--radius-subtle)",
                    transition: "height var(--motion-slow) var(--ease-out), background var(--motion-base) var(--ease-standard)",
                  }}
                />
                {budgetLine != null ? (
                  <div
                    style={{
                      position: "absolute", left: 0, right: 0, bottom: budgetLine + "%", zIndex: 1,
                      borderTop: "1px dashed rgba(255,255,255,.55)",
                    }}
                  />
                ) : null}
              </div>
              <span style={{ fontSize: "var(--text-micro)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: isSel ? "var(--text-base)" : "var(--text-muted)" }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-small)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
        <span>Garis putus-putus = budget harian</span>
        <span>Puncak {formatIDR(max, { compact: true })}</span>
      </div>
    </div>
  );
}
