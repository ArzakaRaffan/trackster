export interface SplitInput {
  items: { id: number; price: number; qty: number; shares: { participantId: number; weight: number }[] }[];
  participants: { id: number; name: string }[];
  taxPercent?: number;        // e.g. 10 = 10%
  taxAmount?: number;         // alternatif nominal
  servicePercent?: number;    // e.g. 5
  serviceAmount?: number;
  discountAmount?: number;
  discountPercent?: number;
  deliveryFee?: number;       // dibagi rata
  roundingUnit?: 0 | 100 | 500 | 1000; // default 0
  taxAfterService?: boolean;  // default false
}

export interface ParticipantResult {
  participantId: number;
  subtotal: number;
  discount: number;
  tax: number;
  service: number;
  delivery: number;
  total: number;          // setelah rounding
  roundingDiff: number;   // positif = lebih bayar, negatif = kurang bayar
}

export function calculate(input: SplitInput): { participants: ParticipantResult[]; grandTotal: number; totalRoundingDiff: number } {
  const {
    items,
    participants,
    taxPercent = 0,
    taxAmount = 0,
    servicePercent = 0,
    serviceAmount = 0,
    discountAmount = 0,
    discountPercent = 0,
    deliveryFee = 0,
    roundingUnit = 0,
    taxAfterService = false,
  } = input;

  const participantResults = new Map<number, ParticipantResult>();

  // Initialize
  for (const p of participants) {
    participantResults.set(p.id, {
      participantId: p.id,
      subtotal: 0,
      discount: 0,
      tax: 0,
      service: 0,
      delivery: 0,
      total: 0,
      roundingDiff: 0,
    });
  }

  let totalSubtotal = 0;

  // Calculate Subtotal
  for (const item of items) {
    const itemTotal = item.price * item.qty;
    let totalWeight = 0;
    for (const share of item.shares) {
      totalWeight += share.weight;
    }

    if (totalWeight > 0) {
      for (const share of item.shares) {
        const shareAmount = itemTotal * (share.weight / totalWeight);
        const pRes = participantResults.get(share.participantId);
        if (pRes) {
          pRes.subtotal += shareAmount;
        }
      }
      totalSubtotal += itemTotal;
    }
  }

  let totalDiscount = discountAmount;
  if (discountPercent > 0) {
    totalDiscount += (totalSubtotal * discountPercent) / 100;
  }

  let totalService = serviceAmount;
  if (servicePercent > 0) {
    totalService += (totalSubtotal * servicePercent) / 100;
  }

  let baseForTax = totalSubtotal - totalDiscount;
  if (taxAfterService) {
    baseForTax += totalService;
  }

  let totalTax = taxAmount;
  if (taxPercent > 0) {
    totalTax += (baseForTax * taxPercent) / 100;
  }

  const numParticipants = participants.length;
  const deliveryPerPerson = numParticipants > 0 ? deliveryFee / numParticipants : 0;

  let maxTotalBeforeRounding = -1;
  let maxParticipantId = -1;
  let totalBeforeAnyRounding = 0;

  for (const p of participants) {
    const pRes = participantResults.get(p.id)!;
    const prop = totalSubtotal > 0 ? pRes.subtotal / totalSubtotal : 0;

    pRes.discount = totalDiscount * prop;
    pRes.service = totalService * prop;

    let pBaseForTax = pRes.subtotal - pRes.discount;
    if (taxAfterService) {
      pBaseForTax += pRes.service;
    }
    const propTax = baseForTax > 0 ? pBaseForTax / baseForTax : 0;
    pRes.tax = totalTax * propTax;
    
    pRes.delivery = deliveryPerPerson;

    const totalBeforeRounding = pRes.subtotal - pRes.discount + pRes.service + pRes.tax + pRes.delivery;
    pRes.total = totalBeforeRounding;
    
    totalBeforeAnyRounding += totalBeforeRounding;

    if (totalBeforeRounding > maxTotalBeforeRounding) {
      maxTotalBeforeRounding = totalBeforeRounding;
      maxParticipantId = p.id;
    }
  }

  let roundedGrandTotal = totalBeforeAnyRounding;
  if (roundingUnit > 0) {
    roundedGrandTotal = Math.round(totalBeforeAnyRounding / roundingUnit) * roundingUnit;
  }

  const roundingDiff = roundedGrandTotal - totalBeforeAnyRounding;

  for (const p of participants) {
    const pRes = participantResults.get(p.id)!;
    if (p.id === maxParticipantId) {
      pRes.roundingDiff = roundingDiff;
      pRes.total = pRes.total + roundingDiff;
    }
  }

  let grandTotal = 0;
  let totalRoundingDiff = 0;

  const results = Array.from(participantResults.values());
  for (const r of results) {
    grandTotal += r.total;
    totalRoundingDiff += r.roundingDiff;
  }

  return { participants: results, grandTotal, totalRoundingDiff };
}
