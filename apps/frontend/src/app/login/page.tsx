'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="mb-8 text-center">
          <Image src="/trackster-logo.png" alt="Trackster" width={513} height={206} className="mx-auto h-12 w-auto" priority />
          <p className="mt-2 text-label text-ink-muted">
            Tau persis budget harian kamu abis di mana, otomatis dari email bank.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-medium bg-surface p-5">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            prefix={<Lock size={16} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!error}
          />

          {error && <p className="text-small font-bold text-status-over">{error}</p>}

          <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
            {loading ? 'Masuk...' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-4 text-center text-small text-ink-subtle">
          Session disimpan di cookie. Kamu tetap login di HP ini.
        </p>
      </div>
    </div>
  );
}
