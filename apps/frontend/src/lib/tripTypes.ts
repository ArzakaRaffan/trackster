export interface TripMemberSummary {
  id: number;
  name: string;
  avatar?: string | null;
}

export interface TripExpenseSummary {
  id: number;
  description: string;
  amount: number;
  date: string;
  paidByMemberId: number;
  shares: { memberId: number; weight: number }[];
}

export interface TripBalance {
  memberId: number;
  name: string;
  net: number;
}

export interface TripSettlement {
  fromMemberId: number;
  fromName: string;
  toMemberId: number;
  toName: string;
  amount: number;
}

export interface TripSummary {
  id: number;
  publicSlug: string;
  ownerToken: string | null;
  name: string;
  currency: string;
  createdAt: string;
  totalSpent: number;
  members: TripMemberSummary[];
  expenses: TripExpenseSummary[];
  balances: TripBalance[];
  settlements: TripSettlement[];
}
