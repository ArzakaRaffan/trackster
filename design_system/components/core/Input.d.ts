import * as React from "react";

/** Recessed dark field using the inset border-shadow combo; focus swaps the inset ring to green. */
export interface InputProps {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  /** Uppercase 12px caption above the field. */
  label?: string;
  type?: string;
  /** Leading node — icon or a currency prefix like "Rp". */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  /** 500px pill radius — use for search fields. */
  pill?: boolean;
  /** Helper or error text below the field. */
  hint?: string;
  style?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
