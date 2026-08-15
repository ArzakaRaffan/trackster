'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api, ApiError } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Camera, Check, ChevronLeft, Plus, Trash2, X } from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

interface ItemRow {
  id: string;
  description: string;
  amount: string;
}

interface ParticipantRow {
  id: string;
  name: string;
}

const STEP_LABELS = ['Info Resto', 'Menu & Peserta', 'Pajak & Fee'];

export default function NewSplitBillPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [restaurantName, setRestaurantName] = useState('');
  const [billDate, setBillDate] = useState(todayISO());

  const [items, setItems] = useState<ItemRow[]>([{ id: genId(), description: '', amount: '' }]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([{ id: genId(), name: '' }]);
  // itemId -> participantId. Satu item cuma bisa punya satu pemilik (checklist toggle
  // otomatis mindahin kepemilikan, bukan nambah — sesuai model data participantId tunggal).
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const [hasTax, setHasTax] = useState(false);
  const [taxAmount, setTaxAmount] = useState('');
  const [hasServiceFee, setHasServiceFee] = useState(false);
  const [serviceFeeAmount, setServiceFeeAmount] = useState('');

  const [itemListParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });
  const [participantListParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const addItem = () => setItems((rows) => [...rows, { id: genId(), description: '', amount: '' }]);
  const removeItem = (id: string) => {
    setItems((rows) => rows.filter((r) => r.id !== id));
    setAssignments((a) => {
      const next = { ...a };
      delete next[id];
      return next;
    });
  };
  const updateItem = (id: string, field: 'description' | 'amount', value: string) =>
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  const addParticipant = () => setParticipants((p) => [...p, { id: genId(), name: '' }]);
  const removeParticipant = (id: string) => {
    setParticipants((p) => p.filter((row) => row.id !== id));
    setAssignments((a) => {
      const next = { ...a };
      for (const itemId of Object.keys(next)) {
        if (next[itemId] === id) delete next[itemId];
      }
      return next;
    });
  };
  const updateParticipant = (id: string, value: string) =>
    setParticipants((p) => p.map((row) => (row.id === id ? { ...row, name: value } : row)));

  const toggleAssignment = (itemId: string, participantId: string) => {
    setAssignments((a) => {
      const next = { ...a };
      if (next[itemId] === participantId) delete next[itemId];
      else next[itemId] = participantId;
      return next;
    });
  };

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
        return [...cleaned, ...scanned.map((s) => ({ id: genId(), description: s.description, amount: String(s.amount) }))];
      });
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Gagal scan struk.');
    } finally {
      setScanning(false);
    }
  };

  const validItems = items.filter((r) => r.description.trim() && parseFloat(r.amount) > 0);
  const validParticipants = participants.filter((p) => p.name.trim().length > 0);

  const canGoStep = (target: number) => {
    if (target === 1) return restaurantName.trim().length > 0 && billDate.length > 0;
    if (target === 2) return validItems.length > 0 && validParticipants.length >= 1;
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
        taxAmount: hasTax ? parseFloat(taxAmount) || 0 : 0,
        serviceFeeAmount: hasServiceFee ? parseFloat(serviceFeeAmount) || 0 : 0,
        participants: validParticipants.map((p) => ({ name: p.name.trim() })),
        items: validItems.map((r) => ({ description: r.description.trim(), amount: parseFloat(r.amount) })),
      };
      const created = await api.post<{ id: number; items: { id: number }[]; participants: { id: number }[] }>(
        '/split-bills',
        body,
      );

      // Assignment dilakukan sebagai step terpisah setelah bill dibuat, karena item & peserta
      // baru punya id definitif setelah create — dipetakan lewat urutan array yang sama persis
      // dengan urutan validItems/validParticipants yang disubmit di body.
      const assignPromises = validItems.map((item, idx) => {
        const participantClientId = assignments[item.id];
        if (!participantClientId) return null;
        const participantIdx = validParticipants.findIndex((p) => p.id === participantClientId);
        if (participantIdx === -1) return null;
        const createdItemId = created.items[idx]?.id;
        const createdParticipantId = created.participants[participantIdx]?.id;
        if (createdItemId === undefined || createdParticipantId === undefined) return null;
        return api.patch(`/split-bills/${created.id}/items/${createdItemId}/assign`, { participantId: createdParticipantId });
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
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="mb-2 px-1 text-heading font-semibold text-ink">Menu</h2>
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
              <Button
                variant="outlined"
                fullWidth
                icon={<Camera size={18} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
              >
                {scanning ? 'Memindai struk...' : 'Scan Struk'}
              </Button>

              <div ref={itemListParent} className="mt-3 flex flex-col gap-2 rounded-comfortable bg-surface p-3">
                {items.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      placeholder="Deskripsi item"
                      value={row.description}
                      onChange={(e) => updateItem(row.id, 'description', e.target.value)}
                      className="min-w-0 flex-1 rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink-subtle"
                    />
                    <input
                      placeholder="0"
                      type="number"
                      inputMode="numeric"
                      value={row.amount}
                      onChange={(e) => updateItem(row.id, 'amount', e.target.value)}
                      className="w-28 shrink-0 rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-right text-body tabular-nums text-ink outline-none placeholder:text-ink-subtle"
                    />
                    <button
                      onClick={() => removeItem(row.id)}
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
            </div>

            <div>
              <h2 className="mb-2 px-1 text-heading font-semibold text-ink">Peserta & Pesanan</h2>
              <p className="mb-2 px-1 text-small text-ink-muted">
                Tambah nama, lalu centang menu yang dipesan orang itu. Menu yang udah dicentang orang lain kelihatan pudar.
              </p>
              <div ref={participantListParent} className="flex flex-col gap-3">
                {participants.map((participant, pIdx) => (
                  <div key={participant.id} className="rounded-comfortable bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-small font-bold text-ink-muted">
                        {pIdx + 1}
                      </span>
                      <input
                        placeholder={`Nama peserta ${pIdx + 1}`}
                        value={participant.name}
                        onChange={(e) => updateParticipant(participant.id, e.target.value)}
                        className="min-w-0 flex-1 rounded-comfortable bg-surface-interactive px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink-subtle"
                      />
                      {participants.length > 1 && (
                        <button
                          onClick={() => removeParticipant(participant.id)}
                          aria-label="Hapus peserta"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {participant.name.trim() && validItems.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1 border-t border-line-subtle pt-3">
                        {validItems.map((item) => {
                          const ownerId = assignments[item.id];
                          const isMine = ownerId === participant.id;
                          const ownerName = ownerId && !isMine ? participants.find((p) => p.id === ownerId)?.name : null;
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => toggleAssignment(item.id, participant.id)}
                                className={`flex w-full items-center gap-3 rounded-standard px-2 py-2 text-left transition-opacity duration-base ease-standard hover:bg-white/[0.05] ${
                                  ownerId && !isMine ? 'opacity-40' : 'opacity-100'
                                }`}
                              >
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-subtle transition-colors duration-fast ease-standard ${
                                    isMine ? 'bg-brand text-base' : 'shadow-[inset_0_0_0_1px_theme(colors.line.strong)] text-transparent'
                                  }`}
                                >
                                  <Check size={13} strokeWidth={3} />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-small text-ink">{item.description}</span>
                                {ownerName && <span className="shrink-0 text-micro text-ink-subtle">{ownerName}</span>}
                                <span className="shrink-0 text-small tabular-nums text-ink-muted">
                                  {formatRupiah(parseFloat(item.amount) || 0)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addParticipant}>
                  Tambah peserta
                </Button>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-3">
            <div className="rounded-comfortable bg-surface p-4">
              <Switch checked={hasTax} onChange={setHasTax} label="Ada pajak?" description="Dibagi rata ke semua peserta" />
              {hasTax && (
                <div className="mt-3">
                  <Input
                    label="Nominal Pajak"
                    type="number"
                    inputMode="numeric"
                    prefix="Rp"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="rounded-comfortable bg-surface p-4">
              <Switch
                checked={hasServiceFee}
                onChange={setHasServiceFee}
                label="Ada service fee?"
                description="Dibagi rata ke semua peserta"
              />
              {hasServiceFee && (
                <div className="mt-3">
                  <Input
                    label="Nominal Service Fee"
                    type="number"
                    inputMode="numeric"
                    prefix="Rp"
                    value={serviceFeeAmount}
                    onChange={(e) => setServiceFeeAmount(e.target.value)}
                  />
                </div>
              )}
            </div>
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
