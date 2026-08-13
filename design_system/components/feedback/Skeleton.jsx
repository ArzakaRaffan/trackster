import React from "react";

export function Skeleton({ width = "100%", height = 16, radius = "subtle", circle = false, style, ...rest }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block", width, height: circle ? width : height,
        borderRadius: circle ? "var(--radius-circle)" : "var(--radius-" + radius + ")",
        background: "linear-gradient(90deg,var(--surface-track) 25%,rgba(255,255,255,.18) 50%,var(--surface-track) 75%)",
        backgroundSize: "200% 100%",
        animation: "tk-shimmer 1.4s var(--ease-standard) infinite",
        ...style,
      }}
      {...rest}
    />
  );
}
