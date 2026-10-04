'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ArrowDown,
  Brain,
  Check,
  ChevronLeft,
  Copy,
  History,
  Plus,
  ArrowUp,
  Trash2,
  Wallet,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  CalendarDays,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { EASE_ENTER, TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import { Track } from '@/components/track/Track';
import { emitTrack } from '@/components/track/trackBus';
import { SimulationCard, SimulationCardData } from '@/components/chat/SimulationCard';
import { GoalProposalCard, GoalProposalCardData } from '@/components/chat/GoalProposalCard';
import { BudgetProposalCard, BudgetProposalCardData } from '@/components/chat/BudgetProposalCard';
import { MessageBody } from '@/components/chat/MessageBody';

type ChatCard = SimulationCardData | GoalProposalCardData | BudgetProposalCardData;

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
  attachments: ChatCard[] | null;
  createdAt: string;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatCard[] | null;
}

// Mode cepat (E04-S5) — tiap chip = template prompt yang mengarahkan tool yang tepat. Diisi ke
// input (bukan auto-send) karena beberapa butuh detail dari Arzaka dulu sebelum masuk akal dikirim.
const QUICK_PROMPTS = [
  { label: 'Mau beli sesuatu', Icon: ShoppingBag, text: 'Aku mau beli ' },
  { label: 'Simulasi rencana nabung', Icon: TrendingUp, text: 'Simulasiin dong kalau aku nabung ' },
  { label: 'Kenapa minggu ini boros?', Icon: AlertTriangle, text: 'Kenapa minggu ini boros banget?' },
  { label: 'Aku lagi bokek, harus gimana?', Icon: Wallet, text: 'Aku lagi bokek, harus gimana?' },
  { label: 'Review bulan ini', Icon: CalendarDays, text: 'Coba review pengeluaran aku bulan ini dong' },
  { label: 'Atur ulang budget', Icon: SlidersHorizontal, text: 'Bantuin atur ulang budget harian aku dong' },
];

function fmtThreadDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

const ACTIVE_THREAD_STORAGE_KEY = 'trackster_chat_active_thread';
const STICK_THRESHOLD_PX = 80;
const COMPOSER_MAX_PX = 160;

