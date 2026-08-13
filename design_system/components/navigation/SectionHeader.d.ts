import * as React from "react";

/** 18px semibold section label with optional right-aligned count and action. */
export interface SectionHeaderProps {
  title?: React.ReactNode;
  /** Muted 12px counter, e.g. "8 transaksi". */
  meta?: string;
  /** Trailing control — usually a small ghost `Button`. */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function SectionHeader(props: SectionHeaderProps): JSX.Element;
