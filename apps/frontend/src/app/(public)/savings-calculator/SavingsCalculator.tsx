'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toPng } from 'html-to-image';
import { Area, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRupiah } from '@/lib/format';
import {
  Frequency,
  inflate,
  milestones,
  milestonesWithInflation,
  periodicRate,
  periodsToReachWithInflation,
  projection,
  requiredDeposit,
  samplePoints,
} from '@/lib/savings-math';
import ThemeToggle from '@/components/legal/ThemeToggle';
import { Field, Seg } from '@/components/pub/ui';

// ---------------------------------------------------------------------------
// Instrumen & angka return: ASUMSI, bukan jaminan, bisa diedit user.
// Angka konservatif per 2026-09 (kisaran umum produk bank/sekuritas).
// ---------------------------------------------------------------------------
const UPDATED_AT = '2026-09-30';

type InstrumentId = 'tabungan' | 'deposito' | 'rdpu' | 'emas';

interface Instrument {
  id: InstrumentId;
  label: string;
  sub: string;
  defaultRate: number;
}

const INSTRUMENTS: Instrument[] = [
  { id: 'tabungan', label: 'Tabungan biasa', sub: 'Bunga ~0%', defaultRate: 0 },
  { id: 'deposito', label: 'Deposito', sub: 'Kisaran bank', defaultRate: 4.5 },
  { id: 'rdpu', label: 'Reksa dana pasar uang', sub: 'Low risk', defaultRate: 5 },
  { id: 'emas', label: 'Emas', sub: 'Logam mulia', defaultRate: 8 },
];

const DEFAULT_COMPARATOR = { label: 'kopi susu', amount: 25_000 };

type Mode = 'deadline' | 'ability';

const PPY: Record<Frequency, number> = { weekly: 52, monthly: 12 };
const DAYS_PER_PERIOD: Record<Frequency, number> = { weekly: 7, monthly: 30.4375 };

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const periodLabel = (p: number, f: Frequency) => (f === 'weekly' ? `Mg ${p}` : `Bl ${p}`);
const monthYear = (d: Date) => d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

