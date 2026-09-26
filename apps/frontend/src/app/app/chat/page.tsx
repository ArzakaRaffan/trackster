'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ChevronLeft, History, Plus, Send, Trash2, Wallet, Coffee, TrendingUp, ShoppingBag, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import { TracksterMascot } from '@/components/TracksterMascot';

interface Thread {
  id: number;
  title: string | null;
  channel: 'WEB' | 'TELEGRAM';
  archivedAt: string | null;
  updatedAt: string;
}

interface ThreadMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  { label: 'Sisa budget hari ini?', Icon: Wallet, text: 'Berapa sisa budget hari ini?' },
  { label: 'Catat kopi 25rb', Icon: Coffee, text: 'Beli kopi 25rb tadi di Jago' },
  { label: 'Pengeluaran bulan ini', Icon: TrendingUp, text: 'Gimana pengeluaran saya bulan ini?' },
  { label: 'Cek sebelum beli', Icon: ShoppingBag, text: 'Saya mau beli gadget 2jt, aman ga?' },
];

const WELCOME: DisplayMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Halo Arzaka! Aku Track, financial buddy kamu. Mau cek kondisi keuangan, minta saran pengeluaran, atau catat transaksi bareng?',
};

function renderMessageBody(content: string) {
  // Lightweight formatting: **bold** and plain paragraphs. No full markdown parser.
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function fmtThreadDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function ChatPage() {
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: threads, mutate: mutateThreads } = useSWR<Thread[]>('/ai/threads', (p: string) =>
    api.get<Thread[]>(p),
  );
  const messagesKey = activeThreadId ? `/ai/threads/${activeThreadId}/messages` : null;
  const { data: threadMessages, mutate: mutateMessages } = useSWR<ThreadMessage[]>(
    messagesKey,
    (p: string) => api.get<ThreadMessage[]>(p),
  );

  const visibleThreads = (threads ?? []).filter((t) => !t.archivedAt);

  const messages: DisplayMessage[] =
    activeThreadId === null
      ? [WELCOME]
      : (threadMessages ?? []).map((m) => ({ id: `m-${m.id}`, role: m.role, content: m.content }));

  const displayMessages = pendingUser
    ? [...messages, { id: 'pending-user', role: 'user' as const, content: pendingUser }]
    : messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length, sending]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    setPendingUser(text);

    try {
      let threadId = activeThreadId;
      if (threadId === null) {
        const thread = await api.post<Thread>('/ai/threads');
        threadId = thread.id;
        setActiveThreadId(threadId);
        mutateThreads();
      }
      await api.post<{ reply: string }>(`/ai/threads/${threadId}/messages`, { text });
      await Promise.all([
        mutateMessages(undefined, { revalidate: true }),
        mutateThreads(),
      ]);
    } catch {
      // Biarkan history apa adanya; tampilkan pesan error sebagai bubble sementara.
      setPendingUser(null);
      setSending(false);
      inputRef.current?.focus();
      return;
    }

    setPendingUser(null);
    setSending(false);
    inputRef.current?.focus();
  };

  const startNewChat = () => {
    setActiveThreadId(null);
    setDrawerOpen(false);
  };

  const openThread = (id: number) => {
    setActiveThreadId(id);
    setDrawerOpen(false);
  };

  const deleteThread = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/ai/threads/${id}`);
    if (activeThreadId === id) setActiveThreadId(null);
    mutateThreads();
  };

  const showQuick = activeThreadId === null && !sending;

  return (
    <div className="relative flex h-screen flex-col pb-navbar">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line-subtle bg-base/[0.9] px-4 py-3.5 backdrop-blur-md">
        <Link href="/app/more" aria-label="Kembali" className="text-ink-muted transition-colors hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <TracksterMascot mood={sending ? 'thinking' : 'happy'} size="md" glow />
        <div className="min-w-0 flex-1">
          <h1 className="font-title text-heading font-bold text-ink truncate">Tanya Track</h1>
          <p className="text-micro text-ink-muted">
            {sending ? 'Lagi mikir…' : 'AI Financial Buddy · online'}
          </p>
        </div>
        <button
          type="button"
          onClick={startNewChat}
          aria-label="Chat baru"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-interactive hover:text-ink"
        >
          <Plus size={19} />
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Riwayat chat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-interactive hover:text-ink"
        >
          <History size={19} />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {displayMessages.length === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={TRANSITION_SLOW}
            className="mb-2 flex flex-col items-center gap-3 rounded-panel bg-surface px-5 py-8 text-center"
          >
            <TracksterMascot mood="happy" size="lg" glow />
            <div>
              <p className="font-title text-heading font-bold text-ink">Mau bahas apa hari ini?</p>
              <p className="mt-1 text-small leading-relaxed text-ink-muted">
                Tanya sisa budget, catat pengeluaran, atau minta saran sebelum belanja.
              </p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {displayMessages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={TRANSITION_BASE}
              className={`flex items-end gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {m.role === 'assistant' ? (
                <span className="mb-0.5 shrink-0">
                  <TracksterMascot mood="idle" size="sm" />
                </span>
              ) : (
                <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-micro font-bold text-base">
                  A
                </span>
              )}
              <div
                className={`max-w-[82%] rounded-panel px-4 py-3 text-body leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'rounded-br-subtle bg-brand text-base font-medium'
                    : 'rounded-bl-subtle bg-surface text-ink shadow-hairline'
                }`}
              >
                {m.role === 'assistant' ? renderMessageBody(m.content) : m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2.5"
          >
            <TracksterMascot mood="thinking" size="sm" />
            <div className="flex items-center gap-2 rounded-panel rounded-bl-subtle bg-surface px-4 py-3 shadow-hairline">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-brand"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
              <span className="text-small text-ink-muted">Track lagi nulis jawaban…</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showQuick && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-2">
          {QUICK_PROMPTS.map(({ label, Icon, text }) => (
            <button
              key={text}
              type="button"
              onClick={() => handleSend(text)}
              className="flex items-center gap-2.5 rounded-comfortable bg-surface px-3 py-2.5 text-left shadow-hairline transition-colors hover:bg-surface-alt"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-brand">
                <Icon size={15} />
              </span>
              <span className="text-small font-bold leading-snug text-ink">{label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-line-subtle bg-base/[0.9] p-3 backdrop-blur-md sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya atau catat pengeluaran…"
            disabled={sending}
            className="flex-1 rounded-comfortable bg-surface-interactive px-4 py-3 text-body text-ink placeholder:text-ink-subtle outline-none shadow-field transition-shadow duration-base ease-standard focus:shadow-field-focus"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Kirim pesan"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold transition-all hover:brightness-108 active:scale-[.94] disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION_BASE}
              className="absolute inset-0 z-20 bg-ink/40"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={TRANSITION_SLOW}
              className="absolute inset-y-0 left-0 z-30 flex w-[82%] max-w-xs flex-col bg-base shadow-hairline"
            >
              <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3.5">
                <h2 className="font-title text-heading font-bold text-ink">Riwayat Chat</h2>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Tutup"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-interactive hover:text-ink"
                >
                  <X size={17} />
                </button>
              </div>
              <button
                type="button"
                onClick={startNewChat}
                className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-comfortable bg-brand px-4 py-2.5 text-small font-bold text-base"
              >
                <Plus size={16} /> Chat baru
              </button>
              <div className="mt-2 flex-1 overflow-y-auto px-2 pb-4">
                {visibleThreads.length === 0 && (
                  <p className="px-2 py-6 text-center text-small text-ink-muted">Belum ada percakapan tersimpan.</p>
                )}
                {visibleThreads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openThread(t.id)}
                    className={`group mt-1 flex w-full items-center gap-2 rounded-comfortable px-3 py-2.5 text-left transition-colors ${
                      t.id === activeThreadId ? 'bg-surface-interactive' : 'hover:bg-surface-interactive'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-bold text-ink">{t.title || 'Percakapan baru'}</p>
                      <p className="text-micro text-ink-muted">{fmtThreadDate(t.updatedAt)}</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => deleteThread(t.id, e)}
                      aria-label="Hapus percakapan"
                      className="shrink-0 rounded-full p-1.5 text-ink-subtle opacity-0 transition-opacity hover:text-status-over group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
