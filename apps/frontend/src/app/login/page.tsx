'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { TracksterLogo } from '@/components/TracksterLogo';
import { Track } from '@/components/track/Track';

function Logo() {
  return (
    <div className="ts-logo">
      <TracksterLogo height={28} />
    </div>
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
  const [passwordFocused, setPasswordFocused] = useState(false);
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

  // Track di aside: mata nutup saat user isi password (🙈), lirik kursor saat username.
  const hideEyes = passwordFocused || password.length > 0;

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
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
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
          <Track mood="idle" size={88} pointer hideEyes={hideEyes} />
        </div>
      </aside>
    </main>
  );
}
