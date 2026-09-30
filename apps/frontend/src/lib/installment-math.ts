// Matematika PayLater/Cicilan (E08-S3) — fungsi murni tanpa dependency.
// Bunga flat: bunga dihitung dari pokok awal × tenor, bukan saldo menurun.
// "Bunga efektif per tahun" = IRR tahunan (Newton-Raphson), biar kelihatan
// flat 2,95%/bulan itu jauh di atas 35%/tahun efektif.

export interface InstallmentInput {
  price: number;            // harga barang
  downPayment: number;      // DP (0 kalau tidak ada)
  tenorMonths: number;      // lama cicilan (bulan)
  monthlyRatePercent: number; // bunga flat per bulan, dalam persen (mis. 2.95)
  adminFee: number;         // biaya admin per bulan (opsional)
  upfrontFee: number;       // biaya di muka sekali (opsional)
  latePenaltyPercent?: number; // denda keterlambatan per bulan (% dari cicilan)
}

export interface InstallmentResult {
  principal: number;        // pokok yang dicicil = price - DP
  monthlyInstallment: number; // pokok/bulan + bunga flat/bulan + admin
  totalInterest: number;
  totalAdmin: number;
  totalPayment: number;     // DP + semua cicilan + biaya muka
  extraCost: number;        // totalPayment - price (biaya tambahan)
  effectiveAnnualRatePercent: number | null; // IRR tahunan, null kalau tidak terdefinisi
  monthlyRateEffectivePercent: number | null;
  latePenaltyPerMonth: number;
  savings: {
    weeklySavings: number;
    saveMonths: number;
    totalPaidBySavings: number | null;
    savedAmount: number | null;
  };
}

// Arus kas dari sudut pandang peminjam (tanda dibalik vs lembaga pembiayaan):
// bulan 0 = terima pokok (positif), bulan 1..tenor = bayar cicilan (negatif).
function cashFlows(input: InstallmentInput): { t: number; v: number }[] {
  const principal = Math.max(0, input.price - input.downPayment);
  const tenor = Math.max(1, input.tenorMonths);
  const monthlyInterest = (principal * input.monthlyRatePercent) / 100;
  const installment = principal / tenor + monthlyInterest + input.adminFee;

  const flows = [{ t: 0, v: principal - input.upfrontFee }];
  for (let m = 1; m <= tenor; m++) {
    flows.push({ t: m, v: -installment });
  }
  return flows;
}

function npv(rate: number, flows: { t: number; v: number }[]): number {
  return flows.reduce((sum, f) => sum + f.v / Math.pow(1 + rate, f.t), 0);
}

function npvDerivative(rate: number, flows: { t: number; v: number }[]): number {
  return flows.reduce((sum, f) => sum + (-f.t * f.v) / Math.pow(1 + rate, f.t + 1), 0);
}

// IRR bulanan via Newton-Raphson, fallback bisection kalau Newton nggak konvergen.
// NPV pinjaman monoton naik terhadap rate: NPV(0) negatif (total bayar > pokok),
// NPV(∞) positif, jadi akar positif selalu ada untuk pinjaman normal.
export function monthlyIrr(flows: { t: number; v: number }[], guess = 0.05, maxIter = 100): number | null {
  // Newton
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    const f = npv(rate, flows);
    const df = npvDerivative(rate, flows);
    if (Math.abs(df) < 1e-9) break;
    const next = rate - f / df;
    if (Math.abs(next - rate) < 1e-10) return next;
    if (next <= -1 || !Number.isFinite(next)) break;
    rate = next;
  }

  // Fallback: bisection di [0, 10] (0%–1000%/bulan)
  let lo = 0;
  let hi = 10;
  let fLo = npv(lo, flows);
  if (Math.abs(fLo) < 1e-9) return 0;
  let fHi = npv(hi, flows);
  if (Math.abs(fHi) < 1e-9) return hi;
  if (fLo * fHi > 0) return null; // tidak ada akar di range

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1e-9 || hi - lo < 1e-12) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

const monthlyToAnnual = (m: number) => (Math.pow(1 + m, 12) - 1) * 100;

export function calculateInstallment(input: InstallmentInput): InstallmentResult {
  const principal = Math.max(0, input.price - input.downPayment);
  const tenor = Math.max(1, input.tenorMonths);
  const monthlyInterest = (principal * input.monthlyRatePercent) / 100;
  const monthlyInstallment = principal / tenor + monthlyInterest + input.adminFee;

  // Uang ditampilkan bulat ke rupiah; dibulatkan di sini (bukan cuma di format) biar
  // total-total di UI dan self-check konsisten, nggak kena noise float pembagian 1/3 dst.
  const totalInterest = Math.round(monthlyInterest * tenor);
  const totalAdmin = Math.round(input.adminFee * tenor);
  const totalPayment = Math.round(input.downPayment + input.upfrontFee + monthlyInstallment * tenor);

  const flows = cashFlows({ ...input, tenorMonths: tenor });
  const irr = monthlyIrr(flows);

  const latePenaltyPerMonth =
    Math.round(((input.latePenaltyPercent ?? 0) / 100) * monthlyInstallment);

  // "Kalau nabung dulu" — setara dengan ability mode di tabungan: nabung sebesar
  // cicilan per bulan, berapa bulan sampai harga kebeli tanpa bunga.
  const monthlySavingTarget = input.price;
  const saveMonths = monthlyInstallment > 0 ? Math.ceil(monthlySavingTarget / monthlyInstallment) : Infinity;
  const totalPaidBySavings = Number.isFinite(saveMonths) ? saveMonths * monthlyInstallment : null;
  const savedAmount =
    totalPaidBySavings !== null ? Math.max(0, totalPayment - totalPaidBySavings) : null;

  return {
    principal,
    monthlyInstallment,
    totalInterest,
    totalAdmin,
    totalPayment,
    extraCost: totalPayment - input.price,
    effectiveAnnualRatePercent: irr !== null ? monthlyToAnnual(irr) : null,
    monthlyRateEffectivePercent: irr !== null ? irr * 100 : null,
    latePenaltyPerMonth,
    // "Kalau nabung dulu" — nabung sebesar cicilan per bulan, berapa bulan sampai harga
    // kebeli tanpa bunga (bunga tabungan diabaikan, cukup buat bandingan kasar).
    savings: {
      weeklySavings: monthlyInstallment / 4.345,
      saveMonths,
      totalPaidBySavings,
      savedAmount,
    },
  };
}
