import { Prisma } from '@prisma/client';

type Num = Prisma.Decimal | number | string | null | undefined;

/**
 * Pengeluaran efektif sebuah transaksi = nominal bruto (uang keluar dari bank) dikurangi patungan
 * yang SUDAH diterima (Reimbursement RECEIVED). Semua angka "pengeluaran" (budget, mingguan,
 * analisis, laporan) pakai ini — `amount` mentah cuma buat saldo bank & tampilan bruto.
 */
export const spend = (t: { amount: Num; reimbursedAmount?: Num }) => Number(t.amount) - Number(t.reimbursedAmount ?? 0);

/** Sama seperti spend() tapi untuk hasil `_sum: { amount: true, reimbursedAmount: true }`. */
export const sumSpend = (s: { amount?: Num; reimbursedAmount?: Num } | null | undefined) =>
  Number(s?.amount ?? 0) - Number(s?.reimbursedAmount ?? 0);

/** Salinan baris dengan `amount` diganti nominal efektif — buat kode statistik yang membaca `t.amount` di banyak tempat. */
export const toNet = <T extends { amount: Prisma.Decimal; reimbursedAmount: Prisma.Decimal }>(t: T): T => ({
  ...t,
  amount: t.amount.minus(t.reimbursedAmount),
});
