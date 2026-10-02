'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { TracksterLogo } from '@/components/TracksterLogo';

function Logo() {
  return (
    <div className="ts-logo">
      <TracksterLogo height={28} />
    </div>
  );
}

function Mascot({ px, mood = 'happy' }: { px: number; mood?: 'happy' }) {
  const body = '#1ED760';
  const mouth = mood === 'happy' ? 'M15.5 25.5c2.4 2.6 6.6 2.6 9 0' : 'M16.5 25.8c2 1.5 5 1.5 7 0';
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
          <ellipse cx={14.5} cy={18.5} rx={2.1} ry={2.45} fill="#121212" />
          <ellipse cx={25.5} cy={18.5} rx={2.1} ry={2.45} fill="#121212" />
        </g>
        <path d={mouth} stroke="#121212" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
    </span>
  );
}

const BUBBLES = [
  'Kopi Kenangan Rp32.000 baru masuk. Sisa hari ini Rp168.000.',
  'Gojek Rp18.500 tercatat dari email Jago.',
  'Budget weekend aman. Santai aja.',
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bubble, setBubble] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => setBubble((n) => (n + 1) % BUBBLES.length), 3800);
    return () => clearInterval(id);
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/login', { username, password });
      router.push('/app');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ts-page ts-login-page">
      <section className="ts-login-main">
        <header className="ts-login-top">
          <button className="ts-back" onClick={() => router.push('/')}>
            <ArrowLeft size={18} />
            Beranda
          </button>
          <Logo />
        </header>

        <div className="ts-form-center">
          <form onSubmit={submit} className="ts-login-form" noValidate>
            <div className="ts-login-heading">
              <h1>Masuk</h1>
              <p>Lanjut lihat sisa budget hari ini.</p>
            </div>

            <div className="ts-fields">
              <label>
                <span>Username</span>
                <input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  autoComplete="username"
                  aria-invalid={!!error}
                />
              </label>
              <label>
                <span>Password</span>
                <span className="ts-password">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    autoComplete="current-password"
                    aria-invalid={!!error}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <p className="ts-error" role="alert">
                {error && (
                  <>
                    <AlertTriangle size={15} />
                    {error}
                  </>
                )}
              </p>
            </div>

            <div className="ts-login-actions">
              <button className="ts-submit" disabled={loading} aria-busy={loading}>
                {loading && <LoaderCircle size={18} className="animate-spin" />}
                {loading ? 'Masuk…' : 'Masuk'}
              </button>
              <p className="ts-device-note">
                Kamu tetap masuk di perangkat ini sampai keluar sendiri.
              </p>
            </div>

            <div className="ts-private">
              Finance Tracker masih private. Belum punya akses?{' '}
              <button type="button" onClick={() => router.push('/')}>
                <u>Masuk antrean.</u>
              </button>
            </div>
          </form>
        </div>
      </section>

      <aside className="ts-login-aside" aria-hidden="true">
        <div className="ts-big-mascot">
          <div className="ts-bubble-stage">
            {BUBBLES.map((text, i) => {
              const d = (i - bubble + BUBBLES.length) % BUBBLES.length;
              return (
                <div
                  key={text}
                  className="ts-bubble"
                  style={{
                    opacity: d === 0 ? 1 : 0,
                    filter: d === 0 ? 'blur(0px)' : 'blur(6px)',
                    transform: `translateY(${d === 0 ? '0px' : d === BUBBLES.length - 1 ? '-16px' : '16px'})`,
                  }}
                >
                  {text}
                </div>
              );
            })}
          </div>
          <Mascot px={88} />
        </div>
      </aside>
    </main>
  );
}
