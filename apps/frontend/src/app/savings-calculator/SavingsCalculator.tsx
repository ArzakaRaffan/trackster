'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toPng } from 'html-to-image';
import { Input } from '@/components/ui/Input';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { formatRupiah } from '@/lib/format';
import { Bike, Camera, Download, Home, Palmtree, PartyPopper, PiggyBank, ShieldAlert, Sparkles } from 'lucide-react';

type Preset =
  | { id: string; label: string; kind: 'fixed'; amount: number; goalName: string; Icon: typeof Bike }
  | { id: string; label: string; kind: 'salary-multiple'; multiplier: number; goalName: string; Icon: typeof Bike }
  | { id: 'custom'; label: string; kind: 'custom'; goalName: ''; Icon: typeof Bike };

// Nominal preset disesuaikan konteks harga pasar Indonesia 2026 (harga OTR motor matic
// entry-level, iPhone base model generasi terbaru, DP starter-home, budget liburan domestik
// buat 1-2 orang) — angka bulat biar gampang diingat/dikira-kira, bukan hasil ngarang.
const PRESETS: Preset[] = [
  { id: 'motor', label: 'Motor', kind: 'fixed', amount: 18_000_000, goalName: 'Motor', Icon: Bike },
  { id: 'iphone', label: 'iPhone Terbaru', kind: 'fixed', amount: 15_000_000, goalName: 'iPhone Terbaru', Icon: Camera },
  { id: 'darurat', label: 'Dana Darurat 6 Bulan Gaji', kind: 'salary-multiple', multiplier: 6, goalName: 'Dana Darurat', Icon: ShieldAlert },
  { id: 'dp-rumah', label: 'DP Rumah', kind: 'fixed', amount: 50_000_000, goalName: 'DP Rumah', Icon: Home },
  { id: 'liburan', label: 'Liburan', kind: 'fixed', amount: 5_000_000, goalName: 'Liburan', Icon: Palmtree },
  { id: 'custom', label: 'Custom', kind: 'custom', goalName: '', Icon: Sparkles },
];

const targetDateLabel = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