export function SavingsCalculator() {
  const searchParams = useSearchParams();
  const cardRef = useRef<HTMLDivElement>(null);

  const [initialized, setInitialized] = useState(false);

  const [mode, setMode] = useState<Mode>('deadline');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [goalName, setGoalName] = useState('');
  const [target, setTarget] = useState('15000000');
  const [existing, setExisting] = useState('0');
  const [months, setMonths] = useState('12');
  const [deposit, setDeposit] = useState('500000');
  const [instrumentId, setInstrumentId] = useState<InstrumentId>('tabungan');
  const [rates, setRates] = useState<Record<InstrumentId, string>>(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, String(i.defaultRate)])) as Record<InstrumentId, string>,
  );

  const [inflationPct, setInflationPct] = useState('3');
  const [comparatorAmount, setComparatorAmount] = useState(String(DEFAULT_COMPARATOR.amount));

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Init state dari URL (link share), sekali ---
  useEffect(() => {
    if (initialized) return;
    const get = (k: string) => searchParams.get(k);
    const s = (k: string, d: string) => get(k) ?? d;
    const validModes: Mode[] = ['deadline', 'ability'];
    const validFreqs: Frequency[] = ['weekly', 'monthly'];
    const m = get('m');
    const f = get('f');
    const inst = get('i') as InstrumentId | null;
    if (m && validModes.includes(m as Mode)) setMode(m as Mode);
    if (f && validFreqs.includes(f as Frequency)) setFrequency(f as Frequency);
    if (inst && INSTRUMENTS.some((x) => x.id === inst)) setInstrumentId(inst);
    setGoalName(get('name') ?? '');
    setTarget(s('target', '15000000'));
    setExisting(s('existing', '0'));
    setMonths(s('months', '12'));
    setDeposit(s('deposit', '500000'));
    setInflationPct(s('infl', '3'));
    setComparatorAmount(s('cmp', String(DEFAULT_COMPARATOR.amount)));
    if (get('r')) {
      try {
        const parsed = JSON.parse(get('r')!) as Partial<Record<InstrumentId, string | number>>;
        setRates((prev) => {
          const next: Record<InstrumentId, string> = { ...prev };
          for (const [k, v] of Object.entries(parsed)) {
            if (k in next) next[k as InstrumentId] = v == null ? '0' : String(v);
          }
          return next;
        });
      } catch {
        // param rate rusak, abaikan
      }
    }
    setInitialized(true);
  }, [searchParams, initialized]);

  // --- Tulis state balik ke URL (bisa dibagikan) tanpa re-render/scroll ---
  useEffect(() => {
    if (!initialized) return;
    const p = new URLSearchParams({
      m: mode,
      f: frequency,
      i: instrumentId,
      target,
      existing,
      months,
      deposit,
      infl: inflationPct,
      cmp: comparatorAmount,
      r: JSON.stringify(rates),
    });
    if (goalName) p.set('name', goalName);
    window.history.replaceState(null, '', `?${p.toString()}`);
  }, [initialized, mode, frequency, instrumentId, target, existing, months, deposit, inflationPct, comparatorAmount, rates, goalName]);

  const instrument = INSTRUMENTS.find((i) => i.id === instrumentId)!;
  const rate = periodicRate(num(rates[instrumentId]), frequency);

  const targetNum = num(target);
  const existingNum = num(existing);
  const monthsNum = Math.max(num(months), 0);
  const depositNum = Math.max(num(deposit), 0);
  const inflationNum = Math.max(num(inflationPct), 0);
  const comparatorNum = Math.max(num(comparatorAmount), 0);

  const ppy = PPY[frequency];
  const unit = frequency === 'weekly' ? 'minggu' : 'bulan';
  const unitShort = frequency === 'weekly' ? 'mg' : 'bl';
  const periodsFloat = mode === 'deadline' ? monthsNum * (ppy / 12) : null;
  const periods = Math.ceil(periodsFloat ?? 0);

  const inflatedTarget = useMemo(
    () => (mode === 'deadline' ? inflate(targetNum, inflationNum, monthsNum / 12) : targetNum),
    [mode, targetNum, inflationNum, monthsNum],
  );

  const depositUsed = mode === 'deadline' ? requiredDeposit(inflatedTarget, existingNum, rate, periodsFloat!) : depositNum;

  const reachPeriods =
    mode === 'ability' ? periodsToReachWithInflation(targetNum, existingNum, depositNum, rate, inflationNum, frequency) : periodsFloat!;
  const reached = Number.isFinite(reachPeriods);
  const reachDate = reached ? new Date(Date.now() + reachPeriods * DAYS_PER_PERIOD[frequency] * 86_400_000) : null;

  const chartPeriods = mode === 'ability' ? (reached ? Math.max(Math.ceil(reachPeriods), 12) : 120) : periods;
  const chartData = useMemo(() => {
    const proj = projection(existingNum, depositUsed, rate, chartPeriods);
    return samplePoints(proj, 120).map((pt) => ({
      label: periodLabel(pt.period, frequency),
      period: pt.period,
      Setoran: Math.round(pt.deposits),
      Hasil: Math.round(pt.returns),
    }));
  }, [existingNum, depositUsed, rate, chartPeriods, frequency]);

  // --- Perbandingan instrumen: setoran sama, instrumen beda ---
  // Inflasi cuma dipakai saat target masih "hidup" (mode ability). Mode deadline target-nya
  // sudah dibekukan ke inflatedTarget, jangan di-inflate dua kali.
  const comparisonTarget = mode === 'deadline' ? inflatedTarget : targetNum;
  const comparisonInflation = mode === 'deadline' ? 0 : inflationNum;
  const comparison = useMemo(
    () =>
      INSTRUMENTS.map((i) => ({
        ...i,
        periods: periodsToReachWithInflation(comparisonTarget, existingNum, depositUsed, periodicRate(num(rates[i.id]), frequency), comparisonInflation, frequency),
      })),
    [comparisonTarget, existingNum, depositUsed, rates, frequency, comparisonInflation],
  );
  const bestPeriods = Math.min(...comparison.map((c) => c.periods).filter((p) => Number.isFinite(p)));

  const ms = useMemo(() => {
    const msTarget = mode === 'ability' ? targetNum : inflatedTarget;
    return mode === 'ability'
      ? milestonesWithInflation(msTarget, existingNum, depositUsed, rate, inflationNum, frequency)
      : milestones(msTarget, existingNum, depositUsed, rate);
  }, [mode, targetNum, inflatedTarget, existingNum, depositUsed, rate, inflationNum, frequency]);
  const msReached = ms.filter((m) => Number.isFinite(m.period));

  // --- Skenario lain (what-if) ---
  // deadline: kalau durasinya lain, setoran berapa. ability: kalau setorannya lain, kapan tercapai.
  const scenarios = useMemo(() => {
    if (mode === 'deadline') {
      return [0.5, 0.75, 1, 1.5, 2].map((k) => {
        const m = Math.max(1, Math.round(monthsNum * k));
        const p = m * (ppy / 12);
        return { key: `m${k}`, label: `${m} bulan`, current: k === 1, value: formatRupiah(requiredDeposit(inflate(targetNum, inflationNum, m / 12), existingNum, rate, p)), sub: `/${unit}`, apply: () => setMonths(String(m)) };
      });
    }
    return [1, 1.25, 1.5, 2].map((k) => {
      const d = Math.round(depositNum * k);
      const per = periodsToReachWithInflation(targetNum, existingNum, d, rate, inflationNum, frequency);
      return {
        key: `d${k}`,
        label: `${formatRupiah(d)}/${unit}`,
        current: k === 1,
        value: Number.isFinite(per) ? `${Math.ceil(per)} ${unitShort}` : 'nggak tercapai',
        sub: Number.isFinite(per) ? monthYear(new Date(Date.now() + per * DAYS_PER_PERIOD[frequency] * 86_400_000)) : '',
        apply: () => setDeposit(String(d)),
      };
    });
  }, [mode, monthsNum, depositNum, targetNum, existingNum, inflationNum, rate, ppy, frequency, unit, unitShort]);

  const perDay = depositUsed / DAYS_PER_PERIOD[frequency];
  const relatable =
    comparatorNum > 0 && perDay > 0
      ? perDay >= comparatorNum
        ? `≈ ${(perDay / comparatorNum).toFixed(1)} ${DEFAULT_COMPARATOR.label} per hari`
        : `≈ 1 ${DEFAULT_COMPARATOR.label} setiap ${(comparatorNum / perDay).toFixed(1)} hari`
      : null;

  const canCalculate = targetNum > 0 && (mode === 'deadline' ? monthsNum > 0 : depositNum > 0);
  const alreadyReached = mode === 'deadline' && existingNum >= inflatedTarget;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: bg });
      const link = document.createElement('a');
      link.download = `target-tabungan-${(goalName || 'trackster').toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setDownloadError('Gagal bikin gambar, coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard gagal, abaikan
    }
  };

  const chartTarget = Math.max(inflatedTarget, existingNum);

  return (
    <main className="pb wide">
      <div className="pb-top">
        <Link href="/tools">← Semua tools</Link>
        <ThemeToggle />
      </div>

      <div className="pb-cols">
        {/* Input */}
        <article className="pb-receipt" style={{ paddingBottom: 18 }}>
          <div className="pb-mono">Trackster · Kalkulator</div>
          <h1>Target tabungan</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-subtle)' }}>Hitung setoran, bandingin instrumen, dan lihat targetmu kapan tercapai.</p>
          <hr />

          <Seg value={mode} onChange={setMode} options={[['deadline', 'Harus nabung berapa?'], ['ability', 'Kapan tercapai?']]} />
          <Seg small value={frequency} onChange={setFrequency} options={[['weekly', 'Per minggu'], ['monthly', 'Per bulan']]} />

          <Field label="Nama goal" placeholder="Misal: iPhone, DP rumah, dana darurat" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
          <Field label="Harga target hari ini" prefix="Rp" type="number" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Field label="Sudah punya tabungan (opsional)" prefix="Rp" type="number" inputMode="numeric" value={existing} onChange={(e) => setExisting(e.target.value)} />

          {mode === 'deadline' ? (
            <Field label="Mau selesai dalam" suffix="bulan" type="number" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
          ) : (
            <Field label={`Setoran per ${unit}`} prefix="Rp" type="number" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          )}

          <div className="pb-f">
            <span className="pb-mono">Instrumen</span>
            <div className="pb-inst">
              {INSTRUMENTS.map((i) => (
                <button key={i.id} type="button" aria-pressed={instrumentId === i.id} onClick={() => setInstrumentId(i.id)}>
                  {i.label}
                  <small>
                    {i.sub} · {num(rates[i.id]).toFixed(1)}%/thn
                  </small>
                </button>
              ))}
            </div>
            <div className="pb-aff" style={{ marginTop: 8 }}>
              <span>Return</span>
              <input aria-label={`Return tahunan ${instrument.label}`} type="number" inputMode="decimal" value={rates[instrumentId]} onChange={(e) => setRates((r) => ({ ...r, [instrumentId]: e.target.value }))} />
              <span>%/thn</span>
            </div>
            <span className="pb-help">Asumsi, bukan jaminan · diperbarui {UPDATED_AT}. Return tahunan bisa diedit.</span>
          </div>

          <Field label="Inflasi harga target (opsional)" suffix="%/thn" type="number" inputMode="decimal" hint="Harga target ikut naik seiring waktu. Kosongkan atau 0 untuk nonaktif." value={inflationPct} onChange={(e) => setInflationPct(e.target.value)} />
          <Field label={`Harga pembanding (1 ${DEFAULT_COMPARATOR.label})`} prefix="Rp" type="number" inputMode="numeric" hint="Biar angka setoran terasa nyata." value={comparatorAmount} onChange={(e) => setComparatorAmount(e.target.value)} />
        </article>

        {/* Hasil */}
        <aside className="pb-sticky">
          {canCalculate ? (
            <>
              <div ref={cardRef} className="pb-receipt" style={{ paddingBottom: 18 }}>
                <div className="pb-hero">
                  <div className="lbl">{mode === 'deadline' ? 'Setoran target tabungan' : 'Estimasi tercapai'}</div>
                  <div style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, overflowWrap: 'anywhere' }}>{goalName || 'Target kamu'}</div>
                </div>
                <hr />
                <div className="pb-hero">
                  {mode === 'deadline' ? (
                    alreadyReached ? (
                      <>
                        <div className="lbl">Status</div>
                        <div className="val" style={{ fontSize: 26, color: 'var(--brand-text)' }}>Target udah tercapai 🎉</div>
                        <div className="sub">
                          Tabunganmu ({formatRupiah(existingNum)}) udah cukup buat {goalName || 'goal ini'}
                          {inflationNum > 0 ? `, bahkan setelah inflasi (${formatRupiah(inflatedTarget)})` : ''}.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="lbl">Nabung per {unit}</div>
                        <div className="val">{formatRupiah(depositUsed)}</div>
                        {relatable && <div className="sub">{relatable}</div>}
                      </>
                    )
                  ) : reached ? (
                    <>
                      <div className="lbl">Target tercapai dalam</div>
                      <div className="val">
                        {Math.ceil(reachPeriods)} {unit}
                      </div>
                      {reachDate && <div className="sub">≈ {monthYear(reachDate)}</div>}
                    </>
                  ) : (
                    <div className="pb-note bad" style={{ margin: 0 }}>
                      Nggak akan tercapai: setoran terlalu kecil atau inflasi terlalu tinggi.
                    </div>
                  )}
                </div>

                {inflationNum > 0 && mode === 'deadline' && !alreadyReached && (
                  <>
                    <div className="pb-kv">
                      <span>Target sekarang</span>
                      <b>{formatRupiah(targetNum)}</b>
                    </div>
                    <div className="pb-kv">
                      <span>Target saat selesai (inflasi)</span>
                      <b>{formatRupiah(inflatedTarget)}</b>
                    </div>
                  </>
                )}

                <hr />
                <div className="pb-mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span>
                    {instrument.label} · {num(rates[instrumentId]).toFixed(1)}%/thn
                  </span>
                  <span>Dibuat lewat Trackster</span>
                </div>
              </div>
              <div className="pb-tear" />

              <div className="pb-actions" style={{ marginTop: 14 }}>
                <button type="button" className="pb-btn" onClick={handleDownload} disabled={downloading}>
                  {downloading ? 'Membuat gambar…' : 'Download gambar'}
                </button>
                <button type="button" className="pb-btn" onClick={handleCopyLink}>
                  {copied ? 'Link tersalin ✓' : 'Salin link hasil'}
                </button>
              </div>
              {downloadError && <p className="pb-bad">{downloadError}</p>}
            </>
          ) : (
            <p className="pb-note warn" style={{ margin: 0 }}>
              Isi harga target dulu {mode === 'deadline' ? 'dan durasi' : 'dan setoran'} buat lihat hasilnya.
            </p>
          )}
        </aside>
      </div>

      {canCalculate && !alreadyReached && (
        <>
          {/* Grafik */}
          {reached && (
            <section className="pb-receipt" style={{ marginTop: 20, paddingBottom: 14 }}>
              <h2 style={{ margin: '0 0 4px' }}>Proyeksi</h2>
              <p className="pb-help" style={{ margin: '0 0 8px' }}>Setoran (hijau) vs hasil atau bunga (biru), garis putus-putus = target.</p>
              <div className="pb-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis hide />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload;
                        return (
                          <div style={{ background: 'var(--card)', boxShadow: '0 0 0 1.5px var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                            <b>{label}</b>
                            <div style={{ fontFamily: "'DM Mono',monospace" }}>Total: {formatRupiah(row.Setoran + row.Hasil)}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", color: 'var(--text-subtle)' }}>Setoran: {formatRupiah(row.Setoran)}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", color: 'var(--text-subtle)' }}>Hasil: {formatRupiah(row.Hasil)}</div>
                          </div>
                        );
                      }}
                      cursor={{ stroke: 'var(--border)' }}
                    />
                    <Area dataKey="Setoran" stackId="s" fill="#1ed760" stroke="#1ed760" fillOpacity={0.85} />
                    <Area dataKey="Hasil" stackId="s" fill="#539df5" stroke="#539df5" fillOpacity={0.9} />
                    <ReferenceLine y={chartTarget} stroke="#8a826c" strokeDasharray="4 4" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Skenario */}
          <section className="pb-receipt" style={{ marginTop: 20, paddingBottom: 14 }}>
            <h2 style={{ margin: '0 0 4px' }}>Skenario lain</h2>
            <p className="pb-help" style={{ margin: '0 0 10px' }}>
              {mode === 'deadline' ? 'Kalau durasinya lebih pendek atau panjang, setorannya jadi berapa. Ketuk untuk pakai.' : 'Kalau setorannya dinaikin, kapan tercapai. Ketuk untuk pakai.'}
            </p>
            <div className="pb-tblw">
              <table className="pb-tbl" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>{mode === 'deadline' ? 'Durasi' : 'Setoran'}</th>
                    <th>{mode === 'deadline' ? `Setoran/${unit}` : 'Tercapai dalam'}</th>
                    {mode === 'ability' && <th>Perkiraan</th>}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.key} className={s.current ? 'cur' : undefined}>
                      <td>
                        <button type="button" onClick={s.apply}>
                          {s.label}
                        </button>
                      </td>
                      <td>{s.value}</td>
                      {mode === 'ability' && <td>{s.sub}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Timeline */}
          {msReached.length > 0 && (
            <section className="pb-receipt" style={{ marginTop: 20, paddingBottom: 14 }}>
              <h2 style={{ margin: '0 0 8px' }}>Timeline</h2>
              {msReached.map((m) => (
                <div key={m.pct} className="pb-ms">
                  <em>{m.pct}%</em>
                  <i>
                    <s style={{ width: `${m.pct}%` }} />
                  </i>
                  <span>
                    {m.period} {unitShort}
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* Perbandingan instrumen */}
          <section className="pb-receipt" style={{ marginTop: 20, paddingBottom: 14 }}>
            <h2 style={{ margin: '0 0 4px' }}>Bandingin instrumen</h2>
            <p className="pb-help" style={{ margin: '0 0 10px' }}>
              Dengan setoran yang sama ({formatRupiah(depositUsed)}/{unit}).
            </p>
            <div className="pb-tblw">
              <table className="pb-tbl" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Instrumen</th>
                    <th>Return</th>
                    <th>Tercapai</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c) => {
                    const ok = Number.isFinite(c.periods);
                    const isBest = ok && c.periods === bestPeriods;
                    const delta = ok && Number.isFinite(bestPeriods) ? c.periods - bestPeriods : null;
                    return (
                      <tr key={c.id} className={c.id === instrumentId ? 'cur' : isBest ? 'best' : undefined}>
                        <td style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 14 }}>{c.label}</td>
                        <td>{num(rates[c.id]).toFixed(1)}%</td>
                        <td>
                          {ok ? (
                            <>
                              {Math.ceil(c.periods)} {unitShort}
                              {isBest ? ' ✓' : delta !== null && delta > 0 ? ` (+${delta.toFixed(0)})` : ''}
                            </>
                          ) : (
                            'nggak tercapai'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <div className="pb-cta">
        <span>
          <b>Target tabungan (Kantong)</b> di Trackster melacak progress-nya otomatis.
        </span>
        <Link className="pb-btn pri" href="/app/goals">
          Buka Goals
        </Link>
      </div>
    </main>
  );
}
