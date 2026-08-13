import * as React from "react";

/** Sticky, blurred screen header: uppercase eyebrow + 24px title + right-side actions. */
export interface TopBarProps {
  title?: React.ReactNode;
  /** Uppercase eyebrow above the title — usually the date ("Rabu, 12 Agustus"). */
  subtitle?: string;
  /** Leading slot — back button or avatar. */
  leading?: React.ReactNode;
  /** Right-side slot — `IconButton`s. */
  actions?: React.ReactNode;
  /** Sticky + translucent blur. Default true. */
  sticky?: boolean;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): JSX.Element;
