import React from "react";
import { Icon } from "../core/Icon.jsx";

const DEFAULT_ITEMS = [
  { href: "/", label: "Hari Ini", icon: "sun" },
  { href: "/weekly", label: "Mingguan", icon: "bar-chart-3" },
  { href: "/budget", label: "Budget", icon: "wallet" },
  { href: "/settings", label: "Setting", icon: "settings" },
];

export function NavBar({ items = DEFAULT_ITEMS, active = "/", onNavigate, orientation = "bottom", style, ...rest }) {
  const bottom = orientation === "bottom";
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: bottom ? "row" : "column",
        alignItems: bottom ? "stretch" : "stretch",
        gap: bottom ? 0 : "var(--space-4)",
        background: bottom ? "rgba(18,18,18,.92)" : "var(--surface-base)",
        backdropFilter: bottom ? "var(--blur-overlay)" : "none",
        WebkitBackdropFilter: bottom ? "var(--blur-overlay)" : "none",
        boxShadow: bottom ? "inset 0 1px 0 var(--border-subtle)" : "none",
        padding: bottom ? "8px 8px calc(8px + env(safe-area-inset-bottom,0px))" : "var(--space-12)",
        width: bottom ? "100%" : "var(--sidebar-width)",
        ...style,
      }}
      {...rest}
    >
      {items.map((it) => {
        const on = it.href === active;
        return (
          <a
            key={it.href}
            href={it.href}
            onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate(it.href); } : undefined}
            style={{
              flex: bottom ? 1 : "0 0 auto",
              display: "flex",
              flexDirection: bottom ? "column" : "row",
              alignItems: "center",
              justifyContent: bottom ? "center" : "flex-start",
              gap: bottom ? "var(--space-4)" : "var(--space-12)",
              minHeight: 48, padding: bottom ? "6px 4px" : "10px 12px",
              borderRadius: bottom ? "var(--radius-comfortable)" : "var(--radius-subtle)",
              color: on ? "var(--text-base)" : "var(--text-muted)",
              background: !bottom && on ? "var(--surface-hover)" : "transparent",
              fontSize: "var(--text-label)",
              fontWeight: on ? "var(--weight-bold)" : "var(--weight-regular)",
              textDecoration: "none",
              transition: "color var(--motion-base) var(--ease-standard)",
            }}
          >
            <Icon name={it.icon} size={bottom ? 20 : 18} />
            <span style={{ fontSize: bottom ? "var(--text-micro)" : "var(--text-label)", letterSpacing: bottom ? ".2px" : "normal" }}>{it.label}</span>
            {bottom && on ? (
              <span style={{ width: 4, height: 4, borderRadius: "var(--radius-circle)", background: "var(--green)" }} />
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
