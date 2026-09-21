'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ChevronLeft, Send, Sparkles, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'Berapa sisa budget hari ini?',
  'Beli kopi 25rb tadi di Jago',
  'Gimana pengeluaran saya bulan ini?',
  'Saya mau beli gadget 2jt, aman ga?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Halo Arzaka! Saya Trackster AI, financial buddy kamu. Mau cek kondisi keuangan, minta saran pengeluaran, atau catat transaksi?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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
        content: res.reply || 'Maaf, tidak ada respon.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Waduh, ada kendala koneksi ke AI. Coba lagi ya!',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col pb-navbar animate-fade-in-up">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-base/[0.86] px-4 py-4 backdrop-blur-md">
        <Link href="/app/more" aria-label="Kembali" className="text-ink-muted hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <h1 className="font-title text-title font-bold text-ink truncate">Tanya Trackster</h1>
            <p className="text-micro text-ink-muted">AI Financial Buddy</p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro ${
                m.role === 'user'
                  ? 'bg-brand text-base font-bold'
                  : 'bg-surface-interactive text-ink-muted'
              }`}
            >
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </span>
            <div
              className={`max-w-[82%] rounded-comfortable px-4 py-2.5 text-body leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-brand text-base font-medium'
                  : 'bg-surface text-ink border border-white/[0.06]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-ink-muted">
              <Bot size={14} />
            </span>
            <div className="rounded-comfortable bg-surface px-4 py-3 text-ink-muted border border-white/[0.06] flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-brand" />
              <span className="text-small">Sedang memikirkan jawaban...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions if 1 or 2 messages */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="shrink-0 rounded-full-pill bg-surface px-3 py-1.5 text-small text-ink-muted hover:text-ink hover:bg-surface-interactive transition-colors border border-white/[0.06]"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="p-4 bg-base/80 backdrop-blur-md border-t border-white/[0.06]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya atau catat pengeluaran..."
            disabled={loading}
            className="flex-1 rounded-comfortable bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-subtle outline-none border border-white/[0.08] focus:border-brand/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-comfortable bg-brand text-base font-bold transition-opacity disabled:opacity-40 hover:bg-brand-hover"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
