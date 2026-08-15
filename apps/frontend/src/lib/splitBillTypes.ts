export interface SplitBillParticipant {
  id: number;
  splitBillId: number;
  name: string;
  isPaid: boolean;
  paidAt: string | null;
}

export interface SplitBillItem {
  id: number;
  splitBillId: number;
  description: string;
  amount: number;
  quantity?: number;
  participantId: number | null;
}

export interface SplitBillListItem {
  id: number;
  publicSlug: string;
  restaurantName: string;
  billDate: string;
  taxAmount: number;
  serviceFeeAmount: number;
  createdAt: string;
  payerName?: string | null;
  payerBank?: string | null;
  payerAccountNumber?: string | null;
  payerContact?: string | null;
  participants: SplitBillParticipant[];
  items: SplitBillItem[];
}

export interface ParticipantTotal {
  id: number;
  name: string;
  isPaid: boolean;
  paidAt: string | null;
  itemsTotal: number;
  taxShare: number;
  serviceFeeShare: number;
  totalOwed: number;
}

export interface SplitBillDetail extends SplitBillListItem {
  participantTotals: ParticipantTotal[];
}

export interface PublicSplitBillSummary {
  restaurantName: string;
  billDate: string;
  taxAmount: number;
  serviceFeeAmount: number;
  payerName?: string | null;
  payerBank?: string | null;
  payerAccountNumber?: string | null;
  payerContact?: string | null;
  items: {
    id: number;
    description: string;
    amount: number;
    quantity?: number;
    participantId: number | null;
    participantName: string | null;
  }[];
  participants: ParticipantTotal[];
}
