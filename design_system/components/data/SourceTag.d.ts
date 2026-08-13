import * as React from "react";

/** Bank-source chip. The only place in Trackster where a 2px/4px radius is allowed — tags read as data, not buttons. */
export interface SourceTagProps {
  /** `transaction.source` from the API — "BCA" or "JAGO" (case-insensitive). Unknown values render neutral. */
  source?: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}
export declare function SourceTag(props: SourceTagProps): JSX.Element;
