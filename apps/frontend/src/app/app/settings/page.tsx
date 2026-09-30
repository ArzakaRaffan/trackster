'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { AnimatePresence, motion } from 'motion/react';
import { api, API_URL } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { formatRupiah } from '@/lib/format';
import { EASE_ENTER, TRANSITION_FAST } from '@/lib/motion';
import { Mail, Send, LogOut, Check, Wallet, History, Tag, Pencil, Trash2, X, MailWarning, ChevronDown } from 'lucide-react';

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

interface EmailParseLogData {
  id: number;
  emailId: string;
  from: string;
  subject: string;
  receivedAt: string;
  status: 'RECORDED' | 'EXCLUDED' | 'UNPARSED' | 'DUPLICATE' | 'ERROR';
  reason: string | null;
}

const gmailFetcher = (path: string) => api.get<GmailStatus>(path);
const telegramFetcher = (path: string) => api.get<TelegramStatus>(path);
const nextRunFetcher = (path: string) => api.get<NextRun>(path);
const balanceFetcher = (path: string) => api.get<BankBalanceData[]>(path);
const adjustmentsFetcher = (path: string) => api.get<BalanceAdjustmentData[]>(path);
const parseLogFetcher = (path: string) => api.get<EmailParseLogData[]>(path);
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

