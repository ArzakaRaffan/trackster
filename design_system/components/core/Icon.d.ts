import * as React from "react";

/** Lucide icon by name. Intentional addition — the sources shipped no icon set, so Trackster standardises on Lucide (2px stroke). */
export interface IconProps {
  /** Lucide kebab-case name, e.g. "wallet", "trending-down", "bell". */
  name: string;
  /** Square px size. 16 inline, 20 default, 24 nav/hero. */
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
