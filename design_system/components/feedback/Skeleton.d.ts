import * as React from "react";

/** Shimmering placeholder for SWR's loading pass. Requires the `tk-shimmer` keyframes from styles.css. */
export interface SkeletonProps {
  /** Any CSS width. Also sets the diameter when `circle`. */
  width?: number | string;
  height?: number | string;
  radius?: "minimal" | "subtle" | "standard" | "comfortable" | "pill";
  circle?: boolean;
  style?: React.CSSProperties;
}
export declare function Skeleton(props: SkeletonProps): JSX.Element;
