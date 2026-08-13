import * as React from "react";

/** Compact metric tile for 2–3-up summary grids (weekly totals, averages, streaks). */
export interface StatTileProps {
  /** Uppercase 12px caption. */
  label?: string;
  value?: number | string;
  /** Percent change vs previous period. Positive = spending up = red. */
  delta?: number;
  /** Figure size step — use "heading" (18px) in 3-up rows; "title" (24px) stands alone. */
  size?: "title" | "heading" | "body";
  tone?: "base" | "under" | "near" | "over" | "muted";
  /** `currency` formats to Rupiah; `raw` prints the value as given. */
  format?: "currency" | "raw";
  /** Abbreviate large rupiah figures (Rp1,2jt). Default true. */
  compact?: boolean;
  style?: React.CSSProperties;
}
export declare function StatTile(props: StatTileProps): JSX.Element;