type SettingsTab = 'connections' | 'sync' | 'balance' | 'aliases';

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'connections', label: 'Koneksi' },
  { id: 'sync', label: 'Sinkronisasi' },
  { id: 'balance', label: 'Saldo bank' },
  { id: 'aliases', label: 'Alias merchant' },
];

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

  const [tab, setTab] = useState<SettingsTab>('connections');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [backfillAfter, setBackfillAfter] = useState('2026-09-05');
  const [backfillBefore, setBackfillBefore] = useState('2026-09-18');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
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

  const handleBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await api.post<{
        synced: number;
        scanned?: number;
        skippedDuplicate?: number;
        error?: string;
        query?: string;
      }>('/sync/backfill', { after: backfillAfter, before: backfillBefore });
      if (res.error) {
        setBackfillResult(`Error: ${res.error}`);
      } else {
        setBackfillResult(
          `${res.synced} transaksi baru dari ${res.scanned ?? 0} email (duplikat dilewati: ${res.skippedDuplicate ?? 0}).`,
        );
      }
    } finally {
      setBackfilling(false);
    }
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
    <div className="flex flex-col gap-5 px-4 pt-2 lg:px-0">
      <header>
        <h1 className="font-title text-[32px] font-bold tracking-[-0.02em] text-text">Setting</h1>
        <p className="text-[15px] text-text-subtle">Akun & sinkronisasi</p>
      </header>

      {/* Pill tab */}
      <div className="flex gap-1 overflow-x-auto rounded-full-pill bg-card p-1 shadow-card">
        {SETTINGS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full-pill px-3.5 py-1.5 text-small font-bold transition-colors duration-fast ease-standard ${
              tab === t.id ? 'bg-neutral text-text' : 'text-text-subtle hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: EASE_ENTER }}
          className="flex flex-col gap-4"
        >
          {tab === 'connections' && (
            <>
              {/* Gmail */}
              <section className="rounded-card-lg bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 text-heading font-bold text-text">
                  <Mail size={18} /> Gmail
                </h2>
                <p className="mt-1 text-small leading-relaxed text-text-subtle">
                  Hubungkan akun Google untuk baca notifikasi Gmail dan bikin reminder langganan di Calendar. Setelah update scope Calendar, disconnect lalu connect ulang.
                </p>

                {gmailStatus?.connected ? (
                  <div className="mt-4 flex items-center justify-between rounded-row bg-status-under-bg px-3.5 py-3">
                    <div>
                      <p className="text-label font-bold text-status-under">Terhubung</p>
                      <p className="text-small text-text-subtle">{gmailStatus.email}</p>
                    </div>
                    <button onClick={handleDisconnectGmail} className="text-small text-text-subtle hover:text-status-over">
                      Putuskan
                    </button>
                  </div>
                ) : (
                  <Button variant="dark" fullWidth className="mt-4" onClick={handleConnectGmail}>
                    Hubungkan Google
                  </Button>
                )}

                {gmailParam === 'error' && (
                  <p className="mt-2 text-small text-status-over">
                    Gagal connect: {searchParams.get('message') || 'unknown error'}
                  </p>
                )}
              </section>

              {/* Telegram */}
              <section className="rounded-card-lg bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 text-heading font-bold text-text">
                  <Send size={18} /> Telegram
                </h2>
                <p className="mt-1 text-small leading-relaxed text-text-subtle">
                  Bot untuk kirim notifikasi kalau budget harian terlampaui.
                </p>

                {telegramStatus?.configured && (
                  <div className="mt-4 rounded-row bg-status-info-bg px-3.5 py-3">
                    <p className="text-label font-bold text-status-info">Sudah dikonfigurasi</p>
                    <p className="text-small text-text-subtle">
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
                  <Input label="Chat ID" placeholder="123456789" value={chatId} onChange={(e) => setChatId(e.target.value)} />
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
                  <p className="mt-2 flex items-center gap-1.5 text-small text-text-subtle">
                    <Check size={14} /> {testResult}
                  </p>
                )}

                {telegramStatus?.configured && (
                  <div className="mt-4 border-t border-border pt-4">
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
            </>
          )}

          {tab === 'sync' && (
            <section className="rounded-card-lg bg-card p-6 shadow-card">
              <h2 className="text-heading font-bold text-text">Sinkronisasi email</h2>
              <p className="mt-1 text-small leading-relaxed text-text-subtle">
                Trackster membaca notifikasi email bank (BCA & Jago) secara berkala.
              </p>

              {countdown && (
                <p className="mt-4 rounded-medium bg-neutral px-3.5 py-3 text-small text-text-subtle">
                  Sync otomatis berikutnya dalam {countdown}
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
              {syncResult && <p className="mt-2 text-small text-text-subtle">{syncResult}</p>}

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-label font-bold text-text">Backfill rentang tanggal</p>
                <p className="mt-1 text-small leading-relaxed text-text-subtle">
                  Sync biasa cuma 7 hari terakhir. Pakai ini buat tarik ulang email bank di rentang yang kosong
                  (tanggal akhir bersifat exclusive, jadi 18 = sampai 17).
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Input
                    label="Dari (inclusive)"
                    type="date"
                    value={backfillAfter}
                    onChange={(e) => setBackfillAfter(e.target.value)}
                  />
                  <Input
                    label="Sampai sebelum"
                    type="date"
                    value={backfillBefore}
                    onChange={(e) => setBackfillBefore(e.target.value)}
                  />
                </div>
                <Button
                  variant="outlined"
                  fullWidth
                  className="mt-3"
                  onClick={handleBackfill}
                  disabled={backfilling || !gmailStatus?.connected || !backfillAfter || !backfillBefore}
                >
                  {backfilling ? 'Backfill...' : 'Backfill rentang ini'}
                </Button>
                {backfillResult && <p className="mt-2 text-small text-text-subtle">{backfillResult}</p>}
              </div>

              <EmailParseLogSection />
            </section>
          )}

          {tab === 'balance' && (
            <section className="rounded-card-lg bg-card p-6 shadow-card">
              <h2 className="flex items-center gap-2 text-heading font-bold text-text">
                <Wallet size={18} /> Saldo bank
              </h2>
              <p className="mt-1 text-small leading-relaxed text-text-subtle">
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
          )}

          {tab === 'aliases' && (
            <section className="rounded-card-lg bg-card p-6 shadow-card">
              <h2 className="flex items-center gap-2 text-heading font-bold text-text">
                <Tag size={18} /> Alias merchant
              </h2>
              <p className="mt-1 text-small leading-relaxed text-text-subtle">
                Nama panggilan buat merchant. Berlaku otomatis ke semua transaksi dengan nama asli yang sama.
              </p>

              <div ref={aliasListParent} className="mt-4 flex flex-col gap-2">
                {!aliases ? (
                  <p className="text-small text-text-subtle">Memuat...</p>
                ) : aliases.length === 0 ? (
                  <p className="text-small text-text-subtle">
                    Belum ada alias. Set dari baris transaksi (tombol &quot;Ganti nama&quot;) di halaman Hari Ini/Mingguan/Laporan.
                  </p>
                ) : (
                  aliases.map((alias) => (
                    <MerchantAliasRow key={alias.id} alias={alias} onChanged={() => mutateAliases()} />
                  ))
                )}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <Button variant="danger" fullWidth icon={<LogOut size={18} />} onClick={handleLogout}>
        Keluar
      </Button>

      <p className="text-center text-small text-text-subtlest">API: {API_URL}</p>
    </div>
  );
}

const STATUS_LABEL: Record<EmailParseLogData['status'], string> = {
  RECORDED: 'Tercatat',
  EXCLUDED: 'Dikecualikan',
  UNPARSED: 'Gagal dibaca',
  DUPLICATE: 'Duplikat',
  ERROR: 'Error',
};

function EmailParseLogSection() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<EmailParseLogData['status']>('UNPARSED');
  const { data: logs } = useSWR(
    open ? `/sync/parse-log?status=${status}&limit=50` : null,
    parseLogFetcher,
  );

  return (
    <section className="mt-5 rounded-card bg-neutral p-4">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h2 className="flex items-center gap-2 text-heading font-bold text-text">
          <MailWarning size={18} /> Email yang gagal dibaca
        </h2>
        <ChevronDown
          size={18}
          className={`text-text-subtlest transition-transform duration-base ease-standard ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['UNPARSED', 'ERROR', 'EXCLUDED', 'DUPLICATE', 'RECORDED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`whitespace-nowrap rounded-pill px-3 py-1.5 text-label font-semibold transition-colors duration-fast ease-standard ${
                    status === s ? 'bg-text text-page' : 'bg-neutral text-text-subtle hover:text-text'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {!logs && <p className="mt-3 text-small text-text-subtle">Memuat...</p>}
            {logs && logs.length === 0 && (
              <p className="mt-3 text-small text-text-subtle">Nggak ada email berstatus {STATUS_LABEL[status]}.</p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {logs?.map((log) => (
                <a
                  key={log.id}
                  href={`https://mail.google.com/mail/u/0/#all/${log.emailId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-row bg-card px-3.5 py-3 transition-colors hover:bg-hover"
                >
                  <p className="text-label font-semibold text-text">{log.subject || '(tanpa subjek)'}</p>
                  <p className="mt-0.5 text-small text-text-subtle">{log.from}</p>
                  {log.reason && <p className="mt-1 text-small text-text-subtlest">{log.reason}</p>}
                  <p className="mt-1 text-small text-text-subtlest">
                    {new Date(log.receivedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-small text-text-subtle">Memuat...</div>}>
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
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const { data: adjustments } = useSWR(
    historyOpen ? `/balance/${source}/adjustments` : null,
    adjustmentsFetcher,
  );

  const openAdjustForm = () => {
    setNewBalance(data ? String(data.balance) : '0');
    setNote('');
    setShowAdjustModal(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.put(`/balance/${source}`, {
        newBalance: parseFloat(newBalance) || 0,
        note: note || undefined,
      });
      onAdjusted();
      setShowAdjustModal(false);
    } finally {
      setSaving(false);
    }
  };

  const delta = data ? parseFloat(newBalance) - data.balance : 0;

  return (
    <div className="rounded-row bg-neutral p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label font-bold text-text">{SOURCE_LABEL[source]}</p>
          {data && (
            <p className="text-small text-text-subtle">
              Update {new Date(data.lastUpdatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {data ? (
          <AnimatedAmount value={data.balance} className="font-title text-heading font-bold tabular-nums text-text" />
        ) : (
          <p className="font-title text-heading font-bold tabular-nums text-text">—</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <button onClick={openAdjustForm} className="text-small font-bold text-text-subtle hover:text-text">
          Sesuaikan saldo
        </button>
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center gap-1 text-small text-text-subtle hover:text-text"
        >
          <History size={13} /> Lihat riwayat penyesuaian
        </button>
      </div>

      <AnimatePresence>
        {showAdjustModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FAST}
            onClick={() => setShowAdjustModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE_ENTER }}
              className="flex w-full max-w-[440px] flex-col gap-3 rounded-panel bg-card p-6 shadow-overlay"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-small font-bold uppercase tracking-caps text-text-subtle">Koreksi saldo</p>
                  <h3 className="font-title text-heading font-bold text-text">{SOURCE_LABEL[source]}</h3>
                </div>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral text-text-subtle hover:text-text"
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>

              {data && (
                <p className="rounded-medium bg-neutral px-3.5 py-2.5 text-small text-text-subtle">
                  Selisih:{' '}
                  <span className={`font-bold tabular-nums ${delta >= 0 ? 'text-status-under' : 'text-status-over'}`}>
                    {delta >= 0 ? '+' : ''}
                    {formatRupiah(delta)}
                  </span>
                </p>
              )}

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
              <Button variant="primary" fullWidth onClick={handleSubmit} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan koreksi'}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="grid transition-[grid-template-rows] duration-[250ms] ease-enter"
        style={{ gridTemplateRows: historyOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
            {!adjustments ? (
              <p className="text-small text-text-subtle">Memuat...</p>
            ) : adjustments.length === 0 ? (
              <p className="text-small text-text-subtle">Belum ada riwayat penyesuaian.</p>
            ) : (
              adjustments.map((adj) => (
                <div key={adj.id} className="flex items-center justify-between gap-2 text-small">
                  <div className="min-w-0">
                    <p className="truncate text-text-subtle">{adj.note || 'Tanpa catatan'}</p>
                    <p className="text-micro text-text-subtlest">
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
        </div>
      </div>
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
    <div className="rounded-row bg-neutral p-4">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-subtle hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-label font-bold text-text">{alias.displayName}</p>
            <p className="truncate text-small text-text-subtle">{alias.rawDescription}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit alias"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-subtle hover:text-text"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={handleDelete}
              aria-label="Hapus alias"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-subtle hover:text-status-over"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