export default function ChatPage() {
  const [activeThreadId, setActiveThreadIdState] = useState<number | null>(null);
  const [hydratedThread, setHydratedThread] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: threads, mutate: mutateThreads } = useSWR<Thread[]>('/ai/threads', (p: string) =>
    api.get<Thread[]>(p),
  );
  const messagesKey = activeThreadId ? `/ai/threads/${activeThreadId}/messages` : null;
  const { data: threadMessages, mutate: mutateMessages } = useSWR<ThreadMessage[]>(
    messagesKey,
    (p: string) => api.get<ThreadMessage[]>(p),
  );

  const visibleThreads = (threads ?? []).filter((t) => !t.archivedAt);

  /** Thread aktif nggak disimpan cuma di React state - refresh halaman bikin state itu hilang
   * meskipun data di DB masih ada (persis kasus yang mau dicegah E04-S1). localStorage nyimpen
   * thread id terakhir, di-restore sekali begitu daftar thread pertama kali kebaca. */
  const setActiveThreadId = (id: number | null) => {
    stickRef.current = true;
    setActiveThreadIdState(id);
    try {
      if (id === null) localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
      else localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, String(id));
    } catch {
      // localStorage bisa gagal (private mode dll) - nggak fatal, cuma nggak ke-restore pas refresh.
    }
  };

  useEffect(() => {
    if (hydratedThread || !threads) return;
    setHydratedThread(true);
    try {
      const stored = localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
      const storedId = stored ? Number(stored) : null;
      if (storedId && threads.some((t) => t.id === storedId && !t.archivedAt)) {
        setActiveThreadIdState(storedId);
      }
    } catch {
      // ignore
    }
  }, [threads, hydratedThread]);

  const messages: DisplayMessage[] =
    activeThreadId === null
      ? []
      : (threadMessages ?? []).map((m) => ({ id: `m-${m.id}`, role: m.role, content: m.content, attachments: m.attachments }));

  const displayMessages = pendingUser
    ? [...messages, { id: 'pending-user', role: 'user' as const, content: pendingUser }]
    : messages;

  // Auto-scroll hanya kalau user memang lagi di bawah (seperti ChatGPT/Claude): kalau dia
  // scroll ke atas buat baca, token streaming tidak boleh menariknya turun.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTo({ top: el.scrollHeight });
  }, [displayMessages.length, sending, streamText, threadMessages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickRef.current = atBottom;
    setShowJump(!atBottom);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  // Composer auto-grow: reset ke auto dulu supaya bisa menyusut saat teks dihapus.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [input]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || sending) return;

    stickRef.current = true;
    setInput('');
    setSending(true);
    setPendingUser(text);
    emitTrack('ai:thinking');

    try {
      let threadId = activeThreadId;
      if (threadId === null) {
        const thread = await api.post<Thread>('/ai/threads');
        threadId = thread.id;
        setActiveThreadId(threadId);
        mutateThreads();
      }
      let failed: string | null = null;
      await api.postStream(`/ai/threads/${threadId}/messages/stream`, { text }, (e) => {
        if (e.type === 'token') setStreamText((prev) => (prev ?? '') + e.text);
        else if (e.type === 'reset') setStreamText(null); // tool dipanggil: teks pembuka dibuang, jawaban final menyusul
        else if (e.type === 'error') failed = e.message;
      });
      if (failed) throw new Error(failed);
      await Promise.all([
        mutateMessages(undefined, { revalidate: true }),
        mutateThreads(),
      ]);
    } catch {
      // Biarkan history apa adanya; tampilkan pesan error sebagai bubble sementara.
      setPendingUser(null);
      setStreamText(null);
      setSending(false);
      inputRef.current?.focus();
      return;
    }

    setPendingUser(null);
    setStreamText(null);
    setSending(false);
    emitTrack('ai:reply');
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

  const copyMessage = async (m: DisplayMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1500);
    } catch {
      // clipboard bisa ditolak (http/izin) - tidak fatal
    }
  };

  const isEmpty = displayMessages.length === 0;

  return (
    // Tinggi: h-dvh di mobile (navbar bawah dikompensasi pb-navbar). Di desktop `main` AppShell
    // punya lg:py-4 + lg:pb-28 (16 + 112px = 8rem, ruang buat mascot melayang) — tinggi panel
    // WAJIB dikurangi sebesar itu, kalau tidak body ikut scroll (scrollbar ganda). Ubah angka
    // padding `main` di AppShell → ubah `8rem` di sini juga.
    <div className="relative flex h-dvh flex-col overflow-hidden pb-navbar lg:h-[calc(100dvh-8rem)] lg:pb-0 lg:pl-2">
      <header className="flex items-center gap-2.5 border-b border-border bg-page px-4 py-3 lg:rounded-t-panel lg:border lg:border-b-0 lg:bg-card">
        <Link href="/app/more" aria-label="Kembali" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-hover hover:text-text lg:hidden">
          <ChevronLeft size={20} />
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral">
          <Track mood={sending ? 'think' : 'happy'} size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-title text-heading font-bold leading-tight text-text">Tanya Track</h1>
          <p className="flex items-center gap-1.5 text-micro text-text-subtle">
            <span className={`h-1.5 w-1.5 rounded-full ${sending ? 'bg-warning' : 'bg-brand'}`} aria-hidden />
            {sending ? 'Lagi mikir…' : 'AI Financial Buddy · online'}
          </p>
        </div>
        <Link
          href="/app/chat/memory"
          aria-label="Yang Track ingat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-hover hover:text-text"
        >
          <Brain size={18} />
        </Link>
        <button
          type="button"
          onClick={startNewChat}
          aria-label="Chat baru"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-hover hover:text-text"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Riwayat chat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-hover hover:text-text"
        >
          <History size={18} />
        </button>
      </header>

      {/* Satu panel: area scroll selebar panel (scrollbar menempel di tepi panel, bukan di tengah
          kolom), isi pesan dipusatkan di kolom max-w-[720px] ala ChatGPT/Claude. */}
      <div className="flex min-h-0 w-full flex-1 flex-col lg:rounded-b-panel lg:border lg:border-t-0 lg:border-border lg:bg-card">
        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col gap-6 px-4 py-6">
            {isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={TRANSITION_SLOW}
                className="my-auto flex flex-col items-center gap-6 py-6 text-center"
              >
                <Track mood="happy" size={72} />
                <div>
                  <p className="font-title text-title font-bold text-text">Halo Arzaka, mau bahas apa?</p>
                  <p className="mt-2 text-small leading-relaxed text-text-subtle">
                    Tanya sisa budget, catat pengeluaran, atau minta saran sebelum belanja.
                  </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 xs:grid-cols-2">
                  {QUICK_PROMPTS.map(({ label, Icon, text }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => {
                        setInput(text);
                        inputRef.current?.focus();
                      }}
                      className="flex items-center gap-3 rounded-card bg-neutral px-3.5 py-3 text-left transition-colors duration-fast ease-standard hover:bg-neutral-hover"
                    >
                      <Icon size={16} className="shrink-0 text-brand" />
                      <span className="text-small font-bold leading-snug text-text">{label}</span>
                    </button>
                  ))}
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
                  className={m.role === 'user' ? 'flex justify-end' : 'flex items-start gap-3'}
                >
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-panel rounded-br-subtle bg-neutral px-4 py-2.5 text-body leading-relaxed text-text">
                      {m.content}
                    </div>
                  ) : (
                    <>
                      <span className="mt-0.5 shrink-0">
                        <Track mood="idle" size={28} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-body leading-relaxed text-text">
                          <MessageBody content={m.content} />
                        </div>
                        {m.attachments?.map((card, i) =>
                          card.type === 'simulation' ? (
                            <SimulationCard key={i} card={card} />
                          ) : card.type === 'goal-proposal' ? (
                            <GoalProposalCard key={i} card={card} />
                          ) : card.type === 'budget-proposal' ? (
                            <BudgetProposalCard key={i} card={card} />
                          ) : null,
                        )}
                        <button
                          type="button"
                          onClick={() => copyMessage(m)}
                          aria-label="Salin jawaban"
                          className="mt-1.5 -ml-1.5 flex h-7 items-center gap-1.5 rounded-full px-2 text-micro font-bold text-text-subtlest transition-colors hover:bg-hover hover:text-text"
                        >
                          {copiedId === m.id ? <Check size={13} className="text-brand" /> : <Copy size={13} />}
                          {copiedId === m.id ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {sending && streamText && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  <Track mood="think" size={28} />
                </span>
                <div className="min-w-0 flex-1 text-body leading-relaxed text-text">
                  <MessageBody content={streamText} />
                  <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-subtle bg-brand" aria-hidden />
                </div>
              </div>
            )}

            {sending && !streamText && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                <Track mood="think" size={28} />
                <span className="flex gap-1" aria-label="Track lagi nulis jawaban">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-brand"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </span>
              </motion.div>
            )}
          </div>
        </div>

        <div className="relative px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
          <AnimatePresence>
            {showJump && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={TRANSITION_BASE}
                onClick={jumpToBottom}
                aria-label="Ke pesan terbaru"
                className="absolute -top-11 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-overlay text-text shadow-overlay transition-colors hover:bg-neutral-hover"
              >
                <ArrowDown size={16} />
              </motion.button>
            )}
          </AnimatePresence>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="mx-auto flex w-full max-w-[720px] items-end gap-2 rounded-[26px] bg-neutral py-2 pl-5 pr-2 shadow-field transition-shadow duration-base ease-standard focus-within:shadow-field-focus"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter kirim, Shift+Enter baris baru. isComposing: jangan kirim saat IME aktif.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Tanya atau catat pengeluaran…"
              aria-label="Pesan untuk Track"
              className="min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-body leading-normal text-text outline-none placeholder:text-text-subtlest"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Kirim pesan"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand transition-all duration-fast ease-standard hover:bg-brand-hover active:scale-[.94] disabled:bg-hover disabled:text-text-subtlest"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION_BASE}
              className="absolute inset-0 z-20 bg-black/60"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ ...TRANSITION_SLOW, ease: EASE_ENTER }}
              className="absolute inset-y-0 left-0 z-30 flex w-[82%] max-w-[248px] flex-col bg-page shadow-overlay"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                <h2 className="font-title text-heading font-bold text-text">Riwayat Chat</h2>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Tutup"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:bg-hover hover:text-text"
                >
                  <X size={17} />
                </button>
              </div>
              <button
                type="button"
                onClick={startNewChat}
                className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-medium bg-brand px-4 py-2.5 text-small font-bold text-on-brand transition-colors hover:bg-brand-hover"
              >
                <Plus size={16} /> Chat baru
              </button>
              <div className="mt-2 flex-1 overflow-y-auto px-2 pb-4">
                {visibleThreads.length === 0 && (
                  <p className="px-2 py-6 text-center text-small text-text-subtle">Belum ada percakapan tersimpan.</p>
                )}
                {visibleThreads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openThread(t.id)}
                    className={`group mt-1 flex w-full items-center gap-2 rounded-row px-3 py-2.5 text-left transition-colors duration-fast ease-standard ${
                      t.id === activeThreadId ? 'bg-neutral' : 'hover:bg-hover'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-bold text-text">{t.title || 'Percakapan baru'}</p>
                      <p className="text-micro text-text-subtle">{fmtThreadDate(t.updatedAt)}</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => deleteThread(t.id, e)}
                      aria-label="Hapus percakapan"
                      className="shrink-0 rounded-full p-1.5 text-text-subtlest opacity-0 transition-opacity hover:text-status-over group-hover:opacity-100"
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
