'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Notice } from '@/components/Notice';

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) router.replace('/overview');
  }, [ready, user, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? errorMessage(err) : err instanceof Error ? err.message : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="login-wrap">
      <div className="card login-card">
        <div className="card-body" style={{ padding: 28 }}>
          <h1>Affiliate Hub</h1>
          <p className="sub" style={{ marginTop: 0, marginBottom: 20 }}>
            Sign in to the ops &amp; finance dashboard
          </p>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="demo-accounts">
            Demo accounts (password <code>demo1234</code>): <code>ops@demo.com</code> for the affiliate team, <code>finance@demo.com</code> for
            payouts. The first request can take ~30s while the free-tier API wakes up.
          </div>
        </div>
      </div>
    </main>
  );
}
