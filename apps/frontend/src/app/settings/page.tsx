'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api, API_URL } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Mail, Send, LogOut, Check } from 'lucide-react';

interface GmailStatus {
  connected: boolean;
  email?: string;
}

interface TelegramStatus {
  configured: boolean;
  isActive?: boolean;
  botTokenPreview?: string;
  chatId?: string;
}

const gmailFetcher = (path: string) => api.get<GmailStatus>(path);
const telegramFetcher = (path: string) => api.get<TelegramStatus>(path);

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: gmailStatus, mutate: mutateGmail } = useSWR('/gmail/status', gmailFetcher);
  const { data: telegramStatus, mutate: mutateTelegram } = useSWR('/telegram/status', telegramFetcher);

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

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
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    router.push('/login');
  };

  return (
    <div className="pb-navbar">
      <header className="sticky top-0 z-10 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <p className="text-small font-bold uppercase tracking-caps text-ink-muted">Akun & sinkronisasi</p>
        <h1 className="font-title text-title font-bold text-ink">Setting</h1>
      </header>

      <div className="flex flex-col gap-4 px-4">
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
