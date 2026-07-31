'use client';

import { useActionState, useEffect, useRef } from 'react';
import { changePassword, type AccountActionState } from './account-actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';

export default function PasswordPanel() {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(
    changePassword,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful change so the old password is not left
  // sitting in the DOM.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} className="form-card" action={action}>
      {state?.message && (
        <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
          {state.message}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          className="form-input"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          className="form-input"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="confirmPassword">Confirm new password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="form-input"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Changing…' : 'Change password'}
      </button>

      <p className="field-hint">
        Other devices stay signed in until their session expires — sessions are
        stateless and cannot be revoked from here.
      </p>
    </form>
  );
}
