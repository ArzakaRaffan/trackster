import * as React from "react";

/** Rupiah figure with optional uppercase label and caption. Tabular numerals, title font. */
export interface AmountDisplayProps {
  /** Raw number from the API (rupiah, not cents). Negative renders with a minus. */
  value: number;
  /** `hero` 56px is the one-per-screen money headline. */
  size?: "hero" | "large" | "title" | "body" | "small";
  tone?: "base" | "muted" | "under" | "near" | "over";
  /** Uppercase 12px label above the figure. */
  label?: string;
  /** Abbreviate to "rb"/"jt" — for chart axes and dense lists. */
  compact?: boolean;
  /** Force a leading + / −. */
  sign?: boolean;
  /** 14px muted line under the figure. */
  caption?: string;
  style?: React.CSSProperties;
}
export declare function AmountDisplay(props: AmountDisplayProps): JSX.Element;
