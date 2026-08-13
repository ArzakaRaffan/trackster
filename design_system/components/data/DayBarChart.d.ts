import * as React from "react";

export interface DayBarDatum {
  /** Short axis label, e.g. "Sen". */
  label: string;
  spent: number;
  budget?: number;
  isOverBudget?: boolean;
}

/** Seven-day spend bars with a dashed daily-budget line. Over-budget days turn red. */
export interface DayBarChartProps {
  days?: DayBarDatum[];
  /** Plot height in px (excludes labels). */
  height?: number;
  onSelect?: (day: DayBarDatum, index: number) => void;
  /** Highlights a bar green — pass the day's `label` or its index. */
  selected?: string | number;
  style?: React.CSSProperties;
}
export declare function DayBarChart(props: DayBarChartProps): JSX.Element;
