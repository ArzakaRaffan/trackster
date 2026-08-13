import React from "react";

export function IconButton({
  children,
  variant = "dark",
  size = 40,
  label,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const palette = {
    dark: { background: "var(--surface-interactive)", color: "var(--text-base)" },
    accent: { background: "var(--green)", color: "var(--text-on-accent)" },
    ghost: { background: "transparent", color: "var(--text-muted)" },
    outlined: { background: "transparent", color: "var(--text-base)", boxShadow: "inset 0 0 0 1px var(--border-strong)" },
  }[variant];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        width: size, height: size, flex: "0 0 auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-circle)", border: "none", padding: 0,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        transform: press && !disabled ? "scale(.94)" : hover && !disabled ? "scale(1.05)" : "scale(1)",
        filter: hover && !disabled && variant === "accent" ? "brightness(1.08)" : "none",
        transition: "transform var(--motion-fast) var(--ease-standard), filter var(--motion-base) var(--ease-standard), color var(--motion-base) var(--ease-standard)",
        ...palette,
        color: hover && !disabled && variant === "ghost" ? "var(--text-base)" : palette.color,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
