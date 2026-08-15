'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api, API_URL } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { formatRupiah } from '@/lib/format';
import { Mail, Send, LogOut, Check, Wallet, History, Tag, Pencil, Trash2, X } from 'lucide-react';

interface GmailStatus {
  connected: boolean;
  email?: string;
}

interface TelegramStatus {
  configured: boolean;
  isActive?: boolean;
  botTokenPreview?: string;
  chatId?: string;
  notifyEveryTransaction?: boolean;
}

interface NextRun {
  nextRunAt: string;
}

interface BankBalanceData {
  id: number;
  source: 'BCA' | 'JAGO' | 'GOPAY';
  balance: number;
  lastUpdatedAt: string;
}

interface BalanceAdjustmentData {
  id: number;
  source: string;
  delta: number;
  note: string | null;
  createdAt: string;
}

interface MerchantAliasData {
  id: number;
  rawDescription: string;
  displayName: string;
}

const gmailFetcher = (path: string) => api.get<GmailStatus>(path);
const telegramFetcher = (path: string) => api.get<TelegramStatus>(path);
const nextRunFetcher = (path: string) => api.get<NextRun>(path);
const balanceFetcher = (path: string) => api.get<BankBalanceData[]>(path);
const adjustmentsFetcher = (path: string) => api.get<BalanceAdjustmentData[]>(path);
const merchantAliasFetcher = (path: string) => api.get<MerchantAliasData[]>(path);

