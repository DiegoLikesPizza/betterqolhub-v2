'use client';

import { useActionState } from 'react';
import { changeUsername, type AccountActionState } from './account-actions';
import { USERNAME_COOLDOWN_DAYS } from '@/lib/account';

export default function UsernamePanel({
  currentUsername,
  lockedUntil,
}: {
  currentUsername: string;
  lockedUntil: string | null;
}) {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(
    changeUsername,
    undefined
  );

  // Locked state is computed on the server; the action re-checks it, so this is
  // only about not offering an action that would be refused.
  if (lockedUntil) {
    return (
      <div className="form-card">
        <p style={{ color: 'var(--text-secondary)' }}>
          You are <strong style={{ color: 'var(--gold)' }}>{currentUsername}</strong>. You can
          change your username again on{' '}
          <strong>{new Date(lockedUntil).toLocaleDateString()}</strong>.
        </p>
      </div>
    );
  }

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
          defaultValue={currentUsername}
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          title="3-20 characters: letters, numbers or underscores"
          required
        />
        <p className="field-hint">
          You can change this once every {USERNAME_COOLDOWN_DAYS} days. Your existing
          reviews will show the new name.
        </p>
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Saving…' : 'Change username'}
      </button>
    </form>
  );
}
