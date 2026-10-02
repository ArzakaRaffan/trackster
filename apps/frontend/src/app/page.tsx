'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { TracksterLogo } from '@/components/TracksterLogo';
import { Track } from '@/components/track/Track';

/* ============================================================
   Landing page — port 1:1 dari "Trackster Landing (standalone).html"
   Semua animasi, CTA, dan perubahan state mengikuti standalone.
   ============================================================ */

const RP = (n: number) =>
  (n < 0 ? '\u2212' : '') + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');

const I = {
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  brain:
    'M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.8A3 3 0 0 0 6 14v1a3 3 0 0 0 3 3h1V4zM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.8A3 3 0 0 1 18 14v1a3 3 0 0 1-3 3h-1V4z',
  chevD: 'M6 9l6 6 6-6',
  x: 'M18 6 6 18M6 6l12 12',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  mail: 'M4 5h16v14H4zM4 7l8 6 8-6',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  tick: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 12h.01',
  route:
    'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  percent: 'M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
};

function Icon({ d, size = 18, sw = 2.25 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

type Mood = 'idle' | 'alert' | 'happy';

function Mascot({ px, mood = 'idle' }: { px: number; mood?: Mood }) {
  const body = mood === 'alert' ? '#FFA42B' : '#1ED760';
  const eyeY = mood === 'happy' ? 18.5 : 18;
  const mouth =
    mood === 'happy'
      ? 'M15.5 25.5c2.4 2.6 6.6 2.6 9 0'
      : mood === 'alert'
        ? 'M16.5 26.5c1.6-1.5 5.4-1.5 7 0'
        : 'M16.5 25.8c2 1.5 5 1.5 7 0';
  return (
    <span
      aria-hidden="true"
      className="ts-mascot"
      style={{ display: 'inline-flex', width: px, height: px, transformOrigin: '50% 70%' }}
    >
      <svg viewBox="0 0 40 40" width={px} height={px} fill="none">
        <path
          d="M20 5c7.2 0 13 5.4 13 12.2 0 7.2-5.4 12.8-13 12.8S7 24.4 7 17.2C7 10.4 12.8 5 20 5Z"
          fill={body}
        />
        <ellipse cx={14.5} cy={12.5} rx={3.6} ry={2} fill="#fff" opacity={0.35} transform="rotate(-26 14.5 12.5)" />
        <g className="ts-mascot-eyes">
          <ellipse cx={14.5} cy={eyeY} rx={2.1} ry={2.45} fill="#121212" />
          <ellipse cx={25.5} cy={eyeY} rx={2.1} ry={2.45} fill="#121212" />
        </g>
        <path d={mouth} stroke="#121212" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Logo() {
  return (
    <div className="ts-logo">
      <TracksterLogo height={30} />
    </div>
  );
}

/* ---------- Data (persis dari standalone) ---------- */

const TX: ReadonlyArray<readonly [string, string, string, number]> = [
  ['Kopi Kenangan', 'BCA', '08:14', 32000],
  ['Gojek', 'Jago', '09:02', 18500],
  ['Indomaret', 'BCA', '12:40', 34000],
  ['Warteg Bahari', 'Jago', '13:05', 47200],
  ['Tokopedia', 'BCA', '17:30', 55000],
  ['Grab', 'Jago', '18:45', 33000],
];

const BUDGET = 200000;
const spent = (k: number) => TX.slice(0, k).reduce((a, t) => a + t[3], 0);

const PROMPTS = [
  { label: 'Beli sepatu lari Rp1,2 jt?', text: 'Aku mau beli sepatu lari 1,2 juta' },
  { label: 'Simulasi nabung per minggu', text: 'Simulasiin dong kalau aku nabung Rp300.000 per minggu' },
  { label: 'Kenapa minggu ini boros?', text: 'Kenapa minggu ini boros banget?' },
  { label: 'Atur ulang budget harian', text: 'Bantuin atur ulang budget harian aku dong' },
];

const ANS = {
  sim: {
    text: 'Bisa, tapi ada harganya. Kalau kamu beli sepatu lari Rp1.200.000 minggu ini, saldo tetap aman, cuma target Laptop baru mundur sekitar 2 minggu.',
    card: 'sim',
  },
  save: {
    text: 'Kalau kamu sisihkan Rp300.000/minggu, dana liburan Rp4.500.000 bisa terkumpul sebelum Februari. Mau aku bikinin kantongnya?',
    card: 'goal',
  },
  budget: {
    text: 'Dua minggu terakhir kamu paling sering lewat di akhir pekan. Aku sarankan opsi Seimbang: weekday sedikit lebih ketat, Sabtu–Minggu lebih longgar.',
    card: 'bars',
  },
  boros: {
    text: 'Minggu ini naik gara-gara dua hal: Sushi Tei Rp152.000 hari Jumat dan Bioskop + makan Rp196.300 hari Minggu. Di luar itu pengeluaran harianmu malah di bawah rata-rata.',
    card: 'boros',
  },
  other: {
    text: 'Oke, dicatat. Sisa budget hari ini Rp115.500. Ada lagi yang mau kamu tanyain?',
    card: '',
  },
} as const;

const answerFor = (txt: string) => {
  const q = txt.toLowerCase();
  return q.includes('beli')
    ? ANS.sim
    : q.includes('nabung') || q.includes('simulasi')
      ? ANS.save
      : q.includes('budget')
        ? ANS.budget
        : q.includes('boros')
          ? ANS.boros
          : ANS.other;
};

const ASSUME = [
  'Pemasukan mengikuti perkiraan (Rp2.000.000/minggu)',
  'Pengeluaran rutin Rp1.266.900/minggu',
  'Langganan jatuh tempo sudah dihitung',
];

const SIM = [4230000, 3180000, 3420000, 3650000, 3910000, 4130000, 4390000, 4620000];
const SIMC = [4230000, 4380000, 4620000, 4850000, 5110000, 5330000, 5590000, 5820000];
const pts = (arr: readonly number[]) =>
  arr.map((v, i) => `${((i * 240) / 7).toFixed(1)},${(60 - ((v - 3000000) / 3000000) * 56).toFixed(1)}`).join(' ');

const DAYS: ReadonlyArray<readonly [string, number]> = [
  ['Min', 250],
  ['Sen', 180],
  ['Sel', 180],
  ['Rab', 180],
  ['Kam', 200],
  ['Jum', 200],
  ['Sab', 250],
];

const BOROS: ReadonlyArray<readonly [string, string, number]> = [
  ['Sushi Tei', 'Jumat', 152000],
  ['Bioskop + makan', 'Minggu', 196300],
];

const FAQ: ReadonlyArray<readonly [string, string]> = [
  ['Kapan Trackster dibuka?', 'Akses dibuka bertahap lewat antrean beta. Saat giliranmu tiba, kami mengirim email berisi cara masuk.'],
  ['Apakah aman membaca email bank?', 'Trackster membaca email notifikasi transaksi dari bank yang didukung, saat ini BCA dan Jago. Koneksi Google dipakai untuk membuat transaksi dan pengingat langganan, dan bisa kamu atur di Setting.'],
  ['Dari mana saran Track?', 'Track menjawab berdasarkan transaksi, budget, langganan, dan target tabunganmu, serta hal yang kamu ceritakan di chat. Track bukan penasihat keuangan berlisensi. Keputusan tetap ada di tanganmu.'],
  ['Apakah alat gratisnya perlu antre?', 'Tidak. Split bill, patungan trip, target tabungan, dan kalkulator cicilan bisa dipakai siapa saja tanpa akun.'],
  ['Sudah punya akses?', 'Masuk dengan username dan password-mu.'],
];

type Msg = { id: number; role: 'user' | 'bot'; text: string; card: '' | 'sim' | 'bars' | 'boros' | 'goal' };

export default function LandingPage() {
  const reduced = useReducedMotion();

  /* ---- demo (blok kanan pencatatan) ---- */
  const [k, setK] = useState(2);
  const [mailIdx, setMailIdx] = useState(2);
  const [mailOn, setMailOn] = useState(false);
  const [tgOn, setTgOn] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [disp, setDisp] = useState(BUDGET - spent(2));
  const kRef = useRef(k);
  kRef.current = k;
  const dispRef = useRef(disp);
  dispRef.current = disp;

  useEffect(() => {
    if (reduced) return;
    const timers: number[] = [];
    let raf = 0;
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const tween = (to: number) => {
      cancelAnimationFrame(raf);
      const from = dispRef.current;
      const t0 = performance.now();
      const d = 700;
      const f = (now: number) => {
        const p = Math.min(1, (now - t0) / d);
        const e = 1 - Math.pow(1 - p, 3);
        setDisp(Math.round(from + (to - from) * e));
        if (p < 1) raf = requestAnimationFrame(f);
      };
      raf = requestAnimationFrame(f);
    };
    const step = () => {
      const curK = kRef.current;
      if (curK >= TX.length) {
        later(() => {
          setK(2);
          setTgOn(false);
          tween(BUDGET - spent(2));
          later(step, 1400);
        }, 4200);
        return;
      }
      setMailOn(true);
      setMailIdx(curK);
      later(() => {
        setK(curK + 1);
        setFresh(true);
        setTgOn(curK + 1 >= TX.length);
        tween(BUDGET - spent(curK + 1));
        later(() => setFresh(false), 80);
        later(() => setMailOn(false), 1000);
        later(step, 2600);
      }, 1300);
    };
    later(step, 1800);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const sp = spent(k);
  const over = disp < 0;
  const near = !over && sp / BUDGET >= 0.9;
  const mt = TX[mailIdx] || TX[0];
  const rows = TX.slice(0, k)
    .reverse()
    .slice(0, 4)
    .map((t, j) => ({
      initial: t[0][0],
      name: t[0],
      meta: `${t[1]} · ${t[2]}`,
      amt: `\u2212${RP(t[3])}`,
      bg: j === 0 && fresh ? 'var(--brand-subtle)' : 'transparent',
    }));

  /* ---- chat demo ---- */
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [stream, setStream] = useState<{ id: number; n: number } | null>(null);
  const [input, setInput] = useState('');
  const [goalMade, setGoalMade] = useState(false);
  const [assumeOpen, setAssumeOpen] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef(0);
  const thinkTimerRef = useRef<number | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const streamNRef = useRef(0);
  const streamIdRef = useRef(0);
  const streamWordsRef = useRef<string[]>([]);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking, stream]);

  useEffect(() => {
    return () => {
      if (thinkTimerRef.current) window.clearTimeout(thinkTimerRef.current);
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    };
  }, []);

  const send = (text: string) => {
    const q = (text || '').trim();
    if (!q || thinking || stream) return;
    const uid = ++midRef.current;
    const bid = ++midRef.current;
    const r = answerFor(q);
    setMsgs((prev) => [...prev, { id: uid, role: 'user', text: q, card: '' }]);
    setInput('');
    setThinking(true);
    if (thinkTimerRef.current) window.clearTimeout(thinkTimerRef.current);
    thinkTimerRef.current = window.setTimeout(() => {
      const words = r.text.split(' ');
      setMsgs((prev) => [...prev, { id: bid, role: 'bot', text: r.text, card: r.card }]);
      setThinking(false);
      if (reduced) return;
      streamWordsRef.current = words;
      streamIdRef.current = bid;
      streamNRef.current = 1;
      setStream({ id: bid, n: 1 });
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = window.setInterval(() => {
        const n = streamNRef.current + 1;
        if (n >= streamWordsRef.current.length) {
          if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
          setStream(null);
        } else {
          streamNRef.current = n;
          setStream({ id: streamIdRef.current, n });
        }
      }, 38);
    }, reduced ? 50 : 1000);
  };

  const resetChat = () => {
    if (thinkTimerRef.current) window.clearTimeout(thinkTimerRef.current);
    if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    thinkTimerRef.current = null;
    streamTimerRef.current = null;
    setMsgs([]);
    setThinking(false);
    setStream(null);
    setGoalMade(false);
    setAssumeOpen(false);
    setInput('');
  };

  const busy = thinking || !!stream;
  const asked = (p: (typeof PROMPTS)[number]) => msgs.some((m) => m.role === 'user' && m.text === p.text);
  const left = PROMPTS.filter((p) => !asked(p));

  /* ---- waitlist + toast ---- */
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [wlErr, setWlErr] = useState('');
  const [toast, setToast] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const join = (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      setWlErr('Format email belum benar.');
      return;
    }
    setWlErr('');
    setDone(true);
    setToast('Kamu masuk antrean beta.');
    setToastOn(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastOn(false), 2600);
  };

  /* ---- FAQ ---- */
  const [faqOpen, setFaqOpen] = useState(-1);

  const waitlistForm = (center = false) => (
    <>
      {done ? (
        <div role="status" className="ts-wl-done">
          <span>
            <Icon d={I.tick} sw={2.5} />
          </span>
          <span>Kamu sudah masuk antrean beta. Kami kabari ke {email.trim()} saat giliranmu tiba.</span>
        </div>
      ) : (
        <>
          <form className={`ts-waitlist${center ? ' ts-waitlist-center' : ''}`} onSubmit={join} noValidate>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (wlErr) setWlErr('');
              }}
              placeholder="email@kamu.com"
              aria-label="Email"
              aria-invalid={!!wlErr}
              autoComplete="email"
            />
            <button type="submit">
              Masuk antrean beta
              <Icon d={I.arrow} />
            </button>
          </form>
          <p className="ts-wl-error" role="alert">
            {wlErr}
          </p>
        </>
      )}
    </>
  );

  const trustList = (center = false) => (
    <ul className={`ts-trust${center ? ' ts-trust-center' : ''}`}>
      <li>
        <Icon d={I.tick} size={14} sw={2.5} /> Hanya butuh email
      </li>
      <li>
        <Icon d={I.tick} size={14} sw={2.5} /> Tanpa kartu kredit
      </li>
      <li>
        <Icon d={I.tick} size={14} sw={2.5} /> Kami kabari saat giliranmu tiba
      </li>
    </ul>
  );

  return (
    <main className="ts-page">
      <header className="ts-header">
        <Logo />
        <Link href="/login" className="ts-login-link">
          Sudah punya akses? Masuk
        </Link>
      </header>

      {/* ============ Hero ============ */}
      <section className="ts-hero">
        <div className="ts-hero-copy">
          <span className="ts-beta">
            <i />Private beta · akses dibuka bertahap
          </span>
          <h1>
            <span>Pengeluaran</span>
            <span>tercatat</span>
            <span>otomatis.</span>
            <em>
              <span>Sisa</span>
              <span>budget</span>
              <span>hari</span>
              <span>ini</span>
              <span>selalu</span>
              <span>jelas.</span>
            </em>
          </h1>
          <p>
            Trackster mencatat transaksi BCA dan Jago dari email notifikasi, jadi kamu cukup melihat
            sisa budget hari ini. Sebelum membeli sesuatu, tanya Track, asisten keuangan AI.
          </p>

          <div className="ts-cta">
            <div className="ts-waitlist-wrap">{waitlistForm()}</div>
            {trustList()}
          </div>
        </div>

        {/* ============ Demo card (animasi pencatatan) ============ */}
        <div className="ts-demo-wrap">
          <div
            className="ts-mail"
            style={{
              opacity: mailOn ? 1 : 0,
              transform: `translateY(${mailOn ? '0px' : '-10px'}) scale(${mailOn ? 1 : 0.97})`,
            }}
          >
            <Icon d={I.mail} size={16} />
            <span>
              <span>{`Email ${mt[1]} · baru saja`}</span>
              <span>{`${mt[0]} ${RP(mt[3])}`}</span>
            </span>
          </div>

          <div className="ts-demo-card">
            <div className="ts-demo-head">
              <Mascot px={44} mood={over || near ? 'alert' : 'idle'} />
              <span>
                <b>Hari ini</b>
                <small>Rabu, 30 September</small>
              </span>
              <strong className={`ts-demo-chip ${over ? 'is-over' : near ? 'is-near' : 'is-ok'}`}>
                <Icon d={over || near ? I.alert : I.tick} size={14} sw={2.5} />
                {over ? 'Lewat budget' : near ? 'Mendekati batas' : 'Aman'}
              </strong>
            </div>

            <div className="ts-budget">
              <label>{over ? 'Lewat budget' : 'Sisa budget hari ini'}</label>
              <div>
                <b className={over ? 'is-over' : near ? 'is-near' : ''}>{RP(disp)}</b>
                <small>dari budget Rp200.000</small>
              </div>
              <i>
                <u
                  className={over ? 'is-over' : near ? 'is-near' : ''}
                  style={{ width: `${Math.min(100, (sp / BUDGET) * 100)}%` }}
                />
              </i>
            </div>

            <ul className="ts-transactions">
              {rows.map((r) => (
                <li key={r.name} style={{ background: r.bg }}>
                  <span>{r.initial}</span>
                  <div>
                    <b>{r.name}</b>
                    <small>{r.meta}</small>
                  </div>
                  <strong>{r.amt}</strong>
                </li>
              ))}
            </ul>

            <div
              className="ts-alert"
              style={{
                opacity: tgOn ? 1 : 0,
                transform: `translateY(${tgOn ? '0px' : '6px'})`,
              }}
            >
              <Icon d={I.send} size={16} /> Pesan Telegram terkirim: lewat Rp19.700
            </div>
          </div>
        </div>
      </section>

      {/* ============ Benefits ============ */}
      <section className="ts-benefits">
        <div className="ts-section-head">
          <h2>Cukup lihat satu angka</h2>
          <p>Sisanya dikerjakan Trackster di belakang layar.</p>
        </div>
        <div className="ts-benefit-grid">
          <div className="ts-benefit">
            <span className="ts-benefit-icon">
              <Icon d={I.mail} size={22} sw={2} />
            </span>
            <h3>Tidak ada yang perlu diketik</h3>
            <p>Transaksi BCA dan Jago masuk otomatis dari email notifikasi.</p>
            <p className="ts-benefit-note">Saldo tiap rekening ikut berubah setiap ada transaksi baru.</p>
          </div>
          <div className="ts-benefit">
            <span className="ts-benefit-icon">
              <Icon d={I.send} size={22} sw={2} />
            </span>
            <h3>Langsung tahu saat lewat budget</h3>
            <p>Satu angka menunjukkan sisa budget hari ini. Saat terlewati, Telegram mengirim pesan.</p>
            <p className="ts-benefit-note">
              Pesan Telegram terkirim: <b>lewat Rp19.700</b>
            </p>
          </div>
          <div className="ts-benefit">
            <span className="ts-benefit-icon">
              <Icon d={I.spark} size={22} sw={2} />
            </span>
            <h3>Timbang pembelian sebelum membayar</h3>
            <p>Tanya Track sebelum membeli. Dampaknya ke target tabunganmu dihitung.</p>
            <p className="ts-benefit-note">
              “Beli sepatu Rp1.200.000?” Target Laptop baru <b>mundur ±2 minggu</b>.
            </p>
          </div>
        </div>
      </section>

      {/* ============ Demo chat (Tanya Track) ============ */}
      <section className="ts-demo-chat">
        <div className="ts-section-head">
          <h2>Tanya Track sebelum membeli</h2>
          <p>
            Track menjawab berdasarkan transaksi, budget, dan target tabunganmu. Coba salah satu.
          </p>
        </div>
        <div className="ts-chat-layout">
          <div className="ts-chat-card">
            <div className="ts-chat-head">
              <Mascot px={32} mood="happy" />
              <span>
                <b>Tanya Track</b>
                <small style={{ color: busy ? 'var(--brand-text)' : 'var(--text-subtle)' }}>
                  {thinking ? 'Sedang menghitung…' : stream ? 'Sedang mengetik…' : 'Asisten keuangan AI'}
                </small>
              </span>
              {msgs.length > 0 && (
                <button type="button" className="ts-chat-reset" onClick={resetChat}>
                  Mulai ulang
                </button>
              )}
            </div>

            <div className="ts-chat-body" ref={chatBodyRef}>
              {msgs.length === 0 && !thinking && (
                <div className="ts-chat-empty">
                  <Mascot px={64} mood="happy" />
                  <b>Mau tanya apa ke Track?</b>
                  <span>Pilih pertanyaan di bawah atau ketik sendiri. Jawabannya memakai data contoh.</span>
                </div>
              )}

              {msgs.map((m) => {
                const isUser = m.role === 'user';
                const isStreaming = !!stream && stream.id === m.id;
                const text = !isUser && isStreaming ? m.text.split(' ').slice(0, stream!.n).join(' ') : m.text;
                const card = !isUser && !isStreaming ? m.card : '';
                return (
                  <div className="ts-chat-msg" key={m.id}>
                    {isUser && <div className="ts-chat-msg-user">{m.text}</div>}
                    {!isUser && text.length > 0 && <div className="ts-chat-msg-bot">{text}</div>}

                    {card === 'sim' && (
                      <div className="ts-card">
                        <span className="ts-card-title">Simulasi: beli sepatu Rp1.200.000</span>
                        <svg
                          viewBox="0 0 240 64"
                          preserveAspectRatio="none"
                          width="100%"
                          height="72"
                          aria-hidden="true"
                        >
                          <polyline
                            points={pts(SIMC)}
                            fill="none"
                            stroke="var(--text-subtlest)"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            vectorEffect="non-scaling-stroke"
                          />
                          <polyline
                            points={pts(SIM)}
                            pathLength={1}
                            fill="none"
                            stroke="var(--brand)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            className="ts-draw"
                          />
                        </svg>
                        <div className="ts-card-legend">
                          <span>
                            <i className="ts-legend-dash" />Tanpa beli <b>Rp5,8jt</b>
                          </span>
                          <span>
                            <i className="ts-legend-bar" />Kalau beli <b className="is-brand">Rp4,6jt</b>
                          </span>
                        </div>
                        <span className="ts-card-chip">
                          <Icon d={I.alert} size={14} /> Target Laptop baru mundur ±2 minggu
                        </span>
                        <button
                          type="button"
                          className="ts-card-assume-toggle"
                          aria-expanded={assumeOpen}
                          onClick={() => setAssumeOpen((v) => !v)}
                        >
                          {assumeOpen ? 'Sembunyikan asumsi' : `Lihat ${ASSUME.length} asumsi`}
                        </button>
                        <div className={`ts-card-assume${assumeOpen ? ' open' : ''}`}>
                          <ul>
                            {ASSUME.map((a) => (
                              <li key={a}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {card === 'bars' && (
                      <div className="ts-card">
                        <div className="ts-bars-head">
                          <b>Seimbang</b>
                          <b>Rp1.440.000/minggu</b>
                        </div>
                        <div className="ts-bars">
                          {DAYS.map((d) => (
                            <span className="ts-bar-col" key={d[0]}>
                              <span className="ts-bar-val">{d[1]}rb</span>
                              <span
                                className="ts-bar"
                                style={{
                                  height: `${Math.round((d[1] / 250) * 72)}px`,
                                  background:
                                    d[0] === 'Min' || d[0] === 'Sab' ? 'var(--brand)' : 'var(--text-subtlest)',
                                }}
                              />
                            </span>
                          ))}
                        </div>
                        <div className="ts-bars-labels">
                          {DAYS.map((d) => (
                            <span key={d[0]}>{d[0]}</span>
                          ))}
                        </div>
                        <span className="ts-bars-note">Cadangan 10%, weekend lebih longgar</span>
                      </div>
                    )}

                    {card === 'boros' && (
                      <div className="ts-card">
                        <span className="ts-card-title">Pemicu minggu ini</span>
                        {BOROS.map((b) => (
                          <div className="ts-boros-row" key={b[0]}>
                            <div className="ts-boros-row-head">
                              <span className="ts-boros-meta">
                                <b>{b[0]}</b>
                                <span className="ts-boros-day">{b[1]}</span>
                              </span>
                              <b>{RP(b[2])}</b>
                            </div>
                            <span className="ts-boros-track">
                              <span
                                className="ts-boros-fill"
                                style={{ width: `${Math.round((b[2] / 196300) * 100)}%` }}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {card === 'goal' && (
                      <div className="ts-card">
                        <div className="ts-goal-head">
                          <span className="ts-goal-icon">
                            <Icon d={I.target} size={18} sw={2} />
                          </span>
                          <span className="ts-goal-meta">
                            <b>Liburan Bali</b>
                            <small>Target Rp4.500.000 · sebelum 1 Feb 2027</small>
                          </span>
                        </div>
                        <span className="ts-goal-note">
                          Setoran sekitar <b>Rp300.000/minggu</b>
                        </span>
                        <button
                          type="button"
                          className={`ts-goal-btn${goalMade ? ' done' : ''}`}
                          onClick={() => setGoalMade((v) => !v)}
                        >
                          {goalMade ? 'Target dibuat' : 'Buat target'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {thinking && (
                <div className="ts-chat-thinking">
                  <span className="ts-chat-dot" />
                  <span className="ts-chat-dot" />
                  <span className="ts-chat-dot" />
                </div>
              )}
            </div>

            <div className="ts-chat-foot">
              {left.length > 0 && (
                <div className="ts-chat-chips">
                  {left.map((p) => (
                    <button type="button" className="ts-chat-chip" key={p.text} disabled={busy} onClick={() => send(p.text)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
              <form
                className="ts-chat-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ketik pertanyaanmu ke Track"
                  aria-label="Pertanyaan untuk Track"
                  autoComplete="off"
                />
                <button type="submit" aria-label="Kirim" disabled={busy || !input.trim()}>
                  <Icon d={I.send} />
                </button>
              </form>
            </div>
          </div>

          <div className="ts-chat-points">
            <div>
              <span className="ts-point-icon">
                <Icon d={I.spark} size={19} sw={2} />
              </span>
              <span>
                <b>Berdasarkan datamu</b>
                <small>Transaksi, budget, langganan, dan target tabungan dihitung bersama.</small>
              </span>
            </div>
            <div>
              <span className="ts-point-icon">
                <Icon d={I.brain} size={19} sw={2} />
              </span>
              <span>
                <b>Mengingat konteksmu</b>
                <small>
                  Tujuan dan rencanamu ikut dipertimbangkan, jadi kamu tidak perlu menjelaskan ulang.
                </small>
              </span>
            </div>
            <div>
              <span className="ts-point-icon">
                <Icon d={I.alert} size={19} sw={2} />
              </span>
              <span>
                <b>Keputusan tetap di kamu</b>
                <small>Track memberi hitungan dan pertimbangan. Ini bukan nasihat keuangan berlisensi.</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Cerita ============ */}
      <section className="ts-cerita">
        <div className="ts-section-head">
          <h2>Kenapa Trackster dibuat</h2>
        </div>
        <div className="ts-cerita-card">
          <p>
            Mencatat pengeluaran secara manual mudah terlewat. Akibatnya, sulit tahu apakah pembelian
            berikutnya masih aman untuk target tabungan. Trackster dibuat untuk menutup dua celah
            itu: transaksi tercatat otomatis dari email bank, dan Track membantu menimbang pembelian
            berdasarkan datamu.
          </p>
          <div>
            <span className="ts-cerita-label">Contoh isi “Yang Track ingat”</span>
            <div className="ts-mem">
              <span className="ts-mem-tag">Tujuan</span>
              <span>Ingin beli laptop ±Rp12jt sebelum Maret 2027.</span>
            </div>
            <div className="ts-mem">
              <span className="ts-mem-tag">Acara</span>
              <span>Nikahan sepupu di Bandung, perlu ongkos dan kado.</span>
            </div>
            <div className="ts-mem">
              <span className="ts-mem-tag">Preferensi</span>
              <span>Lebih suka budget weekend lebih longgar daripada weekday.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Why us ============ */}
      <section className="ts-why">
        <div className="ts-section-head">
          <h2>Dibanding mencatat manual</h2>
        </div>
        <div className="ts-why-card">
          <div className="ts-why-head">
            <span />
            <span>Mencatat manual</span>
            <span>Trackster</span>
          </div>
          {(
            [
              ['Mencatat transaksi', 'Mengetik sendiri setiap selesai membayar', 'Tercatat otomatis dari email BCA dan Jago'],
              ['Memantau budget', 'Baru sadar di akhir bulan', 'Diberi tahu lewat Telegram saat budget terlewati'],
              ['Meminta saran', 'Membaca tabel dan grafik sendiri', 'Track menjawab berdasarkan data dan tujuanmu'],
              ['Mengenal kebutuhanmu', 'Menjelaskan ulang situasimu setiap kali', 'Track mengingat tujuan dan rencanamu'],
            ] as const
          ).map((row) => (
            <div className="ts-why-row" key={row[0]}>
              <span className="ts-why-feature">{row[0]}</span>
              <span className="ts-why-x">
                <span>
                  <Icon d={I.x} size={16} />
                </span>
                {row[1]}
              </span>
              <span className="ts-why-v">
                <span>
                  <Icon d={I.tick} size={16} sw={2.5} />
                </span>
                {row[2]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Tools ============ */}
      <section className="ts-tools">
        <div className="ts-section-head">
          <h2>Bisa dipakai sekarang, tanpa akun</h2>
          <p>Alat bantu keuangan yang terbuka untuk siapa saja. Tidak perlu masuk antrean.</p>
        </div>
        <div className="ts-tool-grid">
          <Link className="ts-tool" href="/split-bills">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={I.receipt} size={20} sw={2} />
              </span>
              <b>Split bill</b>
            </span>
            <small>Bagi tagihan sesuai pesanan masing-masing.</small>
          </Link>
          <Link className="ts-tool" href="/app/goals">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={I.target} size={20} sw={2} />
              </span>
              <b>Target tabungan</b>
            </span>
            <small>Hitung setoran per minggu dan waktu tercapai.</small>
          </Link>
          <Link className="ts-tool" href="/trip/new">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={I.route} size={20} sw={2} />
              </span>
              <b>Patungan trip</b>
            </span>
            <small>Atur patungan dengan transfer sesedikit mungkin.</small>
          </Link>
          <Link className="ts-tool" href="/installment-calculator">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={I.percent} size={20} sw={2} />
              </span>
              <b>PayLater dan cicilan</b>
            </span>
            <small>Hitung bunga efektif per tahun.</small>
          </Link>
        </div>
      </section>

      {/* ============ CTA penutup ============ */}
      <section className="ts-cta-final">
        <Track mood="happy" size={88} interactive />
        <h2>Jajan tenang. Sisanya urusan Trackster.</h2>
        <p>Akses dibuka bertahap. Masuk antrean beta, kami kabari saat giliranmu tiba.</p>
        <div className="ts-cta-final-form">{waitlistForm(true)}</div>
        {trustList(true)}
      </section>

      {/* ============ FAQ ============ */}
      <section className="ts-faq">
        <h2>Masih ragu?</h2>
        <div className="ts-faq-list">
          {FAQ.map((f, i) => {
            const open = faqOpen === i;
            const last = i === FAQ.length - 1;
            return (
              <div className={`ts-faq-item${open ? ' open' : ''}`} key={f[0]}>
                <button type="button" aria-expanded={open} onClick={() => setFaqOpen((cur) => (cur === i ? -1 : i))}>
                  {f[0]}
                  <span className="ts-faq-chev">
                    <Icon d={I.chevD} size={20} sw={2} />
                  </span>
                </button>
                <div className="ts-faq-a">
                  <div>
                    <p>
                      {f[1]}
                      {last && (
                        <>
                          {' '}
                          <Link href="/login" className="ts-faq-login">
                            Udah punya akses? Masuk.
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="ts-footer">
        <div>© 2026 Trackster · Private beta, akses dibuka bertahap</div>
      </footer>

      {/* ============ Toast ============ */}
      <div
        role="status"
        className={`ts-toast${toastOn ? ' show' : ''}`}
        style={{ opacity: toastOn ? 1 : 0, transform: `translate(-50%, ${toastOn ? '0px' : '12px'})` }}
      >
        {toast}
      </div>
    </main>
  );
}
