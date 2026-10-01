'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';

function Mascot() {
  return (
    <span aria-hidden="true" className="motion-safe:animate-[login-float_3.6s_cubic-bezier(.16,1,.3,1)_infinite]">
      <svg viewBox="0 0 40 40" width="88" height="88" fill="none">
        <path d="M20 5c7.2 0 13 5.4 13 12.2 0 7.2-5.4 12.8-13 12.8S7 24.4 7 17.2C7 10.4 12.8 5 20 5Z" fill="#1ED760" />
        <ellipse cx="14.5" cy="12.5" rx="3.6" ry="2" fill="white" opacity=".35" transform="rotate(-26 14.5 12.5)" />
        <ellipse cx="14.5" cy="18" rx="2.1" ry="2.45" fill="#121212" />
        <ellipse cx="25.5" cy="18" rx="2.1" ry="2.45" fill="#121212" />
        <path d="M15.5 25.5c2.4 2.6 6.6 2.6 9 0" stroke="#121212" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
    <main className="flex min-h-screen bg-[#f5f5f4] text-[#121212]">
      <section className="flex min-w-0 flex-1 flex-col px-6 pb-8 pt-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => router.push('/')} className="-ml-2 inline-flex h-9 items-center gap-0.5 rounded-full px-2 pr-3 text-sm font-medium text-[#5b5b5b] transition-colors hover:bg-black/[.045] hover:text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">
            <ArrowLeft size={18} aria-hidden="true" />
            Beranda
          </button>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1ed760] text-[15px] font-extrabold text-[#04120a]">T</span>
            <span className="text-base font-bold tracking-[-.01em]">Trackster</span>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-8">
          <form onSubmit={handleSubmit} className="motion-safe:animate-[login-in_700ms_cubic-bezier(.16,1,.3,1)_both] flex w-full max-w-[380px] flex-col gap-7">
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[34px] font-extrabold leading-10 tracking-[-.03em]">Masuk</h1>
              <p className="m-0 text-base leading-6 text-[#5b5b5b]">Lanjut lihat sisa budget hari ini.</p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#5b5b5b]">Username</span>
                <input value={username} onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }} autoFocus autoComplete="username" aria-invalid={!!error} className="h-12 rounded-[10px] bg-[#f0f0ef] px-3.5 text-base text-[#121212] outline-none transition-shadow placeholder:text-[#767676] focus-visible:shadow-[inset_0_0_0_1.5px_#121212] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_#c0303f]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#5b5b5b]">Password</span>
                <span className="relative flex">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }} autoComplete="current-password" aria-invalid={!!error} className="h-12 w-full rounded-[10px] bg-[#f0f0ef] px-3.5 pr-12 text-base text-[#121212] outline-none transition-shadow focus-visible:shadow-[inset_0_0_0_1.5px_#121212] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_#c0303f]" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-[#5b5b5b] hover:text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#121212]">
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </span>
              </label>
              <p role="alert" className="m-0 flex min-h-5 items-center gap-1.5 text-sm font-semibold leading-5 text-[#c0303f]">
                {error && <><AlertTriangle size={15} strokeWidth={2.25} aria-hidden="true" />{error}</>}
              </p>
            </div>

            <div className="flex flex-col gap-3.5">
              <button type="submit" disabled={loading} aria-busy={loading} className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-[#1ed760] text-base font-bold text-[#04120a] transition-[background,transform] hover:bg-[#1ac455] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212]">
                {loading && <LoaderCircle size={18} className="motion-safe:animate-spin" aria-hidden="true" />}
                {loading ? 'Masuk…' : 'Masuk'}
              </button>
              <p className="m-0 text-center text-[13px] leading-[18px] text-[#767676]">Kamu tetap masuk di perangkat ini sampai keluar sendiri.</p>
            </div>

            <p className="border-t border-black/[.08] pt-5 text-sm leading-[22px] text-[#5b5b5b]">Finance Tracker masih private. Belum punya akses? <span className="font-semibold text-[#121212] underline decoration-1 underline-offset-[3px]">Masuk antrean.</span></p>
          </form>
        </div>
      </section>

      <aside aria-hidden="true" className="hidden flex-[1_1_520px] min-w-0 p-4 lg:block">
        <div className="sticky top-4 flex h-[calc(100vh-32px)] flex-col items-center justify-center gap-7 overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.04),0_0_0_1px_rgba(0,0,0,.05)]">
          <div className="flex h-[104px] w-[min(380px,80%)] items-center justify-center rounded-[20px] bg-white px-6 text-center text-[17px] font-semibold leading-[26px] shadow-[0_16px_40px_rgba(0,0,0,.14),0_0_0_1px_rgba(0,0,0,.06)]">Kopi Kenangan Rp32.000 baru masuk.<br />Sisa hari ini Rp168.000.</div>
          <Mascot />
        </div>
      </aside>
      <style jsx>{`@keyframes login-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes login-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } } @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }`}</style>
    </main>
  );
}
