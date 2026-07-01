'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('alice@demo.dev');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login' ? { email, password } : { email, name, password };
      const data = await api<{ token: string }>(path, { method: 'POST', body });
      setToken(data.token);
      router.replace('/dashboard');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 380, marginTop: 80 }}>
      <div className="card stack">
        <h2 style={{ margin: 0 }}>ProjectFlow</h2>
        <p className="muted" style={{ margin: 0 }}>
          {mode === 'login' ? 'Sign in to your workspace' : 'Create an account'}
        </p>

        {mode === 'register' && (
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <div className="error">{error}</div>}

        <button className="primary" onClick={submit} disabled={loading}>
          {loading ? '…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>

        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>

        {mode === 'login' && (
          <p className="muted" style={{ fontSize: 12 }}>
            Demo: alice@demo.dev / password123 (run <code>npm run seed</code> first)
          </p>
        )}
      </div>
    </div>
  );
}
