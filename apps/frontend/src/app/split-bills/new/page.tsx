'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Camera, ChevronLeft, Plus, Trash2, X } from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);

interface ItemRow {
  description: string;
  amount: string;
}

const STEP_LABELS = ['Info Resto', 'Item', 'Peserta', 'Assign'];

export default function NewSplitBillPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [restaurantName, setRestaurantName] = useState('');
  const [billDate, setBillDate] = useState(todayISO());
  const [taxAmount, setTaxAmount] = useState('');
  const [serviceFeeAmount, setServiceFeeAmount] = useState('');

  const [items, setItems] = useState<ItemRow[]>([{ description: '', amount: '' }]);
  const [participants, setParticipants] = useState<string[]>(['', '']);
  const [assignments, setAssignments] = useState<Record<number, number>>({});

  const addItem = () => setItems((rows) => [...rows, { description: '', amount: '' }]);
  const removeItem = (i: number) => setItems((rows) => rows.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof ItemRow, value: string) =>
    setItems((rows) => rows.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const addParticipant = () => setParticipants((p) => [...p, '']);
  const removeParticipant = (i: number) => setParticipants((p) => p.filter((_, idx) => idx !== i));
  const updateParticipant = (i: number, value: string) =>
    setParticipants((p) => p.map((name, idx) => (idx === i ? value : name)));

  const handleScanReceipt = async (file: File) => {
    setScanning(true);
    setErrorMsg(null);
    try {
      const imageBase64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { items: scanned } = await api.post<{ items: { description: string; amount: number }[] }>(
        '/split-bills/scan-receipt',
        { imageBase64 },
      );
      if (scanned.length === 0) {
        setErrorMsg('Struk tidak terbaca, coba foto ulang atau tambah item manual.');
        return;
      }
      setItems((rows) => {
        const cleaned = rows.filter((r) => r.description.trim() || r.amount.trim());
        return [...cleaned, ...scanned.map((s) => ({ description: s.description, amount: String(s.amount) }))];
      });
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Gagal scan struk.');
    } finally {
      setScanning(false);
    }
  };

  const validItems = items.filter((r) => r.description.trim() && parseFloat(r.amount) > 0);
  const validParticipants = participants.map((p) => p.trim()).filter((p) => p.length > 0);

  const canGoStep = (target: number) => {
    if (target === 1) return restaurantName.trim().length > 0 && billDate.length > 0;
    if (target === 2) return validItems.length > 0;
    if (target === 3) return validParticipants.length >= 1;
    return true;
  };

  const goNext = () => {
    if (!canGoStep(step + 1)) return;
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const body = {
        restaurantName: restaurantName.trim(),
        billDate: new Date(billDate).toISOString(),
        taxAmount: parseFloat(taxAmount) || 0,
        serviceFeeAmount: parseFloat(serviceFeeAmount) || 0,
        participants: validParticipants.map((name) => ({ name })),
        items: validItems.map((r) => ({ description: r.description.trim(), amount: parseFloat(r.amount) })),
      };
      const created = await api.post<{ id: number; items: { id: number }[]; participants: { id: number }[] }>(
        '/split-bills',
        body,
      );

      // Assignment dilakukan sebagai step terpisah setelah bill dibuat, karena item & peserta
      // baru punya id definitif setelah create — assign berdasarkan urutan index yang sama
      // seperti array yang disubmit di body.
      const assignPromises = created.items.map((createdItem, idx) => {
        const participantIdx = assignments[idx];
        if (participantIdx === undefined) return null;
        const participantId = created.participants[participantIdx]?.id;
        if (participantId === undefined) return null;
        return api.patch(`/split-bills/${created.id}/items/${createdItem.id}/assign`, { participantId });
      });
      await Promise.all(assignPromises.filter(Boolean));

      router.push(`/split-bills/${created.id}`);
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Gagal membuat split bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <button
          onClick={() => (step === 0 ? router.push('/split-bills') : goBack())}
          aria-label="Kembali"
          className="text-ink-muted hover:text-ink"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-small font-bold uppercase tracking-caps text-ink-muted">
            Langkah {step + 1}/{STEP_LABELS.length}
          </p>
          <h1 className="font-title text-title font-bold text-ink">{STEP_LABELS[step]}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {errorMsg && (
          <div className="rounded-comfortable bg-status-over-bg px-4 py-3 text-small text-status-over">{errorMsg}</div>
        )}

        {step === 0 && (
          <section className="flex flex-col gap-3 rounded-comfortable bg-surface p-4">
            <Input label="Nama Resto" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
            <Input label="Tanggal" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            <Input
              label="Pajak"
              type="number"
              inputMode="numeric"
              prefix="Rp"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
            />
            <Input
              label="Service Fee"
              type="number"
              inputMode="numeric"
              prefix="Rp"
              value={serviceFeeAmount}
              onChange={(e) => setServiceFeeAmount(e.target.value)}
            />
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanReceipt(file);
                e.target.value = '';
              }}
            />
            <Button variant="outlined" fullWidth icon={<Camera size={18} />} onClick={() => fileInputRef.current?.click()} disabled={scanning}>
              {scanning ? 'Memindai struk...' : 'Scan Struk'}
            </Button>

            <div className="flex flex-col gap-2 rounded-comfortable bg-surface p-3">
              {items.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder="Deskripsi item"
                    value={row.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    className="min-w-0 flex-1 rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink-subtle"
                  />
                  <input
                    placeholder="0"
                    type="number"
                    inputMode="numeric"
                    value={row.amount}
                    onChange={(e) => updateItem(i, 'amount', e.target.value)}
                    className="w-28 shrink-0 rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-right text-body tabular-nums text-ink outline-none placeholder:text-ink-subtle"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    aria-label="Hapus item"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addItem}>
                Tambah item
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-2 rounded-comfortable bg-surface p-3">
            {participants.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  placeholder={`Nama peserta ${i + 1}`}
                  value={name}
                  onChange={(e) => updateParticipant(i, e.target.value)}
                  className="min-w-0 flex-1 rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink-subtle"
                />
                {participants.length > 1 && (
                  <button
                    onClick={() => removeParticipant(i)}
                    aria-label="Hapus peserta"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addParticipant}>
              Tambah peserta
            </Button>
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-col gap-2 rounded-comfortable bg-surface p-3">
            <p className="px-1 text-small text-ink-muted">Pilih siapa yang pesan tiap item (opsional, bisa diubah lagi nanti).</p>
            {validItems.map((row, i) => (
              <div key={i} className="flex items-center gap-3 rounded-standard px-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{row.description}</span>
                  <span className="text-small tabular-nums text-ink-muted">{formatRupiah(parseFloat(row.amount) || 0)}</span>
                </span>
                <select
                  value={assignments[i] ?? ''}
                  onChange={(e) =>
                    setAssignments((a) => {
                      const next = { ...a };
                      if (e.target.value === '') delete next[i];
                      else next[i] = parseInt(e.target.value, 10);
                      return next;
                    })
                  }
                  className="shrink-0 rounded-comfortable bg-surface-interactive px-3 py-2 text-small text-ink outline-none"
                >
                  <option value="">Belum di-assign</option>
                  {validParticipants.map((name, pIdx) => (
                    <option key={pIdx} value={pIdx}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </section>
        )}

        <div className="flex gap-2">
          {step < STEP_LABELS.length - 1 ? (
            <Button variant="primary" fullWidth onClick={goNext} disabled={!canGoStep(step + 1)}>
              Lanjut
            </Button>
          ) : (
            <Button variant="primary" fullWidth onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Buat Split Bill'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
