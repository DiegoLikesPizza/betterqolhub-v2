'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestReset, completeReset, type ForgotState } from './actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';

export default function ForgotPasswordForm() {
  const [requestState, requestAction, requesting] = useActionState<ForgotState, FormData>(
    requestReset,
    undefined
  );
  const [resetState, resetAction, resetting] = useActionState<ForgotState, FormData>(
    completeReset,
    undefined
  );

  // The reset step drives the view once it has run; before that, the request
  // step does.
  const state = resetState ?? requestState;

  if (state?.step === 'done') {
    return (
      <div className="form-card" style={{ textAlign: 'center' }}>
        <div className="form-alert form-alert-success">{state.message}</div>
        <Link href="/login" className="btn btn-primary" style={{ width: '100%' }}>
          Go to sign in
        </Link>
      </div>
    );
  }

  if (state?.step === 'code') {
    return (
      <form className="form-card" action={resetAction}>
        {state.message && (
          <div className="form-alert form-alert-error">{state.message}</div>
        )}

        {/* Carried forward so the second step knows whose reset this is. It is
            not a secret — the code is what proves ownership. */}
        <input type="hidden" name="username" value={state.username} />

        <div className="form-group">
          <label className="form-label" htmlFor="code">Reset code from Discord</label>
          <input
            id="code"
            name="code"
            type="text"
            className="form-input code-input"
            maxLength={6}
            minLength={6}
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">New password</label>
          <input
            id="password"
            name="password"
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

        <button type="submit" className="btn btn-primary" disabled={resetting} style={{ width: '100%' }}>
          {resetting ? 'Resetting…' : 'Set new password'}
        </button>
      </form>
    );
  }

  return (
    <form className="form-card" action={requestAction}>
      {state?.step === 'request' && state.message && (
        <div className="form-alert form-alert-error">{state.message}</div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          className="form-input"
          autoComplete="username"
          autoFocus
          required
        />
        <p className="field-hint">
          Only works if your account has a linked Discord — that DM is the only way
          we can reach you. There are no email addresses on this site.
        </p>
      </div>

      <button type="submit" className="btn btn-primary" disabled={requesting} style={{ width: '100%' }}>
        {requesting ? 'Sending…' : 'Send reset code'}
      </button>
    </form>
  );
}
