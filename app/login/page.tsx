'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LeafShadow } from '@/components/Decor';
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
      <section className="login-art" aria-hidden="true">
        <LeafShadow className="login-leaf" />
        <div className="login-art-copy">
          <div className="eyebrow">Affiliate Hub</div>
          <p className="login-quote">Every referral, reviewed and paid with care.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="eyebrow">Welcome back</div>
          <h1>Sign in</h1>
          <p className="page-subtitle">Ops &amp; finance dashboard</p>
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
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="demo-accounts">
            Demo accounts (password <code>demo1234</code>): <code>ops@demo.com</code> for the affiliate team, <code>finance@demo.com</code> for
            payouts. The first request can take ~30s while the free-tier API wakes up.
          </div>
        </div>
      </section>
    </main>
  );
}
