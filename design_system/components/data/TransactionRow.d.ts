import * as React from "react";

/** One parsed transaction: merchant, bank source, time, amount. Maps 1:1 to the API's transaction object. */
export interface TransactionRowProps {
  /** `transaction.description` — the merchant string parsed from the bank email. */
  description?: string;
  /** `transaction.amount` in rupiah; rendered with a leading minus. */
  amount?: number;
  /** `transaction.source` — "BCA" | "JAGO". */
  source?: string;
  /** ISO `transaction.occurredAt`; formatted to HH:mm. */
  occurredAt?: string;
  /** Pre-formatted clock string; overrides `occurredAt`. */
  time?: string;
  /** Replaces the monogram avatar (e.g. an `Icon`). */
  icon?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function TransactionRow(props: TransactionRowProps): JSX.Element;
