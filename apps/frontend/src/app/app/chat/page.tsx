'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ChevronLeft, Send, Wallet, Coffee, TrendingUp, ShoppingBag } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { TRANSITION_BASE, TRANSITION_SLOW } from '@/lib/motion';
import { TracksterMascot } from '@/components/TracksterMascot';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { label: 'Sisa budget hari ini?', Icon: Wallet, text: 'Berapa sisa budget hari ini?' },
  { label: 'Catat kopi 25rb', Icon: Coffee, text: 'Beli kopi 25rb tadi di Jago' },
  { label: 'Pengeluaran bulan ini', Icon: TrendingUp, text: 'Gimana pengeluaran saya bulan ini?' },
  { label: 'Cek sebelum beli', Icon: ShoppingBag, text: 'Saya mau beli gadget 2jt, aman ga?' },
];

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Halo Arzaka! Aku Track, financial buddy kamu. Mau cek kondisi keuangan, minta saran pengeluaran, atau catat transaksi bareng?',
  timestamp: new Date(),
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post<{ reply: string }>('/ai/chat', { message: text });
      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'Hmm, aku blank sebentar. Coba kirim ulang ya.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Koneksi ke layanan AI terputus. Coba kirim ulang pesanmu.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const showQuick = messages.length <= 2 && !loading;

  return (
    <div className="flex h-screen flex-col pb-navbar">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line-subtle bg-base/[0.9] px-4 py-3.5 backdrop-blur-md">
        <Link href="/app/more" aria-label="Kembali" className="text-ink-muted transition-colors hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <TracksterMascot mood={loading ? 'thinking' : 'happy'} size="md" glow />
        <div className="min-w-0 flex-1">
          <h1 className="font-title text-heading font-bold text-ink truncate">Tanya Track</h1>
          <p className="text-micro text-ink-muted">
            {loading ? 'Lagi mikir…' : 'AI Financial Buddy · online'}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 1 && (
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
          {messages.map((m) => (
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

        {loading && (
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
            disabled={loading}
            className="flex-1 rounded-comfortable bg-surface-interactive px-4 py-3 text-body text-ink placeholder:text-ink-subtle outline-none shadow-field transition-shadow duration-base ease-standard focus:shadow-field-focus"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Kirim pesan"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold transition-all hover:brightness-108 active:scale-[.94] disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}