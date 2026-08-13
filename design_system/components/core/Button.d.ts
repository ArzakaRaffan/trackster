import * as React from "react";

/** Pill button. Primary = green with black label; dark/outlined/ghost for secondary actions. */
export interface ButtonProps {
  children?: React.ReactNode;
  /** Visual role. Green `primary` is functional only — play/confirm/primary CTA. */
  variant?: "primary" | "dark" | "light" | "outlined" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Uppercase + 1.4px tracking — the systematic "label voice". */
  caps?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconAfter?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
