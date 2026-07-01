'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    setSubmitting(false);

    if (res?.error) {
      setError('Invalid username or password.');
    } else {
      router.push('/admin');
      router.refresh();
    }
  }

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="pixel" style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', fontWeight: 700, marginBottom: '1rem' }}>Admin Login</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>
          Sign in to manage clients.
        </p>
      </div>

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
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
