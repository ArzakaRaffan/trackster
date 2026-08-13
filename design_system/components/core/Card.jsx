import React from "react";

export function Card({
  children,
  variant = "raised",
  padding = 16,
  radius = "comfortable",
  interactive = false,
  elevated = false,
  as = "div",
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const Tag = as;
  const bg = {
    raised: "var(--surface-card)",
    alt: "var(--surface-card-alt)",
    flat: "transparent",
    outlined: "transparent",
  }[variant];
  return (
    <Tag
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      style={{
        background: hover ? "var(--surface-card-alt)" : bg,
        borderRadius: "var(--radius-" + radius + ")",
        padding: typeof padding === "number" ? padding + "px" : padding,
        boxShadow: [
          variant === "outlined" ? "inset 0 0 0 1px var(--border-subtle)" : "",
          elevated ? "var(--shadow-medium)" : "",
        ].filter(Boolean).join(", ") || "none",
        cursor: interactive ? "pointer" : "default",
        transition: "background var(--motion-base) var(--ease-standard)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
