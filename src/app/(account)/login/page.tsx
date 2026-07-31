'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to land after signing in — set by the admin redirect and by the
  // "sign in to review" prompt on a listing page.
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await signIn('credentials', { username, password, redirect: false });

    setSubmitting(false);

    if (res?.error) {
      setError('Invalid username or password.');
      return;
    }

    // Only allow same-origin callbacks, so a crafted ?callbackUrl= cannot turn
    // the login page into an open redirect.
    router.push(callbackUrl.startsWith('/') ? callbackUrl : '/');
    router.refresh();
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      {error && <div className="form-alert form-alert-error">{error}</div>}

      <div className="form-group">
        <label className="form-label" htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          className="form-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>
        {submitting ? 'Signing in…' : 'Sign In'}
      </button>

      <p style={{ marginTop: '1.25rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        No account? <Link href="/register" style={{ color: 'var(--gold)' }}>Create one</Link>
      </p>
      <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        <Link href="/forgot-password" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="container narrow-page">
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="pixel page-title">Sign In</h1>
        <p className="page-sub">Sign in to review listings and track what you trust.</p>
      </div>

      {/* useSearchParams needs a Suspense boundary to avoid opting the whole
          route into client-side rendering at build time. */}
      <Suspense fallback={<div className="form-card">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
