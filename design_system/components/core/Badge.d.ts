import * as React from "react";

/** 10.5px pill label for status and counts. Tones map to Trackster's budget semantics. */
export interface BadgeProps {
  children?: React.ReactNode;
  /** `under` = on track, `near` = ≥80% spent, `over` = budget exceeded. */
  tone?: "neutral" | "under" | "near" | "over" | "info" | "accent";
  icon?: React.ReactNode;
  caps?: boolean;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
