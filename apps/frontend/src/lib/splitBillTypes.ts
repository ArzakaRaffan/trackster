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
  hasReceipt?: boolean;
  equalFees?: boolean;
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

/** Respons POST /split-bills/scan-receipt. Biaya = nominal Rupiah dari struk, 0 kalau tidak ada. */
export interface ScanResult {
  items: { description: string; amount: number; quantity: number }[];
  subtotal?: number;
  tax?: number;
  service?: number;
  discount?: number;
}

type BillForText = Pick<PublicSplitBillSummary, 'restaurantName' | 'payerBankName' | 'payerAccountNumber' | 'payerAccountName'> & {
  items: { description: string; quantity: number; shares: { participantId: number }[] }[];
};

/** Pesan tagihan untuk SATU orang (dikirim lewat wa.me), berisi item pesanannya, total, rekening, dan link. */
export function personBillText(bill: BillForText, p: ParticipantTotal, link: string, rupiah: (n: number) => string): string {
  const mine = bill.items.filter((i) => i.shares.some((s) => s.participantId === p.participantId));
  let text = `Halo ${p.name}, ini tagihan *${bill.restaurantName}* kamu:\n\n`;
  for (const i of mine) {
    const shared = i.shares.length > 1 ? ` (bagi ${i.shares.length})` : '';
    text += `• ${i.description}${i.quantity > 1 ? ` ×${i.quantity}` : ''}${shared}\n`;
  }
  text += `${mine.length ? '\n' : ''}*Total: ${rupiah(p.total)}*\n`;
  if (p.tax + p.service + p.delivery > 0 || p.discount > 0) text += '(sudah termasuk pajak/service/diskon)\n';
  if (bill.payerAccountNumber) {
    text += `\nTransfer ke ${[bill.payerBankName, bill.payerAccountNumber].filter(Boolean).join(' ')}`;
    if (bill.payerAccountName) text += ` a.n ${bill.payerAccountName}`;
    text += '\n';
  }
  return text + `\nDetail & tandai lunas: ${link}`;
}

/** Buka WhatsApp dengan teks terisi (pilih kontak di WA; nomor peserta tidak disimpan). */
export const openWa = (text: string) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
