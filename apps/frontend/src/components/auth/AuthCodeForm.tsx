'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

/** Form halaman tautan sekali pakai: daftar lewat undangan (`mode="invite"`) atau reset password (`mode="reset"`). */
export default function AuthCodeForm({ mode, code }: { mode: 'invite' | 'reset'; code: string }) {
  const invite = mode === 'invite';
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 10) return setErr('Password minimal 10 karakter.');
    setBusy(true);
    setErr('');
    try {
      if (invite) {
        await api.post('/auth/register', { inviteCode: code, username: username.trim().toLowerCase(), password: pw, displayName: displayName.trim() || undefined });
        window.location.href = '/app'; // reload penuh: cookie baru terbaca middleware
      } else {
        await api.post('/auth/reset-password', { token: code, newPassword: pw });
        setDone(true);
      }
    } catch (e2: any) {
      setErr(e2?.message || 'Gagal. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="pb">
      <div className="pb-top">
        <Link href="/">← Trackster</Link>
      </div>
      <article className="pb-receipt" style={{ maxWidth: 480 }}>
        <div className="pb-mono">{invite ? 'Undangan Trackster' : 'Reset password'}</div>
        <h1>{invite ? 'Bikin akunmu' : 'Password baru'}</h1>
        <hr />
        {done ? (
          <>
            <p>Password sudah diganti. Semua sesi lama dikeluarkan.</p>
            <Link className="pb-btn pri" href="/login" style={{ display: 'inline-block', textAlign: 'center' }}>Masuk</Link>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {invite && (
              <>
                <label className="pb-f">
                  Username
                  <input className="pb-in" value={username} onChange={(e) => { setUsername(e.target.value); setErr(''); }} autoComplete="username" autoCapitalize="none" placeholder="huruf kecil, angka, _" required />
                </label>
                <label className="pb-f">
                  Nama panggilan (opsional)
                  <input className="pb-in" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
                </label>
              </>
            )}
            <label className="pb-f">
              {invite ? 'Password' : 'Password baru'}
              <input className="pb-in" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} autoComplete="new-password" placeholder="minimal 10 karakter" required />
            </label>
            {err && <p className="pb-err">{err}</p>}
            <button className="pb-btn pri" type="submit" disabled={busy}>{busy ? 'Memproses…' : invite ? 'Daftar' : 'Simpan password'}</button>
          </form>
        )}
      </article>
    </main>
  );
}
