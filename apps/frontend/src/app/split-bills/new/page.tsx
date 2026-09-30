'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api, ApiError } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import { calculate, SplitInput } from '@/lib/split-calc';

const todayISO = () => new Date().toISOString().slice(0, 10);
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

interface ItemRow {
  id: string;
  description: string;
  amount: string;
  quantity: string;
  assignedTo: string[]; // array of participant ids
}

interface ParticipantRow {
  id: string;
  name: string;
}

const STEP_LABELS = ['Info & Peserta', 'Menu & Pembagian', 'Pajak, Fee & Ringkasan'];

export default function NewSplitBillPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(() => setIsOwner(true))
      .catch(() => setIsOwner(false));
  }, []);

  // Form State
  const [restaurantName, setRestaurantName] = useState('');
  const [billDate, setBillDate] = useState(todayISO());
  const [payerBankName, setPayerBankName] = useState('');
  const [payerAccountNumber, setPayerAccountNumber] = useState('');
  const [payerAccountName, setPayerAccountName] = useState('');

  const [participants, setParticipants] = useState<ParticipantRow[]>([{ id: genId(), name: '' }]);
  const [items, setItems] = useState<ItemRow[]>([{ id: genId(), description: '', amount: '', quantity: '1', assignedTo: [] }]);
  const [subtotalCheck, setSubtotalCheck] = useState('');

  // Settings
  const [taxAmount, setTaxAmount] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [serviceFeeAmount, setServiceFeeAmount] = useState('');
  const [servicePercent, setServicePercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [roundingUnit, setRoundingUnit] = useState<0 | 100 | 500 | 1000>(0);
  const [taxAfterService, setTaxAfterService] = useState(false);

  // Load from localStorage history if any
  useEffect(() => {
    const history = localStorage.getItem('splitBillHistory');
    if (history) {
      try {
        const parsed = JSON.parse(history);
        if (parsed.payerBankName) setPayerBankName(parsed.payerBankName);
        if (parsed.payerAccountNumber) setPayerAccountNumber(parsed.payerAccountNumber);
        if (parsed.payerAccountName) setPayerAccountName(parsed.payerAccountName);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const [itemListParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });
  const [participantListParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const addParticipant = () => setParticipants((p) => [...p, { id: genId(), name: '' }]);
  const removeParticipant = (id: string) => {
    setParticipants((p) => p.filter((row) => row.id !== id));
    setItems((items) => items.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(pid => pid !== id)
    })));
  };
  const updateParticipant = (id: string, value: string) =>
    setParticipants((p) => p.map((row) => (row.id === id ? { ...row, name: value } : row)));

  const addItem = () => setItems((rows) => [...rows, { id: genId(), description: '', amount: '', quantity: '1', assignedTo: [] }]);
  const removeItem = (id: string) => setItems((rows) => rows.filter((r) => r.id !== id));
  const updateItem = (id: string, field: 'description' | 'amount' | 'quantity', value: string) =>
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  const toggleParticipantForItem = (itemId: string, participantId: string) => {
    setItems((rows) => rows.map((row) => {
      if (row.id === itemId) {
        const has = row.assignedTo.includes(participantId);
        return {
          ...row,
          assignedTo: has ? row.assignedTo.filter(p => p !== participantId) : [...row.assignedTo, participantId]
        };
      }
      return row;
    }));
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
      const { items: scanned } = await api.post<{ items: { description: string; amount: number; quantity: number }[] }>(
        '/split-bills/scan-receipt',
        { imageBase64 },
      );
      if (scanned.length === 0) {
        setErrorMsg('Struk tidak terbaca, coba foto ulang atau tambah item manual.');
        return;
      }
      setItems((rows) => {
        const cleaned = rows.filter((r) => r.description.trim() || r.amount.trim());
        return [
          ...cleaned,
          ...scanned.map((s) => ({ id: genId(), description: s.description, amount: String(s.amount), quantity: String(s.quantity || 1), assignedTo: [] })),
        ];
      });
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Gagal scan struk.');
    } finally {
      setScanning(false);
    }
  };

  const validParticipants = participants.filter((p) => p.name.trim().length > 0);
  const validItems = items.filter((r) => r.description.trim() && parseFloat(r.amount) > 0);

  const lineTotal = (r: ItemRow) => (parseFloat(r.amount) || 0) * (parseInt(r.quantity, 10) || 1);
  const itemsSubtotal = validItems.reduce((sum, r) => sum + lineTotal(r), 0);
  const subtotalCheckValue = parseFloat(subtotalCheck) || 0;
  const subtotalDiff = subtotalCheckValue > 0 ? itemsSubtotal - subtotalCheckValue : 0;

  const canGoStep = (target: number) => {
    if (target === 1) return restaurantName.trim().length > 0 && billDate.length > 0 && validParticipants.length > 0;
    if (target === 2) return validItems.length > 0;
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
      localStorage.setItem('splitBillHistory', JSON.stringify({
        payerBankName: payerBankName.trim(),
        payerAccountNumber: payerAccountNumber.trim(),
        payerAccountName: payerAccountName.trim()
      }));

      const body = {
        restaurantName: restaurantName.trim(),
        billDate: new Date(billDate).toISOString(),
        taxAmount: parseFloat(taxAmount) || 0,
        taxPercent: parseFloat(taxPercent) || 0,
        serviceFeeAmount: parseFloat(serviceFeeAmount) || 0,
        servicePercent: parseFloat(servicePercent) || 0,
        discountAmount: parseFloat(discountAmount) || 0,
        discountPercent: parseFloat(discountPercent) || 0,
        deliveryFee: parseFloat(deliveryFee) || 0,
        roundingUnit: roundingUnit,
        taxAfterService,
        payerBankName: payerBankName.trim() || undefined,
        payerAccountNumber: payerAccountNumber.trim() || undefined,
        payerAccountName: payerAccountName.trim() || undefined,
        participants: validParticipants.map((p) => ({ name: p.name.trim() })),
        items: validItems.map((r) => {
          const shares = r.assignedTo.map(pid => {
            const pIndex = validParticipants.findIndex(p => p.id === pid);
            return { participantIndex: pIndex, weight: 1 };
          }).filter(s => s.participantIndex !== -1);

          return {
            description: r.description.trim(),
            amount: parseFloat(r.amount),
            quantity: parseInt(r.quantity, 10) || 1,
            shares: shares.length > 0 ? shares : undefined,
          };
        }),
      };

      const owner = await api
        .get('/auth/me')
        .then(() => true)
        .catch(() => false);

      const created = await api.post<{
        id: number;
        ownerToken?: string | null;
      }>(owner ? '/split-bills' : '/split-bills/public', body);

      router.push(owner ? `/split-bills/${created.id}` : `/split-bills/manage/${created.ownerToken}`);
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Gagal membuat split bill.');
    } finally {
      setSubmitting(false);
    }
  };

  // Preview Calculation
  const splitInput: SplitInput = {
    items: validItems.map(i => ({
      id: parseInt(i.id.replace('id-', ''), 36) || Math.random(),
      price: parseFloat(i.amount) || 0,
      qty: parseInt(i.quantity, 10) || 1,
      shares: i.assignedTo.map(pid => {
        const pIndex = validParticipants.findIndex(p => p.id === pid);
        return { participantId: pIndex, weight: 1 };
      }).filter(s => s.participantId !== -1)
    })),
    participants: validParticipants.map((p, i) => ({ id: i, name: p.name })),
    taxAmount: parseFloat(taxAmount) || 0,
    taxPercent: parseFloat(taxPercent) || 0,
    serviceAmount: parseFloat(serviceFeeAmount) || 0,
    servicePercent: parseFloat(servicePercent) || 0,
    discountAmount: parseFloat(discountAmount) || 0,
    discountPercent: parseFloat(discountPercent) || 0,
    deliveryFee: parseFloat(deliveryFee) || 0,
    roundingUnit: roundingUnit,
    taxAfterService: taxAfterService,
  };

  const preview = step === 2 ? calculate(splitInput) : null;

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-page/[0.9] px-4 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step === 0 ? router.push(isOwner ? '/split-bills' : '/') : goBack())}
            aria-label="Kembali"
            className="text-text-subtle hover:text-text"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-small font-bold uppercase tracking-caps text-text-subtle">
              Langkah {step + 1}/{STEP_LABELS.length}
            </p>
            <h1 className="font-title text-title font-bold text-text">{STEP_LABELS[step]}</h1>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          {STEP_LABELS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-pill transition-colors duration-base ease-standard ${i <= step ? 'bg-brand' : 'bg-track'}`}
            />
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-8">
        {errorMsg && (
          <div className="rounded-medium bg-status-over-bg px-4 py-3 text-small text-status-over">{errorMsg}</div>
        )}

        {step === 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-card">
              <Input label="Nama Resto" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
              <Input label="Tanggal" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>

            <section className="rounded-card bg-card shadow-card">
              <button
                onClick={() => setTransferOpen((v) => !v)}
                aria-expanded={transferOpen}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-small font-bold uppercase tracking-caps text-text-subtle"
              >
                <span className="flex min-w-0 items-center gap-2">
                  Info Transfer (opsional)
                  {!transferOpen && (payerBankName || payerAccountNumber) && (
                    <span className="truncate text-micro font-normal normal-case tracking-normal text-text-subtlest">
                      · {payerBankName} {payerAccountNumber}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 transition-transform duration-base ease-standard ${transferOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
                style={{ gridTemplateRows: transferOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col gap-3 px-4 pb-4">
                    <p className="text-small leading-relaxed text-text-subtle">
                      Rekening kamu yang nalangin — ditampilkan di halaman publik biar temen tau harus transfer ke mana.
                    </p>
                    <Input label="Bank / E-wallet" placeholder="BCA, Jago, GoPay, dst" value={payerBankName} onChange={(e) => setPayerBankName(e.target.value)} />
                    <Input
                      label="Nomor Rekening"
                      value={payerAccountNumber}
                      onChange={(e) => setPayerAccountNumber(e.target.value)}
                    />
                    <Input label="Atas Nama" value={payerAccountName} onChange={(e) => setPayerAccountName(e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-card">
              <div>
                <h2 className="text-heading font-semibold text-text">Peserta</h2>
                <p className="mt-1 text-small text-text-subtle">
                  Siapa aja yang ikut makan? Tekan Enter untuk tambah.
                </p>
              </div>
              <div ref={participantListParent} className="flex flex-col gap-2">
                {participants.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral text-small font-bold text-text-subtle">
                      {i + 1}
                    </span>
                    <input
                      placeholder={`Nama peserta ${i + 1}`}
                      value={p.name}
                      onChange={(e) => updateParticipant(p.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addParticipant();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-pill bg-neutral px-3.5 py-2.5 text-body text-text shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-text-subtlest"
                    />
                    {participants.length > 1 && (
                      <button
                        onClick={() => removeParticipant(p.id)}
                        aria-label={`Hapus peserta ${i + 1}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-subtle hover:text-status-over"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addParticipant}>
                Tambah peserta
              </Button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="mb-2 px-1 text-heading font-semibold text-text">Menu & Pembagian</h2>
              <p className="mb-4 px-1 text-small text-text-subtle">
                Pilih siapa aja yang pesen menu ini. Klik nama untuk assign (bisa multi-select).
              </p>

              {isOwner === true ? (
                <>
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
                    className="mb-4"
                  >
                    {scanning ? 'Memindai struk...' : 'Scan Struk'}
                  </Button>
                </>
              ) : isOwner === false ? (
                <p className="mb-4 rounded-medium bg-neutral px-4 py-3 text-small text-text-subtle">
                  Scan struk otomatis cuma buat yang login ke Trackster.
                </p>
              ) : null}

              <div ref={itemListParent} className="flex flex-col gap-3 rounded-card bg-card p-3 shadow-card">
                {items.map((row) => (
                  <div key={row.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Deskripsi item"
                        value={row.description}
                        onChange={(e) => updateItem(row.id, 'description', e.target.value)}
                        className="min-w-0 flex-1 rounded-medium bg-neutral px-3.5 py-2.5 text-body text-text shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-text-subtlest"
                      />
                      <button
                        onClick={() => removeItem(row.id)}
                        aria-label="Hapus item"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-subtle hover:text-status-over"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pr-10">
                      <input
                        placeholder="Harga satuan"
                        type="number"
                        inputMode="numeric"
                        value={row.amount}
                        onChange={(e) => updateItem(row.id, 'amount', e.target.value)}
                        className="min-w-0 flex-1 rounded-medium bg-neutral px-3.5 py-2.5 text-right text-body tabular-nums text-text shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus placeholder:text-text-subtlest"
                      />
                      <span className="shrink-0 text-small text-text-subtlest">×</span>
                      <input
                        aria-label="Jumlah"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => updateItem(row.id, 'quantity', e.target.value)}
                        className="w-14 shrink-0 rounded-medium bg-neutral px-2 py-2.5 text-center text-body tabular-nums text-text shadow-field outline-none transition-shadow duration-base ease-standard focus:shadow-field-focus"
                      />
                      {(parseInt(row.quantity, 10) || 1) > 1 && (
                        <span className="shrink-0 text-small tabular-nums text-text-subtle">= {formatRupiah(lineTotal(row))}</span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {validParticipants.map(p => {
                        const active = row.assignedTo.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleParticipantForItem(row.id, p.id)}
                            className={`rounded-pill px-3 py-1 text-small font-bold transition-colors duration-fast ease-standard ${
                              active
                                ? 'bg-brand-subtle text-brand shadow-[inset_0_0_0_1px_theme(colors.brand.DEFAULT)]'
                                : 'bg-neutral text-text-subtle hover:text-text'
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addItem}>
                  Tambah item
                </Button>

                <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-small text-text-subtle">Total menu</span>
                    <span className="text-body font-bold tabular-nums text-text">{formatRupiah(itemsSubtotal)}</span>
                  </div>
                  <Input
                    label="Subtotal di Struk (opsional)"
                    type="number"
                    inputMode="numeric"
                    prefix="Rp"
                    value={subtotalCheck}
                    onChange={(e) => setSubtotalCheck(e.target.value)}
                  />
                  {subtotalCheckValue > 0 && (
                    <p className={`flex items-center gap-1.5 px-1 text-small ${subtotalDiff === 0 ? 'text-status-under' : 'text-status-over'}`}>
                      {subtotalDiff === 0 ? (
                        <><CheckCircle2 size={14} /> Cocok sama struk</>
                      ) : (
                        <><AlertTriangle size={14} /> {subtotalDiff > 0 ? `Lebih Rp${subtotalDiff.toLocaleString('id-ID')}` : `Kurang Rp${Math.abs(subtotalDiff).toLocaleString('id-ID')}`}</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 2 && preview && (
          <section className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="rounded-card bg-card p-4 flex flex-col gap-4 shadow-card">
              <h2 className="text-heading font-semibold text-text">Pajak & Fee</h2>
              <div className="flex gap-2">
                <Input label="Diskon (%)" type="number" inputMode="numeric" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
                <Input label="Diskon (Rp)" type="number" inputMode="numeric" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Input label="Service (%)" type="number" inputMode="numeric" value={servicePercent} onChange={(e) => setServicePercent(e.target.value)} />
                <Input label="Service (Rp)" type="number" inputMode="numeric" value={serviceFeeAmount} onChange={(e) => setServiceFeeAmount(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Input label="Pajak (%)" type="number" inputMode="numeric" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
                <Input label="Pajak (Rp)" type="number" inputMode="numeric" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
              </div>
              <Switch checked={taxAfterService} onChange={setTaxAfterService} label="Pajak setelah Service?" description="Hitung pajak dari subtotal + service fee" />
              <div className="flex gap-2 mt-2 pt-4 border-t border-border">
                <Input label="Ongkir/Lainnya (Rp)" type="number" inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
                <div className="flex-1">
                  <label className="mb-1 block text-small font-semibold text-text">Pembulatan</label>
                  <select
                    className="w-full appearance-none rounded-medium bg-neutral px-3.5 py-3 text-body text-text shadow-field outline-none"
                    value={roundingUnit}
                    onChange={(e) => setRoundingUnit(parseInt(e.target.value) as 0 | 100 | 500 | 1000)}
                  >
                    <option value={0}>Tidak ada</option>
                    <option value={100}>Ratusan (100)</option>
                    <option value={500}>Go-Pay (500)</option>
                    <option value={1000}>Ribuan (1000)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-card bg-card p-4 shadow-card lg:sticky lg:top-6">
              <h2 className="mb-3 text-heading font-semibold text-text">Preview Tagihan</h2>
              <div className="flex flex-col gap-2">
                {preview.participants.map(p => {
                  const pName = validParticipants.find(x => x.id === validParticipants[p.participantId]?.id)?.name || '?';
                  return (
                    <div key={p.participantId} className="flex justify-between items-center py-1 border-b border-border last:border-b-0">
                      <span className="text-body text-text">{pName}</span>
                      <span className="text-body font-bold tabular-nums text-text">{formatRupiah(p.total)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2 font-bold border-t-2 border-border-bold">
                  <span>Grand Total</span>
                  <span className="tabular-nums text-brand">{formatRupiah(preview.grandTotal)}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-4 flex gap-2">
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
