export interface SplitBillParticipant {
  id: number;
  splitBillId: number;
  name: string;
  avatar?: string | null;
  isPaid: boolean;
  paidAt: string | null;
}

export interface SplitBillItemShare {
  id: number;
  itemId: number;
  participantId: number;
  weight: number;
}

export interface SplitBillItem {
  id: number;
  splitBillId: number;
  description: string;
  amount: number;
  quantity: number;
  shares: SplitBillItemShare[];
}

export interface SplitBillListItem {
  id: number;
  publicSlug: string;
  ownerToken: string | null;
  restaurantName: string;
  billDate: string;
  taxAmount: number;
  taxPercent: number;
  serviceFeeAmount: number;
  servicePercent: number;
  discountAmount: number;
  discountPercent: number;
  deliveryFee: number;
  roundingUnit: number;
  taxAfterService: boolean;
  payerBankName: string | null;
  payerAccountNumber: string | null;
  payerAccountName: string | null;
  createdAt: string;
  participants: SplitBillParticipant[];
  items: SplitBillItem[];
}

export interface ParticipantTotal {
  participantId: number;
  name: string;
  avatar?: string | null;
  isPaid: boolean;
  paidAt: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  service: number;
  delivery: number;
  total: number;
  roundingDiff: number;
}

export interface SplitBillDetail extends SplitBillListItem {
  participantTotals: ParticipantTotal[];
}

export interface PublicSplitBillSummary {
  restaurantName: string;
  billDate: string;
  taxAmount: number;
  taxPercent: number;
  serviceFeeAmount: number;
  servicePercent: number;
  discountAmount: number;
  discountPercent: number;
  deliveryFee: number;
  roundingUnit: number;
  taxAfterService: boolean;
  payerBankName: string | null;
  payerAccountNumber: string | null;
  payerAccountName: string | null;
  items: {
    id: number;
    description: string;
    amount: number;
    quantity: number;
    shares: { participantId: number; weight: number }[];
  }[];
  participants: ParticipantTotal[];
}
