'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { formatRupiah } from '@/lib/format';
import { calculateInstallment } from '@/lib/installment-math';
import { AlertTriangle, ArrowLeft, Info, PiggyBank } from 'lucide-react';

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function InstallmentCalculator() {
  const [price, setPrice] = useState('5000000');
  const [downPayment, setDownPayment] = useState('0');
  const [tenor, setTenor] = useState('6');
  const [monthlyRate, setMonthlyRate] = useState('2.95');
  const [adminFee, setAdminFee] = useState('0');
  const [upfrontFee, setUpfrontFee] = useState('0');
  const [latePenalty, setLatePenalty] = useState('0');

  const result = useMemo(
    () =>
      calculateInstallment({
        price: num(price),
        downPayment: num(downPayment),
        tenorMonths: Math.max(1, Math.round(num(tenor))),
        monthlyRatePercent: num(monthlyRate),
        adminFee: num(adminFee),
        upfrontFee: num(upfrontFee),
        latePenaltyPercent: num(latePenalty),
      }),
    [price, downPayment, tenor, monthlyRate, adminFee, upfrontFee, latePenalty],
  );

  const effective = result.effectiveAnnualRatePercent;

  return (
    <div className="pb-16 animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.9] px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-content items-center gap-3">
          <Link href="/tools" aria-label="Kembali ke tools" className="text-ink-muted hover:text-ink">
            <ArrowLeft size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Kalkulator</p>
            <h1 className="font-title text-title font-bold">PayLater & Cicilan</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
        <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <h2 className="text-heading font-bold">Barang yang mau dicicil</h2>
          <div className="flex gap-2">
            <Input label="Harga" type="number" inputMode="numeric" prefix="Rp" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Input label="DP / Uang muka" type="number" inputMode="numeric" prefix="Rp" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Input label="Tenor (bulan)" type="number" inputMode="numeric" value={tenor} onChange={(e) => setTenor(e.target.value)} />
            <Input label="Bunga flat/bulan (%)" type="number" inputMode="numeric" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Input label="Biaya admin/bulan" type="number" inputMode="numeric" prefix="Rp" value={adminFee} onChange={(e) => setAdminFee(e.target.value)} />
            <Input label="Biaya di muka" type="number" inputMode="numeric" prefix="Rp" value={upfrontFee} onChange={(e) => setUpfrontFee(e.target.value)} />
          </div>
          <Input
            label="Denda telat/bulan (%) (opsional)"
            type="number"
            inputMode="numeric"
            value={latePenalty}
            onChange={(e) => setLatePenalty(e.target.value)}
            hint="Persen dari cicilan per bulan. Cek ketentuan penyedia PayLater kamu."
          />
        </section>

        <section className="flex flex-col gap-3 rounded-card bg-surface p-4 lg:sticky lg:top-6">
          <h2 className="text-heading font-bold">Hasil</h2>

          <div className="rounded-medium bg-surface-interactive p-4 text-center">
            <p className="text-small text-ink-muted">Cicilan per bulan</p>
            <p className="mt-1 font-title text-amount font-black tracking-amount text-brand">
              {formatRupiah(result.monthlyInstallment)}
            </p>
            <p className="mt-1 text-small text-ink-muted">
              untuk {Math.max(1, Math.round(num(tenor)))} bulan
            </p>
          </div>

          <div className="flex flex-col gap-2 text-small">
            <Row label="Pokok (harga - DP)" value={formatRupiah(result.principal)} />
            <Row label="Total bunga" value={formatRupiah(result.totalInterest)} />
            <Row label="Total biaya admin" value={formatRupiah(result.totalAdmin)} />
            <Row label="Total yang dibayar" value={formatRupiah(result.totalPayment)} bold />
            <Row label="Biaya tambahan" value={formatRupiah(result.extraCost)} tone="over" />
          </div>

          <div className="rounded-medium bg-status-over-bg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-over" />
              <div>
                <p className="text-label font-bold text-status-over">Bunga efektif per tahun</p>
                <p className="mt-1 font-title text-title font-black text-status-over">
                  {effective !== null ? `${effective.toFixed(1)}%` : '—'}
                </p>
                <p className="mt-1 text-micro leading-relaxed text-ink-muted">
                  {num(monthlyRate) > 0
                    ? `Bunga flat ${num(monthlyRate)}%/bulan terasa kecil, tapi setara ${effective?.toFixed(1)}% per tahun karena bunga dihitung dari pokok awal, bukan sisa utang.`
                    : 'Tanpa bunga, biaya hanya dari admin/di muka.'}
                </p>
              </div>
            </div>
          </div>

          {result.latePenaltyPerMonth > 0 && (
            <div className="rounded-medium bg-status-near-bg p-4">
              <p className="text-label font-bold text-status-near">Denda telat: {formatRupiah(result.latePenaltyPerMonth)}/bulan</p>
              <p className="mt-1 text-micro text-ink-muted">Sekali telat = {formatRupiah(result.latePenaltyPerMonth)} ekstra. Telat 3 bulan = {formatRupiah(result.latePenaltyPerMonth * 3)}.</p>
            </div>
          )}

          {result.savings.savedAmount !== null && result.savings.savedAmount > 0 && (
            <div className="rounded-medium bg-status-under-bg p-4">
              <div className="flex items-start gap-2">
                <PiggyBank size={16} className="mt-0.5 shrink-0 text-status-under" />
                <div>
                  <p className="text-label font-bold text-status-under">Nabung dulu lebih hemat</p>
                  <p className="mt-1 text-small leading-relaxed text-ink-muted">
                    Sisihkan cicilan {formatRupiah(result.monthlyInstallment)}/bulan ({formatRupiah(Math.round(result.savings.weeklySavings))}/minggu) selama{' '}
                    {result.savings.saveMonths} bulan → barang kebeli dan hemat{' '}
                    <span className="font-bold text-status-under">{formatRupiah(result.savings.savedAmount)}</span>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="mx-auto mt-6 flex max-w-content items-start gap-2 px-4 text-micro leading-relaxed text-ink-subtle">
        <Info size={12} className="mt-0.5 shrink-0" />
        Angka bunga efektif dihitung dengan metode IRR (internal rate of return) dan bisa beda tipis dari kalkulator resmi.
        Angka ini edukasi, bukan penawaran kredit.
      </p>
    </div>
  );
}

function Row({ label, value, bold = false, tone }: { label: string; value: string; bold?: boolean; tone?: 'over' }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line-subtle pb-2 last:border-b-0 last:pb-0">
      <span className="text-ink-muted">{label}</span>
      <span className={`tabular-nums ${tone === 'over' ? 'font-bold text-status-over' : bold ? 'font-bold text-ink' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  );
}
