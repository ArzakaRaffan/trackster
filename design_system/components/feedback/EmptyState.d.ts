import * as React from "react";

/** Hairline-outlined placeholder for "no transactions yet" / "no budget set". */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
