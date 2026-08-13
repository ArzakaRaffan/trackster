import * as React from "react";

/** Inline status banner — over-budget warnings, sync notices, Telegram-alert confirmations. */
export interface AlertProps {
  tone?: "over" | "near" | "under" | "info";
  /** Bold 14px headline in the tone colour. */
  title?: string;
  /** 12px body copy. */
  children?: React.ReactNode;
  icon?: React.ReactNode;
  /** Trailing control, usually a ghost/outlined `Button`. */
  action?: React.ReactNode;
  /** Renders a ✕ dismiss control when provided. */
  onDismiss?: () => void;
  style?: React.CSSProperties;
}
export declare function Alert(props: AlertProps): JSX.Element;
