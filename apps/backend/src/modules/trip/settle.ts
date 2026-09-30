// Settle-up minimal transfer (E08-S4). Fungsi murni: terima saldo bersih per anggota,
// hasilkan daftar transfer seminimal mungkin (maks n-1). Greedy match: yang paling
// banyak hutang bayar ke yang paling banyak piutang, diulang sampai semua bersih.
// ponytail: O(n² log n) per iterasi; cukup untuk trip < 100 anggota, upgrade ke
// subset-sum hanya kalau pernah ada trip sebesar itu.

export interface MemberBalance {
  memberId: number;
  name: string;
  net: number; // positif = harus terima, negatif = harus bayar
}

export interface Transfer {
  fromMemberId: number;
  fromName: string;
  toMemberId: number;
  toName: string;
  amount: number;
}

const EPS = 0.005; // toleransi pembulatan ke rupiah terdekat

export function settle(balances: MemberBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.net < -EPS)
    .map((b) => ({ ...b, net: Math.abs(b.net) }))
    .sort((a, b) => b.net - a.net);

  const creditors = balances
    .filter((b) => b.net > EPS)
    .sort((a, b) => b.net - a.net);

  const transfers: Transfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0];
    const creditor = creditors[creditors.length - 1];

    const amount = Math.min(debtor.net, creditor.net);
    if (amount <= EPS) break;

    transfers.push({
      fromMemberId: debtor.memberId,
      fromName: debtor.name,
      toMemberId: creditor.memberId,
      toName: creditor.name,
      amount: Math.round(amount),
    });

    debtor.net -= amount;
    creditor.net -= amount;

    if (debtor.net <= EPS) debtors.shift();
    if (creditor.net <= EPS) creditors.pop();
  }

  return transfers;
}
