import React from "react";
import { formatIDR, formatTime } from "./currency.js";
import { SourceTag } from "./SourceTag.jsx";

export function TransactionRow({
  description,
  amount,
  source,
  occurredAt,
  time,
  icon = null,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const clock = time || (occurredAt ? formatTime(occurredAt) : "");
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-12)",
        padding: "10px 12px", minHeight: 56,
        borderRadius: "var(--radius-standard)",
        background: hover && onClick ? "var(--surface-hover)" : "transparent",
        cursor: onClick ? "pointer" : "default",
        transition: "background var(--motion-fast) var(--ease-standard)",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          width: 40, height: 40, flex: "0 0 auto", borderRadius: "var(--radius-circle)",
          background: "var(--surface-interactive)", color: "var(--text-muted)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: "var(--text-label)", fontWeight: "var(--weight-bold)",
        }}
      >
        {icon || (description ? String(description).trim().charAt(0).toUpperCase() : "?")}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span
          style={{
            fontSize: "var(--text-body)", fontWeight: "var(--weight-bold)", color: "var(--text-base)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {description}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
          <SourceTag source={source} size="sm" />
          <span style={{ fontSize: "var(--text-small)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{clock}</span>
        </span>
      </span>
      <span
        style={{
          fontSize: "var(--text-body)", fontWeight: "var(--weight-bold)", color: "var(--text-base)",
          fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
        }}
      >
        −{formatIDR(amount)}
      </span>
    </div>
  );
}
