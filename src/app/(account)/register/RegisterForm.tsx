'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { register, type AuthFormState } from '../actions';
import { safeCallbackUrl } from '@/lib/callback-url';

/**
 * @param callbackUrl Where to land after signing up. Someone who arrived from a
 *   listing's "create an account to leave a review" should end up back on that
 *   listing, not on the home page hunting for it again.
 */
export default function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(register, undefined);

  // Controlled on purpose: React resets a form after a successful action, so
  // reading the password back out of the DOM to auto-sign-in would read blanks.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // On success, sign the new account straight in rather than making them retype
  // the credentials they just chose.
  useEffect(() => {
    if (!state?.ok) return;

    signIn('credentials', { username, password, redirect: false }).then((res) => {
      if (res?.error) {
        // Account exists but auto sign-in failed — send them to sign in manually.
        // Sanitised before it is handed on, not only when it is followed: the
        // login page would reject a hostile value anyway, but there is no reason
        // to put one back into a URL bar on the way there.
        router.push(
          callbackUrl
            ? `/login?callbackUrl=${encodeURIComponent(safeCallbackUrl(callbackUrl))}`
            : '/login'
        );
      } else {
        // Only same-site paths are followed, so a crafted ?callbackUrl= cannot
        // bounce a freshly created account off to another host.
        router.push(safeCallbackUrl(callbackUrl));
        router.refresh();
      }
    });
    // Only re-run when the action result changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form className="form-card" action={action}>
      {state?.message && (
        <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
          {state.message}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          className="form-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          title="3-20 characters: letters, numbers or underscores"
          autoFocus
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="form-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Creating…' : 'Create Account'}
      </button>
    </form>
  );
}
