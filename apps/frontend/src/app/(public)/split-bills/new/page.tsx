'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { avatarCss } from '@/lib/avatars';
import { calculate, SplitInput } from '@/lib/split-calc';
import ThemeToggle from '@/components/legal/ThemeToggle';
import { AvatarPicker } from '@/components/avatar/AvatarPicker';

const todayISO = () => new Date().toISOString().slice(0, 10);
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const bg = (name: string, avatar?: string | null): React.CSSProperties => ({ background: avatarCss(name, avatar).slice('background:'.length) });

interface ItemRow {
  id: string;
  description: string;
  amount: string;
  quantity: string;
  assignedTo: string[]; // id peserta
}

interface ParticipantRow {
  id: string;
  name: string;
  avatar?: string; // hanya terisi kalau dipilih manual; kosong = otomatis dari nama
}

const STEP_LABELS = ['Info & peserta', 'Menu & pembagian', 'Pajak, fee & ringkasan'];

export default function NewSplitBillPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(() => setIsOwner(true))
      .catch(() => setIsOwner(false));
  }, []);

  const [restaurantName, setRestaurantName] = useState('');
  const [billDate, setBillDate] = useState(todayISO());
  const [payerBankName, setPayerBankName] = useState('');
  const [payerAccountNumber, setPayerAccountNumber] = useState('');
  const [payerAccountName, setPayerAccountName] = useState('');

  const [participants, setParticipants] = useState<ParticipantRow[]>([{ id: genId(), name: '' }]);
  const [items, setItems] = useState<ItemRow[]>([{ id: genId(), description: '', amount: '', quantity: '1', assignedTo: [] }]);
  const [subtotalCheck, setSubtotalCheck] = useState('');

  const [taxAmount, setTaxAmount] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [serviceFeeAmount, setServiceFeeAmount] = useState('');
  const [servicePercent, setServicePercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [roundingUnit, setRoundingUnit] = useState<0 | 100 | 500 | 1000>(0);
  const [taxAfterService, setTaxAfterService] = useState(false);

  // Rekening terakhir dipakai diingat di perangkat ini.
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

  const addParticipant = () => setParticipants((p) => [...p, { id: genId(), name: '' }]);
  const removeParticipant = (id: string) => {
    setParticipants((p) => p.filter((row) => row.id !== id));
    setItems((rows) => rows.map((item) => ({ ...item, assignedTo: item.assignedTo.filter((pid) => pid !== id) })));
  };
  const updateParticipant = (id: string, patch: Partial<ParticipantRow>) =>
    setParticipants((p) => p.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const addItem = () => setItems((rows) => [...rows, { id: genId(), description: '', amount: '', quantity: '1', assignedTo: [] }]);
  const removeItem = (id: string) => setItems((rows) => rows.filter((r) => r.id !== id));
  const updateItem = (id: string, field: 'description' | 'amount' | 'quantity', value: string) =>
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  const toggleParticipantForItem = (itemId: string, participantId: string) => {
    setItems((rows) =>
      rows.map((row) => {
        if (row.id !== itemId) return row;
        const has = row.assignedTo.includes(participantId);
        return { ...row, assignedTo: has ? row.assignedTo.filter((p) => p !== participantId) : [...row.assignedTo, participantId] };
      }),
    );
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
      const { items: scanned } = await api.post<{ items: { description: string; amount: number; quantity: number }[] }>('/split-bills/scan-receipt', { imageBase64 });
      if (scanned.length === 0) {
        setErrorMsg('Struk tidak terbaca, coba foto ulang atau tambah item manual.');
        return;
      }
      setItems((rows) => {
        const cleaned = rows.filter((r) => r.description.trim() || r.amount.trim());
        return [...cleaned, ...scanned.map((s) => ({ id: genId(), description: s.description, amount: String(s.amount), quantity: String(s.quantity || 1), assignedTo: [] }))];
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
    window.scrollTo({ top: 0 });
  };
  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0 });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      localStorage.setItem(
        'splitBillHistory',
        JSON.stringify({ payerBankName: payerBankName.trim(), payerAccountNumber: payerAccountNumber.trim(), payerAccountName: payerAccountName.trim() }),
      );

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
        roundingUnit,
        taxAfterService,
        payerBankName: payerBankName.trim() || undefined,
        payerAccountNumber: payerAccountNumber.trim() || undefined,
        payerAccountName: payerAccountName.trim() || undefined,
        participants: validParticipants.map((p) => ({ name: p.name.trim(), avatar: p.avatar })),
        items: validItems.map((r) => {
          const shares = r.assignedTo
            .map((pid) => ({ participantIndex: validParticipants.findIndex((p) => p.id === pid), weight: 1 }))
            .filter((s) => s.participantIndex !== -1);
          return {
            description: r.description.trim(),
            amount: parseFloat(r.amount),
            quantity: parseInt(r.quantity, 10) || 1,
            shares: shares.length > 0 ? shares : undefined,
          };
        }),
      };

      const owner = await api.get('/auth/me').then(() => true).catch(() => false);
      const created = await api.post<{ id: number; ownerToken?: string | null }>(owner ? '/split-bills' : '/split-bills/public', body);
      router.push(owner ? '/app/split' : `/split-bills/manage/${created.ownerToken}`);
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Gagal membuat split bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const splitInput: SplitInput = {
    items: validItems.map((i) => ({
      id: parseInt(i.id.replace('id-', ''), 36) || Math.random(),
      price: parseFloat(i.amount) || 0,
      qty: parseInt(i.quantity, 10) || 1,
      shares: i.assignedTo
        .map((pid) => ({ participantId: validParticipants.findIndex((p) => p.id === pid), weight: 1 }))
        .filter((s) => s.participantId !== -1),
    })),
    participants: validParticipants.map((p, i) => ({ id: i, name: p.name })),
    taxAmount: parseFloat(taxAmount) || 0,
    taxPercent: parseFloat(taxPercent) || 0,
    serviceAmount: parseFloat(serviceFeeAmount) || 0,
    servicePercent: parseFloat(servicePercent) || 0,
    discountAmount: parseFloat(discountAmount) || 0,
    discountPercent: parseFloat(discountPercent) || 0,
    deliveryFee: parseFloat(deliveryFee) || 0,
    roundingUnit,
    taxAfterService,
  };
  const preview = step === 2 ? calculate(splitInput) : null;
  const pickP = picking ? participants.find((p) => p.id === picking) ?? null : null;

  const field = (label: string, value: string, set: (v: string) => void, extra: { type?: string; placeholder?: string; num?: boolean } = {}) => (
    <label className="pb-f">
      <span className="pb-mono">{label}</span>
      <input
        className={`pb-in${extra.num ? ' num' : ''}`}
        type={extra.type ?? 'text'}
        inputMode={extra.num ? 'decimal' : undefined}
        placeholder={extra.placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );

  return (
    <main className="pb">
      <div className="pb-top">
        <Link href={isOwner ? '/app/split' : '/'}>← {isOwner ? 'Split bill' : 'Trackster'}</Link>
        <ThemeToggle />
      </div>

      <article className="pb-receipt">
        <div className="pb-mono">
          Trackster · Buat split bill · {step + 1}/{STEP_LABELS.length}
        </div>
        <h1>{STEP_LABELS[step]}</h1>
        <div className="pb-steps" aria-hidden="true">
          {STEP_LABELS.map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <hr />

        {errorMsg && <p className="pb-err">{errorMsg}</p>}

        {step === 0 && (
          <>
            {field('Nama resto', restaurantName, setRestaurantName)}
            {field('Tanggal', billDate, setBillDate, { type: 'date' })}

            <details className="pb-det" open={!!(payerBankName || payerAccountNumber) || undefined}>
              <summary>Info transfer (opsional)</summary>
              <div>
                <p className="pb-hint">Rekening kamu yang nalangin. Ditampilkan di halaman publik biar temen tau harus transfer ke mana.</p>
                {field('Bank / e-wallet', payerBankName, setPayerBankName, { placeholder: 'BCA, Jago, GoPay, dst' })}
                {field('Nomor rekening', payerAccountNumber, setPayerAccountNumber)}
                {field('Atas nama', payerAccountName, setPayerAccountName)}
              </div>
            </details>

            <hr />
            <h2>Peserta</h2>
            <p className="pb-hint">Siapa aja yang ikut makan? Ketuk avatar buat ganti. Enter buat tambah.</p>
            {participants.map((p, i) => (
              <div key={p.id} className="pb-prow">
                <button type="button" className="pb-av" style={bg(p.name, p.avatar)} onClick={() => setPicking(p.id)} aria-label={`Pilih avatar peserta ${i + 1}`} />
                <input
                  className="pb-in"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder={`Nama peserta ${i + 1}`}
                  value={p.name}
                  onChange={(e) => updateParticipant(p.id, { name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addParticipant();
                    }
                  }}
                />
                {participants.length > 1 && (
                  <button type="button" className="pb-icon" onClick={() => removeParticipant(p.id)} aria-label={`Hapus peserta ${i + 1}`}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="pb-btn sm" onClick={addParticipant} style={{ marginBottom: 20 }}>
              + Tambah peserta
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="pb-hint">Pilih siapa aja yang pesen tiap menu. Ketuk nama buat assign, boleh lebih dari satu.</p>

            {isOwner === true ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleScanReceipt(file);
                    e.target.value = '';
                  }}
                />
                <button type="button" className="pb-btn" style={{ width: '100%', marginBottom: 14 }} onClick={() => fileInputRef.current?.click()} disabled={scanning}>
                  {scanning ? 'Memindai struk…' : 'Scan struk'}
                </button>
              </>
            ) : isOwner === false ? (
              <p className="pb-hint" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--neutral)' }}>
                Scan struk otomatis cuma buat yang login ke Trackster.
              </p>
            ) : null}

            {items.map((row) => (
              <div key={row.id} className="pb-itemrow">
                <div className="pb-prow" style={{ marginBottom: 0 }}>
                  <input className="pb-in" placeholder="Deskripsi item" aria-label="Deskripsi item" value={row.description} onChange={(e) => updateItem(row.id, 'description', e.target.value)} />
                  <button type="button" className="pb-icon" onClick={() => removeItem(row.id)} aria-label="Hapus item">
                    ×
                  </button>
                </div>
                <div className="pb-line">
                  <input className="pb-in num" placeholder="Harga satuan" aria-label="Harga satuan" type="number" inputMode="numeric" value={row.amount} onChange={(e) => updateItem(row.id, 'amount', e.target.value)} />
                  <span className="pb-x">×</span>
                  <input className="pb-in qty" aria-label="Jumlah" type="number" inputMode="numeric" min={1} value={row.quantity} onChange={(e) => updateItem(row.id, 'quantity', e.target.value)} />
                </div>
                {(parseInt(row.quantity, 10) || 1) > 1 && <div className="pb-eq" style={{ marginTop: 6, textAlign: 'right' }}>= {formatRupiah(lineTotal(row))}</div>}
                <div className="pb-chips" style={{ marginTop: 10 }}>
                  {validParticipants.map((p) => (
                    <button key={p.id} type="button" className="pb-chip tog" aria-pressed={row.assignedTo.includes(p.id)} onClick={() => toggleParticipantForItem(row.id, p.id)}>
                      <i style={bg(p.name, p.avatar)} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className="pb-btn sm" onClick={addItem}>
              + Tambah item
            </button>

            <hr />
            <div className="pb-sum">
              <span className="pb-mono">Total menu</span>
              <b>{formatRupiah(itemsSubtotal)}</b>
            </div>
            <label className="pb-f" style={{ marginTop: 8 }}>
              <span className="pb-mono">Subtotal di struk (opsional)</span>
              <input className="pb-in num" type="number" inputMode="numeric" placeholder="Rp" value={subtotalCheck} onChange={(e) => setSubtotalCheck(e.target.value)} />
            </label>
            {subtotalCheckValue > 0 &&
              (subtotalDiff === 0 ? (
                <p className="pb-ok">✓ Cocok sama struk</p>
              ) : (
                <p className="pb-bad">{subtotalDiff > 0 ? `Lebih Rp${subtotalDiff.toLocaleString('id-ID')}` : `Kurang Rp${Math.abs(subtotalDiff).toLocaleString('id-ID')}`}</p>
              ))}
            <div style={{ height: 14 }} />
          </>
        )}

        {step === 2 && preview && (
          <>
            <h2>Pajak & fee</h2>
            <div className="pb-2" style={{ marginTop: 10 }}>
              {field('Diskon (%)', discountPercent, setDiscountPercent, { type: 'number', num: true })}
              {field('Diskon (Rp)', discountAmount, setDiscountAmount, { type: 'number', num: true })}
              {field('Service (%)', servicePercent, setServicePercent, { type: 'number', num: true })}
              {field('Service (Rp)', serviceFeeAmount, setServiceFeeAmount, { type: 'number', num: true })}
              {field('Pajak (%)', taxPercent, setTaxPercent, { type: 'number', num: true })}
              {field('Pajak (Rp)', taxAmount, setTaxAmount, { type: 'number', num: true })}
            </div>
            <label className="pb-chk">
              <input type="checkbox" checked={taxAfterService} onChange={(e) => setTaxAfterService(e.target.checked)} />
              <span>
                Pajak setelah service?
                <small>Hitung pajak dari subtotal + service fee</small>
              </span>
            </label>
            <div className="pb-2">
              {field('Ongkir / lainnya (Rp)', deliveryFee, setDeliveryFee, { type: 'number', num: true })}
              <label className="pb-f">
                <span className="pb-mono">Pembulatan</span>
                <select className="pb-in" value={roundingUnit} onChange={(e) => setRoundingUnit(parseInt(e.target.value) as 0 | 100 | 500 | 1000)}>
                  <option value={0}>Tidak ada</option>
                  <option value={100}>Ratusan (100)</option>
                  <option value={500}>Go-Pay (500)</option>
                  <option value={1000}>Ribuan (1000)</option>
                </select>
              </label>
            </div>

            <hr />
            <h2>Preview tagihan</h2>
            <ul>
              {preview.participants.map((p) => {
                const vp = validParticipants[p.participantId];
                return (
                  <li key={p.participantId} className="pb-pl">
                    <i style={bg(vp?.name ?? '?', vp?.avatar)} />
                    <span>{vp?.name ?? '?'}</span>
                    <b>{formatRupiah(p.total)}</b>
                  </li>
                );
              })}
            </ul>
            <div className="pb-sum big" style={{ borderTop: '1.5px dashed var(--border)', marginTop: 8, paddingTop: 14 }}>
              <span className="pb-mono">Grand total</span>
              <b>{formatRupiah(preview.grandTotal)}</b>
            </div>
            <div style={{ height: 8 }} />
          </>
        )}

        <hr />
        <div className="pb-nav">
          {step > 0 && (
            <button type="button" className="pb-btn" onClick={goBack}>
              Kembali
            </button>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <button type="button" className="pb-btn pri" onClick={goNext} disabled={!canGoStep(step + 1)}>
              Lanjut
            </button>
          ) : (
            <button type="button" className="pb-btn pri" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Buat split bill'}
            </button>
          )}
        </div>
      </article>
      <div className="pb-tear" />
      <p className="pb-foot">Gratis, tanpa daftar</p>

      {pickP && (
        <AvatarPicker
          key={pickP.id}
          name={pickP.name.trim() || 'Peserta'}
          value={pickP.avatar}
          onSave={(avatar) => {
            updateParticipant(pickP.id, { avatar });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </main>
  );
}
