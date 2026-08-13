import * as React from "react";

/** Native select styled to match Input (inset ring, no visible border). */
export interface SelectProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Plain strings, or `{ value, label }` objects. */
  options?: Array<string | { value: string; label: string }>;
  label?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Select(props: SelectProps): JSX.Element;
