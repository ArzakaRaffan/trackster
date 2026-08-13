import * as React from "react";

export interface NavItem {
  /** Route path, e.g. "/weekly". */
  href: string;
  label: string;
  /** Lucide icon name. */
  icon: string;
}

/** Trackster's four-route navigation — blurred bottom bar on mobile, sidebar list on desktop. */
export interface NavBarProps {
  /** Defaults to Hari Ini / Mingguan / Budget / Setting. */
  items?: NavItem[];
  /** Current route path. */
  active?: string;
  /** Intercepts clicks (use with Next's router; omit to let the `<a href>` navigate). */
  onNavigate?: (href: string) => void;
  orientation?: "bottom" | "side";
  style?: React.CSSProperties;
}
export declare function NavBar(props: NavBarProps): JSX.Element;
