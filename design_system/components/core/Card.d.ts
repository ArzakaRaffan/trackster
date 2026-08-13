import * as React from "react";

/** Borderless dark container — the default surface for every grouped block. */
export interface CardProps {
  children?: React.ReactNode;
  /** `raised` #181818 (default), `alt` #252525, `flat` transparent, `outlined` hairline. */
  variant?: "raised" | "alt" | "flat" | "outlined";
  /** Inner padding in px (or any CSS length string). */
  padding?: number | string;
  radius?: "standard" | "comfortable" | "medium" | "panel";
  /** Lightens the surface on hover and sets a pointer cursor. */
  interactive?: boolean;
  /** Adds the medium card shadow. */
  elevated?: boolean;
  as?: keyof JSX.IntrinsicElements;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