function useCountdown(targetIso?: string) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!targetIso) {
      setLabel('');
      return;
    }
    const target = new Date(targetIso).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setLabel(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return label;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: gmailStatus, mutate: mutateGmail } = useSWR('/gmail/status', gmailFetcher);
  const { data: telegramStatus, mutate: mutateTelegram } = useSWR('/telegram/status', telegramFetcher);
  const { data: nextRun, mutate: mutateNextRun } = useSWR('/sync/next-run', nextRunFetcher, {
    refreshInterval: 30_000,
  });
  const countdown = useCountdown(nextRun?.nextRunAt);
  const { data: balances, mutate: mutateBalances } = useSWR('/balance', balanceFetcher);
  const { data: aliases, mutate: mutateAliases } = useSWR('/merchant-aliases', merchantAliasFetcher);
  const [aliasListParent] = useAutoAnimate({ duration: 200, easing: 'cubic-bezier(.3,0,.4,1)' });

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [notifyingEveryTx, setNotifyingEveryTx] = useState(false);

  const gmailParam = searchParams.get('gmail');

  useEffect(() => {
    if (gmailParam === 'connected') mutateGmail();
  }, [gmailParam, mutateGmail]);

  const handleConnectGmail = async () => {
    const { url } = await api.get<{ url: string }>('/gmail/auth-url');
    window.location.href = url;
  };

  const handleDisconnectGmail = async () => {
    await api.post('/gmail/disconnect');
    mutateGmail();
  };

  const handleSaveTelegram = async () => {
    setSavingTelegram(true);
    try {
      await api.put('/telegram/config', { botToken, chatId });
      await mutateTelegram();
      setBotToken('');
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestResult(null);
    const res = await api.post<{ success: boolean }>('/telegram/test');
    setTestResult(res.success ? 'Terkirim! Cek Telegram kamu.' : 'Gagal kirim. Cek konfigurasi.');
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post<{ synced: number; error?: string }>('/sync/trigger');
      setSyncResult(res.error ? `Error: ${res.error}` : `${res.synced} transaksi baru disinkronkan.`);
      mutateNextRun();
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleNotifyEveryTx = async (next: boolean) => {
    setNotifyingEveryTx(true);
    try {
      await api.put('/telegram/config', { notifyEveryTransaction: next });
      await mutateTelegram();
    } finally {
      setNotifyingEveryTx(false);
    }
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    router.push('/login');
  };

  return (
    <div className="pb-navbar animate-fade-in-up">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Akun & sinkronisasi</p>
        <h1 className="font-title text-title font-bold text-ink">Setting</h1>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {/* Gmail */}
        <section className="rounded-comfortable bg-surface p-5">
          <h2 className="flex items-center gap-2 text-heading font-semibold text-ink">
            <Mail size={18} /> Gmail
          </h2>
          <p className="mt-1 text-small leading-relaxed text-ink-muted">
            Hubungkan akun Gmail untuk membaca notifikasi transaksi otomatis.
          </p>

          {gmailStatus?.connected ? (
            <div className="mt-4 flex items-center justify-between rounded-standard bg-status-under-bg px-3.5 py-3">
              <div>
                <p className="text-label font-bold text-status-under">Terhubung</p>
                <p className="text-small text-ink-muted">{gmailStatus.email}</p>
              </div>
              <button onClick={handleDisconnectGmail} className="text-small text-ink-muted hover:text-status-over">
                Putuskan
              </button>
            </div>
          ) : (
            <Button variant="dark" fullWidth className="mt-4" onClick={handleConnectGmail}>
              Hubungkan Gmail
            </Button>
          )}

          {gmailParam === 'error' && (
            <p className="mt-2 text-small text-status-over">
              Gagal connect: {searchParams.get('message') || 'unknown error'}
            </p>
          )}

          <Button
            variant="outlined"
            fullWidth
            className="mt-3"
            onClick={handleManualSync}
            disabled={syncing || !gmailStatus?.connected}
          >
            {syncing ? 'Sinkronisasi...' : 'Sync manual sekarang'}
          </Button>
          {syncResult && <p className="mt-2 text-small text-ink-muted">{syncResult}</p>}
          {countdown && (
            <p className="mt-2 text-small text-ink-subtle">Sync otomatis berikutnya dalam {countdown}</p>
          )}
        </section>

        {/* Saldo bank */}
        <section className="rounded-comfortable bg-surface p-5">
          <h2 className="flex items-center gap-2 text-heading font-semibold text-ink">
            <Wallet size={18} /> Saldo bank
          </h2>
          <p className="mt-1 text-small leading-relaxed text-ink-muted">
            Perkiraan saldo, bergerak otomatis dari transaksi & pemasukan. Koreksi manual kalau meleset.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            {(['BCA', 'JAGO'] as const).map((source) => (
              <BankBalanceRow
                key={source}
                source={source}
                data={balances?.find((b) => b.source === source)}
                onAdjusted={() => mutateBalances()}
              />
            ))}
          </div>
        </section>

        {/* Telegram */}
        <section className="rounded-comfortable bg-surface p-5">
          <h2 className="flex items-center gap-2 text-heading font-semibold text-ink">
            <Send size={18} /> Telegram
          </h2>
          <p className="mt-1 text-small leading-relaxed text-ink-muted">
            Bot untuk kirim notifikasi kalau budget harian terlampaui.
          </p>

          {telegramStatus?.configured && (
            <div className="mt-4 rounded-standard bg-status-info-bg px-3.5 py-3">
              <p className="text-label font-bold text-status-info">Sudah dikonfigurasi</p>
              <p className="text-small text-ink-muted">
                Token: {telegramStatus.botTokenPreview} · Chat ID: {telegramStatus.chatId}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <Input
              label="Bot token"
              placeholder="123456:ABC-DEF..."
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
            <Input label="Chat ID" placeholder="6642095960" value={chatId} onChange={(e) => setChatId(e.target.value)} />
          </div>

          <Button
            variant="primary"
            fullWidth
            className="mt-4"
            onClick={handleSaveTelegram}
            disabled={savingTelegram || !botToken || !chatId}
          >
            {savingTelegram ? 'Menyimpan...' : 'Simpan'}
          </Button>

          {telegramStatus?.configured && (
            <Button variant="outlined" fullWidth className="mt-2" onClick={handleTestTelegram}>
              Kirim test notifikasi
            </Button>
          )}
          {testResult && (
            <p className="mt-2 flex items-center gap-1.5 text-small text-ink-muted">
              <Check size={14} /> {testResult}
            </p>
          )}

          {telegramStatus?.configured && (
            <div className="mt-4 border-t border-line-subtle pt-4">
              <Switch
                checked={!!telegramStatus.notifyEveryTransaction}
                onChange={handleToggleNotifyEveryTx}
                disabled={notifyingEveryTx}
                label="Notifikasi tiap transaksi baru"
                description="Kirim pesan Telegram setiap ada transaksi masuk, bukan cuma pas over budget."
              />
            </div>
          )}
        </section>

        {/* Alias merchant */}
        <section className="rounded-comfortable bg-surface p-5">
          <h2 className="flex items-center gap-2 text-heading font-semibold text-ink">
            <Tag size={18} /> Alias merchant
          </h2>
          <p className="mt-1 text-small leading-relaxed text-ink-muted">
            Nama panggilan buat merchant. Berlaku otomatis ke semua transaksi dengan nama asli yang sama.
          </p>

          <div ref={aliasListParent} className="mt-4 flex flex-col gap-2">
            {!aliases ? (
              <p className="text-small text-ink-muted">Memuat...</p>
            ) : aliases.length === 0 ? (
              <p className="text-small text-ink-muted">
                Belum ada alias. Set dari baris transaksi (tombol &quot;Ganti nama&quot;) di halaman Hari Ini/Mingguan/Laporan.
              </p>
            ) : (
              aliases.map((alias) => (
                <MerchantAliasRow key={alias.id} alias={alias} onChanged={() => mutateAliases()} />
              ))
            )}
          </div>
        </section>

        <Button variant="danger" fullWidth icon={<LogOut size={18} />} onClick={handleLogout}>
          Keluar
        </Button>

        <p className="text-center text-small text-ink-subtle">API: {API_URL}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-small text-ink-muted">Memuat...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

const SOURCE_LABEL: Record<string, string> = { BCA: 'BCA', JAGO: 'Jago' };

function BankBalanceRow({
  source,
  data,
  onAdjusted,
}: {
  source: 'BCA' | 'JAGO';
  data?: BankBalanceData;
  onAdjusted: () => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: adjustments } = useSWR(
    historyOpen ? `/balance/${source}/adjustments` : null,
    adjustmentsFetcher,
  );

  const openAdjustForm = () => {
    setNewBalance(data ? String(data.balance) : '0');
    setNote('');
    setAdjustOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.put(`/balance/${source}`, {
        newBalance: parseFloat(newBalance) || 0,
        note: note || undefined,
      });
      onAdjusted();
      setAdjustOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-standard bg-surface-interactive p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label font-bold text-ink">{SOURCE_LABEL[source]}</p>
          {data && (
            <p className="text-small text-ink-muted">
              Update {new Date(data.lastUpdatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {data ? (
          <AnimatedAmount value={data.balance} className="font-title text-heading font-bold tabular-nums text-ink" />
        ) : (
          <p className="font-title text-heading font-bold tabular-nums text-ink">—</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <button
          onClick={() => (adjustOpen ? setAdjustOpen(false) : openAdjustForm())}
          className="text-small font-bold text-ink-muted hover:text-ink"
        >
          {adjustOpen ? 'Batal' : 'Sesuaikan saldo'}
        </button>
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center gap-1 text-small text-ink-muted hover:text-ink"
        >
          <History size={13} /> Lihat riwayat penyesuaian
        </button>
      </div>

      {adjustOpen && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-line-subtle pt-3">
          <Input
            label="Saldo baru"
            type="number"
            inputMode="numeric"
            prefix="Rp"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
          />
          <Input
            label="Catatan (opsional)"
            placeholder="Kenapa dikoreksi..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan koreksi'}
          </Button>
        </div>
      )}

      {historyOpen && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-line-subtle pt-3">
          {!adjustments ? (
            <p className="text-small text-ink-muted">Memuat...</p>
          ) : adjustments.length === 0 ? (
            <p className="text-small text-ink-muted">Belum ada riwayat penyesuaian.</p>
          ) : (
            adjustments.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between gap-2 text-small">
                <div className="min-w-0">
                  <p className="truncate text-ink-muted">{adj.note || 'Tanpa catatan'}</p>
                  <p className="text-micro text-ink-subtle">
                    {new Date(adj.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`shrink-0 font-bold tabular-nums ${adj.delta >= 0 ? 'text-status-under' : 'text-status-over'}`}>
                  {adj.delta >= 0 ? '+' : ''}
                  {formatRupiah(adj.delta)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MerchantAliasRow({ alias, onChanged }: { alias: MerchantAliasData; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(alias.displayName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/merchant-aliases/${alias.id}`, { displayName: draft });
      onChanged();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/merchant-aliases/${alias.id}`);
    onChanged();
  };

  return (
    <div className="rounded-standard bg-surface-interactive p-4">
      {editing ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Nama panggilan" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving || !draft.trim()}>
            {saving ? '...' : 'Simpan'}
          </Button>
          <button
            onClick={() => setEditing(false)}
            aria-label="Batal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-label font-bold text-ink">{alias.displayName}</p>
            <p className="truncate text-small text-ink-muted">{alias.rawDescription}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit alias"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:text-ink"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={handleDelete}
              aria-label="Hapus alias"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:text-status-over"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
