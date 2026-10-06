'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatRupiah } from '@/lib/format';
import { calculateInstallment, InstallmentInput } from '@/lib/installment-math';
import ThemeToggle from '@/components/legal/ThemeToggle';
import { Field, Kv } from '@/components/pub/ui';

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const TENORS = [3, 6, 12, 18, 24];

export function InstallmentCalculator() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [price, setPrice] = useState('5000000');
  const [downPayment, setDownPayment] = useState('0');
  const [tenor, setTenor] = useState('6');
  const [monthlyRate, setMonthlyRate] = useState('2.95');
  const [adminFee, setAdminFee] = useState('0');
  const [upfrontFee, setUpfrontFee] = useState('0');
  const [latePenalty, setLatePenalty] = useState('0');
  const [copied, setCopied] = useState(false);

  // Baca state dari link share, sekali.
  useEffect(() => {
    if (ready) return;
    const g = (k: string, set: (v: string) => void) => {
      const v = searchParams.get(k);
      if (v !== null && Number.isFinite(parseFloat(v))) set(v);
    };
    g('p', setPrice);
    g('dp', setDownPayment);
    g('t', setTenor);
    g('r', setMonthlyRate);
    g('a', setAdminFee);
    g('u', setUpfrontFee);
    g('l', setLatePenalty);
    setReady(true);
  }, [searchParams, ready]);

  // Tulis balik ke URL biar hasilnya bisa dibagikan.
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams({ p: price, dp: downPayment, t: tenor, r: monthlyRate, a: adminFee, u: upfrontFee, l: latePenalty });
    window.history.replaceState(null, '', `?${p.toString()}`);
  }, [ready, price, downPayment, tenor, monthlyRate, adminFee, upfrontFee, latePenalty]);

  const tenorN = Math.max(1, Math.round(num(tenor)));
  const input: InstallmentInput = useMemo(
    () => ({
      price: num(price),
      downPayment: num(downPayment),
      tenorMonths: tenorN,
      monthlyRatePercent: num(monthlyRate),
      adminFee: num(adminFee),
      upfrontFee: num(upfrontFee),
      latePenaltyPercent: num(latePenalty),
    }),
    [price, downPayment, tenorN, monthlyRate, adminFee, upfrontFee, latePenalty],
  );
  const result = useMemo(() => calculateInstallment(input), [input]);
  const effective = result.effectiveAnnualRatePercent;
  const extraPct = input.price > 0 ? (result.extraCost / input.price) * 100 : 0;

  // Jadwal bunga flat: pokok & bunga sama tiap bulan.
  const schedule = useMemo(() => {
    const perPrincipal = result.principal / tenorN;
    const perInterest = (result.principal * num(monthlyRate)) / 100;
    return Array.from({ length: tenorN }, (_, i) => ({
      m: i + 1,
      principal: perPrincipal,
      interest: perInterest,
      admin: num(adminFee),
      total: result.monthlyInstallment,
      left: Math.max(0, result.principal - perPrincipal * (i + 1)),
    }));
  }, [result, tenorN, monthlyRate, adminFee]);

  // Perbandingan tenor dengan input lain sama.
  const byTenor = useMemo(() => {
    const list = Array.from(new Set([...TENORS, tenorN])).sort((a, b) => a - b);
    return list.map((t) => ({ t, r: calculateInstallment({ ...input, tenorMonths: t }) }));
  }, [input, tenorN]);
  const cheapest = Math.min(...byTenor.map((x) => x.r.extraCost));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard gagal, abaikan
    }
  };

  return (
    <main className="pb wide">
      <div className="pb-top">
        <Link href="/tools">← Semua tools</Link>
        <ThemeToggle />
      </div>

      <div className="pb-cols">
        <article className="pb-receipt" style={{ paddingBottom: 18 }}>
          <div className="pb-mono">Trackster · Kalkulator</div>
          <h1>PayLater & cicilan</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-subtle)' }}>Lihat total yang benar-benar dibayar dan bunga efektif per tahun.</p>
          <hr />

          <div className="pb-2">
            <Field label="Harga" prefix="Rp" type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Field label="DP / uang muka" prefix="Rp" type="number" inputMode="numeric" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
          </div>

          <div className="pb-f">
            <span className="pb-mono">Tenor</span>
            <div className="pb-aff">
              <input type="number" inputMode="numeric" min={1} value={tenor} onChange={(e) => setTenor(e.target.value)} aria-label="Tenor (bulan)" />
              <span>bulan</span>
            </div>
            <div className="pb-pills">
              {TENORS.map((t) => (
                <button key={t} type="button" className="pb-pill" aria-pressed={tenorN === t} onClick={() => setTenor(String(t))}>
                  {t} bln
                </button>
              ))}
            </div>
          </div>

          <div className="pb-2">
            <Field label="Bunga flat / bulan" suffix="%" type="number" inputMode="decimal" step="0.01" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} />
            <Field label="Biaya admin / bulan" prefix="Rp" type="number" inputMode="numeric" value={adminFee} onChange={(e) => setAdminFee(e.target.value)} />
            <Field label="Biaya di muka" prefix="Rp" type="number" inputMode="numeric" value={upfrontFee} onChange={(e) => setUpfrontFee(e.target.value)} />
            <Field label="Denda telat / bulan" suffix="%" type="number" inputMode="decimal" value={latePenalty} onChange={(e) => setLatePenalty(e.target.value)} hint="Persen dari cicilan. Cek ketentuan penyedianya." />
          </div>
        </article>

        <aside className="pb-sticky">
          <div className="pb-receipt" style={{ paddingBottom: 18 }}>
            <div className="pb-hero">
              <div className="lbl">Cicilan per bulan</div>
              <div className="val">{formatRupiah(result.monthlyInstallment)}</div>
              <div className="sub">untuk {tenorN} bulan</div>
            </div>
            <hr />
            <Kv label="Pokok (harga − DP)" value={formatRupiah(result.principal)} />
            <Kv label="Total bunga" value={formatRupiah(result.totalInterest)} />
            <Kv label="Total biaya admin" value={formatRupiah(result.totalAdmin)} />
            <Kv label="Total yang dibayar" value={formatRupiah(result.totalPayment)} hl />
            <Kv label={`Biaya tambahan (${extraPct.toFixed(1)}% dari harga)`} value={formatRupiah(result.extraCost)} bad />

            <div className="pb-note bad">
              <span className="pb-mono" style={{ display: 'block', color: 'var(--danger-text)', marginBottom: 2 }}>
                Bunga efektif per tahun
              </span>
              <b>{effective !== null ? `${effective.toFixed(1)}%` : '—'}</b>
              {num(monthlyRate) > 0
                ? `Flat ${num(monthlyRate)}%/bulan terasa kecil, tapi setara ${effective?.toFixed(1)}% per tahun karena bunga dihitung dari pokok awal, bukan sisa utang.`
                : 'Tanpa bunga, biaya hanya dari admin atau biaya di muka.'}
            </div>

            {result.latePenaltyPerMonth > 0 && (
              <div className="pb-note warn">
                <b>Denda telat: {formatRupiah(result.latePenaltyPerMonth)}/bulan</b>
                Telat 3 bulan = {formatRupiah(result.latePenaltyPerMonth * 3)} ekstra.
              </div>
            )}

            {result.savings.savedAmount !== null && result.savings.savedAmount > 0 && (
              <div className="pb-note ok">
                <b>Nabung dulu lebih hemat</b>
                Sisihkan {formatRupiah(result.monthlyInstallment)}/bulan ({formatRupiah(Math.round(result.savings.weeklySavings))}/minggu) selama {result.savings.saveMonths} bulan, barang kebeli dan kamu hemat{' '}
                <strong>{formatRupiah(result.savings.savedAmount)}</strong>.
              </div>
            )}

            <div className="pb-actions">
              <button type="button" className="pb-btn" onClick={copyLink}>
                {copied ? 'Link tersalin ✓' : 'Salin link hasil'}
              </button>
            </div>
          </div>
          <div className="pb-tear" />
        </aside>
      </div>

      <section className="pb-receipt" style={{ marginTop: 20, paddingBottom: 14 }}>
        <h2 style={{ margin: '0 0 6px' }}>Bandingin tenor</h2>
        <p className="pb-help" style={{ margin: '0 0 10px' }}>Bunga, admin, dan DP sama. Tenor lebih panjang = cicilan ringan tapi total lebih mahal.</p>
        <div className="pb-tblw">
          <table className="pb-tbl">
            <thead>
              <tr>
                <th>Tenor</th>
                <th>Cicilan/bln</th>
                <th>Biaya tambahan</th>
                <th>Efektif/thn</th>
              </tr>
            </thead>
            <tbody>
              {byTenor.map(({ t, r }) => (
                <tr key={t} className={t === tenorN ? 'cur' : r.extraCost === cheapest ? 'best' : undefined}>
                  <td>
                    <button type="button" onClick={() => setTenor(String(t))}>
                      {t} bln
                    </button>
                  </td>
                  <td>{formatRupiah(r.monthlyInstallment)}</td>
                  <td>{formatRupiah(r.extraCost)}</td>
                  <td>{r.effectiveAnnualRatePercent !== null ? `${r.effectiveAnnualRatePercent.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="pb-receipt" style={{ marginTop: 20, paddingBottom: 14 }}>
        <summary className="pb-mono" style={{ cursor: 'pointer', paddingBottom: 10 }}>
          Jadwal cicilan ({tenorN} bulan)
        </summary>
        <div className="pb-tblw">
          <table className="pb-tbl" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>Bln</th>
                <th>Pokok</th>
                <th>Bunga</th>
                <th>Admin</th>
                <th>Cicilan</th>
                <th>Sisa pokok</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.m}>
                  <td>{s.m}</td>
                  <td>{formatRupiah(s.principal)}</td>
                  <td>{formatRupiah(s.interest)}</td>
                  <td>{formatRupiah(s.admin)}</td>
                  <td>{formatRupiah(s.total)}</td>
                  <td>{formatRupiah(s.left)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="pb-fine">
        Angka bunga efektif dihitung dengan metode IRR (internal rate of return) dan bisa beda tipis dari kalkulator resmi. Angka ini edukasi, bukan penawaran kredit.
      </p>
    </main>
  );
}