export function SavingsCalculator() {
  const [selectedPreset, setSelectedPreset] = useState('motor');
  const [goalName, setGoalName] = useState('Motor');
  const [nominalTarget, setNominalTarget] = useState('18000000');
  const [currentSavings, setCurrentSavings] = useState('0');
  const [months, setMonths] = useState('12');
  const [monthlySalary, setMonthlySalary] = useState('');

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const applyPreset = (preset: Preset) => {
    setSelectedPreset(preset.id);
    setGoalName(preset.goalName);
    if (preset.kind === 'fixed') {
      setNominalTarget(String(preset.amount));
    } else if (preset.kind === 'salary-multiple') {
      // Kosongin dulu — nominal dihitung otomatis begitu gaji diisi (lihat di bawah).
      setNominalTarget(monthlySalary ? String((parseFloat(monthlySalary) || 0) * preset.multiplier) : '');
    } else {
      setNominalTarget('');
    }
  };

  const handleSalaryChange = (value: string) => {
    setMonthlySalary(value);
    const darurat = PRESETS.find((p) => p.id === 'darurat');
    if (selectedPreset === 'darurat' && darurat?.kind === 'salary-multiple') {
      setNominalTarget(String((parseFloat(value) || 0) * darurat.multiplier));
    }
  };

  const numNominal = parseFloat(nominalTarget) || 0;
  const numSavings = parseFloat(currentSavings) || 0;
  const numMonths = parseInt(months, 10) || 0;

  const sisaTarget = Math.max(numNominal - numSavings, 0);
  const alreadyReached = numNominal > 0 && numSavings >= numNominal;
  const perBulan = numMonths > 0 ? sisaTarget / numMonths : 0;
  const perHari = perBulan / 30;
  const canCalculate = numNominal > 0 && numMonths > 0;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: '#181818' });
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

  return (
    <div className="min-h-screen bg-base pb-16 text-ink">
      <div className="mx-auto max-w-content px-4 pt-8">
        <header className="mb-6 text-center">
          <Link href="/" className="inline-block">
            <Image src="/trackster-logo.png" alt="Trackster" width={509} height={198} className="h-14 w-auto" />
          </Link>
          <h1 className="mt-4 font-title text-title font-bold text-ink">Kalkulator Target Tabungan</h1>
          <p className="mt-1 text-body text-ink-muted">Pilih goal, isi target, langsung ketauan nabungnya berapa per bulan.</p>
        </header>

        {/* Preset chips */}
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-small font-bold transition-colors duration-base ease-standard ${
                selectedPreset === preset.id ? 'bg-brand text-base' : 'bg-surface-interactive text-ink-muted hover:text-ink'
              }`}
            >
              <preset.Icon size={14} />
              {preset.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <section className="flex flex-col gap-3 rounded-comfortable bg-surface p-4">
          {selectedPreset === 'custom' && (
            <Input label="Nama Goal" placeholder="Misal: Kamera baru" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
          )}

          {selectedPreset === 'darurat' && (
            <Input
              label="Gaji bulanan kamu"
              type="number"
              inputMode="numeric"
              prefix="Rp"
              hint="Target otomatis dihitung 6x dari angka ini, masih bisa diedit manual di bawah."
              value={monthlySalary}
              onChange={(e) => handleSalaryChange(e.target.value)}
            />
          )}

          <Input
            label="Nominal Target"
            type="number"
            inputMode="numeric"
            prefix="Rp"
            value={nominalTarget}
            onChange={(e) => setNominalTarget(e.target.value)}
          />
          <Input
            label="Sudah Punya Tabungan (opsional)"
            type="number"
            inputMode="numeric"
            prefix="Rp"
            value={currentSavings}
            onChange={(e) => setCurrentSavings(e.target.value)}
          />
          <Input
            label="Target Selesai Dalam (bulan)"
            type="number"
            inputMode="numeric"
            suffix="bulan"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </section>

        {/* Result */}
        {canCalculate && (
          <div className="mt-4 flex flex-col items-center gap-3">
            {alreadyReached ? (
              <div className="flex w-full flex-col items-center gap-2 rounded-panel bg-status-under-bg p-8 text-center">
                <PartyPopper size={28} className="text-status-under" />
                <p className="text-heading font-bold text-status-under">Target udah tercapai!</p>
                <p className="text-small text-ink-muted">Tabungan kamu udah cukup buat {goalName || 'goal ini'}.</p>
              </div>
            ) : (
              <div ref={cardRef} className="w-full overflow-hidden rounded-panel bg-surface">
                <div className="bg-gradient-to-b from-brand/[0.14] to-transparent px-6 pb-6 pt-8 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-base shadow-medium">
                    <PiggyBank size={22} />
                  </span>
                  <p className="mt-3 text-small font-bold uppercase tracking-caps text-ink-muted">Target Tabungan</p>
                  <h2 className="mt-1 font-title text-title font-bold text-ink">{goalName || 'Target Kamu'}</h2>
                </div>

                <div className="border-t border-line-subtle px-6 py-6 text-center">
                  <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Nabung per bulan</p>
                  <div className="mt-1 flex justify-center">
                    <AmountDisplay value={perBulan} size="large" tone="base" />
                  </div>
                  <p className="mt-1 text-small text-ink-muted">≈ {formatRupiah(perHari)} / hari (estimasi kasar)</p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-line-subtle px-6 py-5 text-center">
                  <div>
                    <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Target</p>
                    <p className="mt-1 text-label font-bold tabular-nums text-ink">{formatRupiah(numNominal)}</p>
                  </div>
                  <div>
                    <p className="text-micro font-bold uppercase tracking-caps text-ink-muted">Selesai</p>
                    <p className="mt-1 text-label font-bold text-ink">
                      {numMonths} bulan lagi
                      <br />
                      <span className="text-ink-muted">{targetDateLabel(numMonths)}</span>
                    </p>
                  </div>
                </div>

                <p className="px-6 pb-5 text-center text-micro uppercase tracking-caps text-ink-subtle">Dibuat lewat Trackster</p>
              </div>
            )}

            {!alreadyReached && (
              <>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-surface-interactive px-4 py-2.5 text-label font-bold text-ink transition-[transform,filter] duration-base ease-standard active:scale-[.97] disabled:opacity-40"
                >
                  <Download size={16} />
                  {downloading ? 'Membuat gambar...' : 'Download sebagai gambar'}
                </button>
                {downloadError && <p className="text-small text-status-over">{downloadError}</p>}
              </>
            )}
          </div>
        )}

        {/* Funnel — fitur otomatis di dalam app belum aktif, soft CTA aja tanpa tombol. */}
        <div className="mt-8 flex items-center gap-3 rounded-comfortable bg-surface-interactive p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-alt text-ink-muted">
            <Sparkles size={16} />
          </span>
          <p className="text-small text-ink-muted">
            <span className="font-bold text-ink">Segera hadir:</span> fitur Target Tabungan otomatis di Trackster yang nge-track
            progress nabung kamu beneran, bukan cuma kalkulasi sekali doang.
          </p>
        </div>
      </div>
    </div>
  );
}
