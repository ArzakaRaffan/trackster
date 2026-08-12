'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api, API_URL } from '@/lib/api';

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

export default function SettingsPage() {
  const searchParams = useSearchParams();
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

  return (
    <div className="space-y-6">
      {/* Gmail */}
      <section className="bg-white border rounded-2xl p-6">
        <h2 className="font-semibold mb-1">Gmail</h2>
        <p className="text-sm text-gray-500 mb-4">
          Hubungkan akun Gmail untuk membaca notifikasi transaksi otomatis.
        </p>

        {gmailStatus?.connected ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-green-800">Terhubung</p>
              <p className="text-xs text-green-600">{gmailStatus.email}</p>
            </div>
            <button onClick={handleDisconnectGmail} className="text-xs text-red-500">
              Putuskan
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnectGmail}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium text-sm"
          >
            Hubungkan Gmail
          </button>
        )}

        {gmailParam === 'error' && (
          <p className="text-warn text-sm mt-2">
            Gagal connect: {searchParams.get('message') || 'unknown error'}
          </p>
        )}

        <button
          onClick={handleManualSync}
          disabled={syncing || !gmailStatus?.connected}
          className="w-full mt-3 border rounded-lg py-2 text-sm font-medium disabled:opacity-40"
        >
          {syncing ? 'Sinkronisasi...' : 'Sync Manual Sekarang'}
        </button>
        {syncResult && <p className="text-xs text-gray-500 mt-2">{syncResult}</p>}
      </section>

      {/* Telegram */}
      <section className="bg-white border rounded-2xl p-6">
        <h2 className="font-semibold mb-1">Telegram</h2>
        <p className="text-sm text-gray-500 mb-4">Bot untuk kirim notifikasi kalau budget harian terlampaui.</p>

        {telegramStatus?.configured && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm">
            <p className="text-blue-800">Sudah dikonfigurasi</p>
            <p className="text-xs text-blue-600">
              Token: {telegramStatus.botTokenPreview} · Chat ID: {telegramStatus.chatId}
            </p>
          </div>
        )}

        <label className="block text-sm mb-1">Bot Token</label>
        <input
          className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
          placeholder="123456:ABC-DEF..."
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
        />

        <label className="block text-sm mb-1">Chat ID</label>
        <input
          className="w-full border rounded-lg px-3 py-2 mb-4 text-sm"
          placeholder="6642095960"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
        />

        <button
          onClick={handleSaveTelegram}
          disabled={savingTelegram || !botToken || !chatId}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium text-sm disabled:opacity-50"
        >
          {savingTelegram ? 'Menyimpan...' : 'Simpan'}
        </button>

        {telegramStatus?.configured && (
          <button onClick={handleTestTelegram} className="w-full mt-2 border rounded-lg py-2 text-sm font-medium">
            Kirim Test Notifikasi
          </button>
        )}
        {testResult && <p className="text-xs text-gray-500 mt-2">{testResult}</p>}
      </section>

      <p className="text-xs text-gray-400 text-center">API: {API_URL}</p>
    </div>
  );
}
