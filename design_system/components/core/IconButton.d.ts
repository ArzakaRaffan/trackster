import * as React from "react";

/** Circular icon-only control (50% radius) — play/add/close/back. Always pass `label`. */
export interface IconButtonProps {
  children?: React.ReactNode;
  variant?: "dark" | "accent" | "ghost" | "outlined";
  /** Diameter in px. 40 default, 32 compact, 56 hero FAB. */
  size?: number;
  /** Accessible name (rendered as aria-label + title). */
  label: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
