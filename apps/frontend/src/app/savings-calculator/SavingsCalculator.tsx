'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toPng } from 'html-to-image';
import {
  Area,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Input } from '@/components/ui/Input';
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
import { Download, Link2, Landmark, PiggyBank, Coins, CircleDollarSign, CalendarClock, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Instrumen & angka return — ASUSMSI, bukan jaminan, editable oleh user.
// Angka konservatif per 2026-09 (sumber: kisaran umum produk bank/sekuritas,
// wajib dicek ulang via web search saat sesi pengerjaan; label UI menampilkan
// "asumsi, bukan jaminan · diperbarui <tanggal>").
// ---------------------------------------------------------------------------
const UPDATED_AT = '2026-09-30';

type InstrumentId = 'tabungan' | 'deposito' | 'rdpu' | 'emas';

interface Instrument {
  id: InstrumentId;
  label: string;
  sub: string;
  defaultRate: number;
  Icon: typeof PiggyBank;
}

const INSTRUMENTS: Instrument[] = [
  { id: 'tabungan', label: 'Tabungan biasa', sub: 'Bunga ~0%', defaultRate: 0, Icon: PiggyBank },
  { id: 'deposito', label: 'Deposito', sub: 'Kisaran bank', defaultRate: 4.5, Icon: Landmark },
  { id: 'rdpu', label: 'Reksa dana pasar uang', sub: 'Low risk', defaultRate: 5, Icon: CircleDollarSign },
  { id: 'emas', label: 'Emas', sub: 'Logam mulia', defaultRate: 8, Icon: Coins },
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

  const [inflationPct, setInflationPct] = useState('3');  const [comparatorAmount, setComparatorAmount] = useState(String(DEFAULT_COMPARATOR.amount));

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Init state from URL (share link) once ---
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
        // ignore malformed rate param
      }
    }
    setInitialized(true);
  }, [searchParams, initialized]);

  // --- Sync state back to URL (shareable) without re-render/scroll ---
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
  const periodsFloat = mode === 'deadline' ? monthsNum * (ppy / 12) : null;
  const periods = Math.ceil(periodsFloat ?? 0);

  const inflatedTarget = useMemo(
    () => (mode === 'deadline' ? inflate(targetNum, inflationNum, monthsNum / 12) : targetNum),
    [mode, targetNum, inflationNum, monthsNum],
  );

  const depositUsed =
    mode === 'deadline' ? requiredDeposit(inflatedTarget, existingNum, rate, periodsFloat!) : depositNum;

  const reachPeriods =
    mode === 'ability'
      ? periodsToReachWithInflation(targetNum, existingNum, depositNum, rate, inflationNum, frequency)
      : periodsFloat!;
  const reached = Number.isFinite(reachPeriods);
  const reachDate = reached
    ? new Date(Date.now() + reachPeriods * DAYS_PER_PERIOD[frequency] * 86_400_000)
    : null;

  const chartPeriods =
    mode === 'ability' ? (reached ? Math.max(Math.ceil(reachPeriods), 12) : 120) : periods;
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
  // sudah dibekukan ke inflatedTarget — jangan di-inflate dua kali.
  const comparisonTarget = mode === 'deadline' ? inflatedTarget : targetNum;
  const comparisonInflation = mode === 'deadline' ? 0 : inflationNum;
  const comparison = useMemo(
    () =>
      INSTRUMENTS.map((i) => ({
        ...i,
        periods: periodsToReachWithInflation(
          comparisonTarget,
          existingNum,
          depositUsed,
          periodicRate(num(rates[i.id]), frequency),
          comparisonInflation,
          frequency,
        ),
      })),
    [comparisonTarget, existingNum, depositUsed, rates, frequency, comparisonInflation],
  );
  const bestPeriods = Math.min(...comparison.map((c) => c.periods).filter((p) => Number.isFinite(p)));

  const ms = useMemo(() => {
    // Mode "kapan tercapai" target-nya ikut naik karena inflasi → milestone juga pakai
    // target yang sama (dengan inflasi). Mode deadline target-nya sudah fixed (inflatedTarget).
    const msTarget = mode === 'ability' ? targetNum : inflatedTarget;
    return mode === 'ability'
      ? milestonesWithInflation(msTarget, existingNum, depositUsed, rate, inflationNum, frequency)
      : milestones(msTarget, existingNum, depositUsed, rate);
  }, [mode, targetNum, inflatedTarget, existingNum, depositUsed, rate, inflationNum, frequency]);
  const msReached = ms.filter((m) => Number.isFinite(m.period));

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
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: '#121212' });
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
      // clipboard gagal — abaikan
    }
  };

  const chartTarget = Math.max(inflatedTarget, existingNum);

  return (
    <div className="min-h-screen bg-base pb-16 text-ink">
      <div className="mx-auto max-w-content px-4 pt-8">
        <header className="mb-6 text-center">
          <Link href="/" className="inline-block">
            <Image src="/trackster-logo.svg" alt="Trackster" width={350} height={64} className="h-9 w-auto" />
          </Link>
          <h1 className="mt-4 font-title text-title font-bold text-ink">Perencana Target Tabungan</h1>
          <p className="mt-1 text-body text-ink-muted">
            Hitung setoran, bandingin instrumen, dan liat target kamu kapan tercapai.
          </p>
        </header>

        {/* Mode & frekuensi */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 rounded-full-pill bg-surface p-1">
            {(
              [
                ['deadline', 'Harus nabung berapa?'],
                ['ability', 'Kapan tercapai?'],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full-pill py-2 text-label font-bold transition-colors duration-base ease-standard ${
                  mode === m ? 'bg-brand text-base' : 'text-ink-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full-pill bg-surface p-1">
            {(['weekly', 'monthly'] as Frequency[]).map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`flex-1 rounded-full-pill py-1.5 text-small font-bold transition-colors duration-base ease-standard ${
                  frequency === f ? 'bg-surface-alt text-ink' : 'text-ink-muted'
                }`}
              >
                {f === 'weekly' ? 'Per minggu' : 'Per bulan'}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <section className="mt-3 flex flex-col gap-3 rounded-comfortable bg-surface p-4">
          <Input label="Nama goal" placeholder="Misal: iPhone, DP rumah, dana darurat" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
          <Input label="Harga target hari ini" type="number" inputMode="numeric" prefix="Rp" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Input label="Sudah punya tabungan (opsional)" type="number" inputMode="numeric" prefix="Rp" value={existing} onChange={(e) => setExisting(e.target.value)} />

          {mode === 'deadline' ? (
            <Input label="Mau selesai dalam" type="number" inputMode="numeric" suffix="bulan" value={months} onChange={(e) => setMonths(e.target.value)} />
          ) : (
            <Input
              label={`Setoran ${frequency === 'weekly' ? 'per minggu' : 'per bulan'}`}
              type="number"
              inputMode="numeric"
              prefix="Rp"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          )}

          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-small font-bold uppercase tracking-caps text-text-subtle">Instrumen</span>
            <div className="grid grid-cols-2 gap-2">
              {INSTRUMENTS.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setInstrumentId(i.id)}
                  className={`flex items-center gap-2 rounded-medium px-3 py-2.5 text-left transition-colors duration-fast ease-standard ${
                    instrumentId === i.id ? 'bg-brand-subtle shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]' : 'bg-neutral hover:bg-neutral-hover'
                  }`}
                >
                  <i.Icon size={16} className={instrumentId === i.id ? 'text-brand' : 'text-ink-muted'} />
                  <span className="min-w-0">
                    <span className="block truncate text-small font-bold text-ink">{i.label}</span>
                    <span className="block text-micro text-ink-subtle">{i.sub}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="whitespace-nowrap text-small text-ink-muted">Return</span>
              <Input
                aria-label={`Return tahunan ${instrument.label}`}
                type="number"
                inputMode="decimal"
                suffix="%/thn"
                value={rates[instrumentId]}
                onChange={(e) => setRates((r) => ({ ...r, [instrumentId]: e.target.value }))}
              />
            </div>
            <p className="text-micro text-ink-subtle">
              Asumsi, bukan jaminan · diperbarui {UPDATED_AT}. Return tahunan bisa diedit.
            </p>
          </div>

          <Input
            label="Inflasi harga target (opsional)"
            type="number"
            inputMode="decimal"
            suffix="%/thn"
            hint="Harga target ikut naik seiring waktu. Kosongkan / 0 untuk nonaktif."
            value={inflationPct}
            onChange={(e) => setInflationPct(e.target.value)}
          />
          <Input
            label={`Harga pembanding (1 ${DEFAULT_COMPARATOR.label})`}
            type="number"
            inputMode="numeric"
            prefix="Rp"
            hint="Biar angka setoran terasa nyata."
            value={comparatorAmount}
            onChange={(e) => setComparatorAmount(e.target.value)}
          />
        </section>

        {canCalculate && (
          <div className="mt-4 flex flex-col gap-3">
            {/* Kartu hasil (dibagikan sebagai PNG) */}
            <div ref={cardRef} className="w-full overflow-hidden rounded-panel bg-surface">
              <div className="bg-gradient-to-b from-brand/[0.14] to-transparent px-6 pb-6 pt-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-base shadow-medium">
                  <instrument.Icon size={22} />
                </span>
                <p className="mt-3 text-small font-bold uppercase tracking-caps text-ink-muted">
                  {mode === 'deadline' ? 'Setoran target tabungan' : 'Estimasi tercapai'}
                </p>
                <h2 className="mt-1 font-title text-title font-bold text-ink">{goalName || 'Target Kamu'}</h2>
              </div>

              <div className="border-t border-line-subtle px-6 py-6 text-center">
                {mode === 'deadline' ? (
                  alreadyReached ? (
                    <>
                      <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Status</p>
                      <div className="mt-1 flex justify-center">
                        <span className="font-title text-heading font-bold text-status-under">
                          Target udah tercapai 🎉
                        </span>
                      </div>
                      <p className="mt-1 text-small text-ink-muted">
                        Tabungan kamu ({formatRupiah(existingNum)}) udah cukup buat {goalName || 'goal ini'}
                        {inflationNum > 0 ? ` — bahkan setelah inflasi (${formatRupiah(inflatedTarget)})` : ''}.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
                        Nabung per {frequency === 'weekly' ? 'minggu' : 'bulan'}
                      </p>
                      <div className="mt-1 flex justify-center">
                        <span className="font-title text-amount font-black tabular-nums text-ink">{formatRupiah(depositUsed)}</span>
                      </div>
                      {relatable && <p className="mt-1 text-small text-ink-muted">{relatable}</p>}
                    </>
                  )
                ) : (
                  <>
                    {reached ? (
                      <>
                        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Target tercapai dalam</p>
                        <div className="mt-1 flex justify-center">
                          <span className="font-title text-amount font-black tabular-nums text-ink">
                            {Math.ceil(reachPeriods)} {frequency === 'weekly' ? 'minggu' : 'bulan'}
                          </span>
                        </div>
                        {reachDate && (
                          <p className="mt-1 text-small text-ink-muted">
                            ≈ {reachDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="font-title text-heading font-bold text-status-over">
                        Nggak akan tercapai — setoran terlalu kecil atau inflasi terlalu tinggi.
                      </p>
                    )}
                  </>
                )}
              </div>

              {inflationNum > 0 && mode === 'deadline' && !alreadyReached && (
                <div className="grid grid-cols-2 gap-3 border-t border-line-subtle px-6 py-5 text-center">
                  <div>
                    <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Target sekarang</p>
                    <p className="mt-1 text-label font-bold tabular-nums text-ink">{formatRupiah(targetNum)}</p>
                  </div>
                  <div>
                    <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Target saat selesai (inflasi)</p>
                    <p className="mt-1 text-label font-bold tabular-nums text-ink">{formatRupiah(inflatedTarget)}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-6 py-4 text-small">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <instrument.Icon size={14} className="text-brand" />
                  {instrument.label} · {num(rates[instrumentId]).toFixed(1)}%/thn
                </span>
                <span className="text-ink-subtle">Dibuat lewat Trackster</span>
              </div>
            </div>

            {/* Grafik proyeksi */}
            {reached !== false && !alreadyReached && (
              <section className="rounded-comfortable bg-surface p-4">
                <h2 className="text-heading font-semibold text-ink">Proyeksi</h2>
                <p className="mt-1 text-small text-ink-muted">Setoran (hijau) vs hasil/bunga (biru), garis putus-putus = target.</p>
                <ResponsiveContainer width="100%" height={220} className="mt-3">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: '#7c7c7c', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis hide />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload;
                        return (
                          <div className="rounded-standard bg-surface-overlay px-3 py-2 text-small shadow-medium">
                            <p className="font-bold text-ink">{label}</p>
                            <p className="tabular-nums text-ink-muted">Total: {formatRupiah(row.Setoran + row.Hasil)}</p>
                            <p className="tabular-nums text-ink-muted">Setoran: {formatRupiah(row.Setoran)}</p>
                            <p className="tabular-nums text-status-info">Hasil: {formatRupiah(row.Hasil)}</p>
                          </div>
                        );
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Area dataKey="Setoran" stackId="s" fill="#1ed760" stroke="#1ed760" fillOpacity={0.85} />
                    <Area dataKey="Hasil" stackId="s" fill="#539df5" stroke="#539df5" fillOpacity={0.9} />
                    <ReferenceLine y={chartTarget} stroke="#b3b3b3" strokeDasharray="4 4" />
                  </ComposedChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* Timeline milestone */}
            {msReached.length > 0 && !alreadyReached && (
              <section className="rounded-comfortable bg-surface p-4">
                <h2 className="text-heading font-semibold text-ink">Timeline</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {msReached.map((m) => (
                    <div key={m.pct} className="flex items-center gap-3">
                      <span className="w-10 shrink-0 text-small font-bold tabular-nums text-ink-muted">{m.pct}%</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-track">
                        <div
                          className="h-full rounded-pill bg-brand transition-[width] duration-slow ease-expressive"
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-small tabular-nums text-ink-muted">
                        {m.period} {frequency === 'weekly' ? 'mg' : 'bl'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Perbandingan instrumen */}
            {!alreadyReached && (
            <section className="rounded-comfortable bg-surface p-4">
              <h2 className="text-heading font-semibold text-ink">Bandingin instrumen</h2>
              <p className="mt-1 text-small text-ink-muted">Dengan setoran yang sama ({formatRupiah(depositUsed)}/{frequency === 'weekly' ? 'minggu' : 'bulan'}).</p>
              <div className="mt-3 flex flex-col gap-2">
                {comparison.map((c) => {
                  const isBest = Number.isFinite(c.periods) && c.periods === bestPeriods;
                  const delta = Number.isFinite(c.periods) && Number.isFinite(bestPeriods) ? c.periods - bestPeriods : null;
                  return (
                    <div key={c.id} className={`flex items-center justify-between gap-3 rounded-medium px-3 py-2.5 ${c.id === instrumentId ? 'bg-brand-subtle' : 'bg-neutral'}`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <c.Icon size={14} className={c.id === instrumentId ? 'text-brand' : 'text-ink-muted'} />
                        <span className="truncate text-small font-bold text-ink">{c.label}</span>
                        <span className="text-micro text-ink-subtle">{num(rates[c.id]).toFixed(1)}%/thn</span>
                      </span>
                      {Number.isFinite(c.periods) ? (
                        <span className="shrink-0 text-small tabular-nums text-ink-muted">
                          {Math.ceil(c.periods)} {frequency === 'weekly' ? 'mg' : 'bl'}
                          {isBest && <span className="ml-1.5 font-bold text-brand">paling cepat</span>}
                          {!isBest && delta !== null && delta > 0 && (
                            <span className="ml-1.5 text-ink-subtle">(+{delta.toFixed(0)} {frequency === 'weekly' ? 'mg' : 'bl'})</span>
                          )}
                        </span>
                      ) : (
                        <span className="shrink-0 text-small text-status-over">nggak tercapai</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            )}

            {/* Aksi: download + share link */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-surface-interactive px-4 py-2.5 text-label font-bold text-ink transition-[transform,filter] duration-base ease-standard active:scale-[.97] disabled:opacity-40"
              >
                <Download size={16} />
                {downloading ? 'Membuat gambar...' : 'Download gambar'}
              </button>
              <button
                onClick={handleCopyLink}
                className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-surface-interactive px-4 py-2.5 text-label font-bold text-ink transition-[transform,filter] duration-base ease-standard active:scale-[.97]"
              >
                {copied ? <Check size={16} className="text-brand" /> : <Link2 size={16} />}
                {copied ? 'Link disalin' : 'Salin link hasil'}
              </button>
            </div>
            {downloadError && <p className="text-small text-status-over">{downloadError}</p>}
          </div>
        )}

        {!canCalculate && (
          <p className="mt-4 rounded-medium bg-neutral px-4 py-3 text-small text-ink-muted">
            Isi harga target dulu{' '}{mode === 'deadline' ? 'dan durasi' : 'dan setoran'} buat liat hasilnya.
          </p>
        )}

        {/* Funnel — CTA ke Trackster */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-comfortable bg-surface-interactive p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-alt text-brand">
              <CalendarClock size={16} />
            </span>
            <p className="text-small text-ink-muted">
              <span className="font-bold text-ink">Target Tabungan (Kantong)</span> di Trackster ngelacak progress-nya otomatis.
            </p>
          </div>
          <Link
            href="/app/goals"
            className="shrink-0 rounded-full-pill bg-brand px-3.5 py-1.5 text-small font-bold text-base transition-all hover:brightness-108 active:scale-[.97]"
          >
            Buka Goals
          </Link>
        </div>
      </div>
    </div>
  );
}
