import React from "react";

const SIZES = {
  sm: { padding: "6px 14px", fontSize: "var(--text-small)", minHeight: 32 },
  md: { padding: "8px 16px", fontSize: "var(--text-label)", minHeight: 40 },
  lg: { padding: "14px 32px", fontSize: "var(--text-label)", minHeight: 48 },
};

const VARIANTS = {
  primary: { background: "var(--green)", color: "var(--text-on-accent)", border: "1px solid transparent" },
  dark: { background: "var(--surface-interactive)", color: "var(--text-base)", border: "1px solid transparent" },
  light: { background: "var(--surface-light)", color: "var(--text-on-light)", border: "1px solid transparent" },
  outlined: { background: "transparent", color: "var(--text-base)", border: "1px solid var(--border-strong)" },
  ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" },
  danger: { background: "var(--status-over-bg)", color: "var(--text-negative)", border: "1px solid var(--text-negative)" },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  caps = false,
  fullWidth = false,
  disabled = false,
  icon = null,
  iconAfter = null,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--space-8)",
        whiteSpace: "nowrap", flexShrink: 0,
        width: fullWidth ? "100%" : "auto",
        fontFamily: "var(--font-ui)", fontWeight: "var(--weight-bold)",
        lineHeight: caps ? "var(--leading-tight)" : "var(--leading-normal)",
        letterSpacing: caps ? "var(--tracking-caps)" : "var(--tracking-button)",
        textTransform: caps ? "uppercase" : "none",
        borderRadius: size === "lg" ? "var(--radius-pill)" : "var(--radius-full-pill)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: press && !disabled ? "scale(.97)" : "scale(1)",
        filter: hover && !disabled && (variant === "primary" || variant === "light") ? "brightness(1.08)" : "none",
        backgroundColor: hover && !disabled && (variant === "dark" || variant === "ghost" || variant === "outlined")
          ? "var(--surface-hover)" : undefined,
        transition: "transform var(--motion-fast) var(--ease-standard), background-color var(--motion-base) var(--ease-standard), filter var(--motion-base) var(--ease-standard)",
        ...v, ...s, ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconAfter}
    </button>
  );
}
