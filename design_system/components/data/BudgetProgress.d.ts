import * as React from "react";

/** Daily-budget bar. Colour is derived from spend ratio: green → orange ≥80% → red over budget. */
export interface BudgetProgressProps {
  /** `totalSpent` from GET /budget/today. */
  spent?: number;
  /** `budget` from GET /budget/today. */
  budget?: number;
  /** Pass the API's `isOverBudget` to let the server win over the local ratio. */
  isOverBudget?: boolean;
  /** Bar thickness in px. 10 default, 6 in compact lists, 16 on the hero. */
  height?: number;
  /** Show the "x% terpakai / Rp… sisa" line under the bar. */
  showLegend?: boolean;
  /** Ratio at which the bar turns orange. Default 0.8. */
  nearThreshold?: number;
  style?: React.CSSProperties;
}
export declare function BudgetProgress(props: BudgetProgressProps): JSX.Element;
