import * as React from "react";

/** Pill toggle for settings rows; on-state is green with a black knob. */
export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  /** Bold 16px row label. */
  label?: string;
  /** 12px muted explainer under the label. */
  description?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Switch(props: SwitchProps): JSX.Element;
