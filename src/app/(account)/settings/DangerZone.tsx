'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { deleteAccount, type AccountActionState } from './account-actions';

export default function DangerZone({ username }: { username: string }) {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(
    deleteAccount,
    undefined
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  // Reopen the dialog if the server rejected the attempt, so the error is
  // visible next to the fields that caused it.
  useEffect(() => {
    if (state?.ok === false && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [state]);

  return (
    <>
      <div className="form-card danger-card">
        <p className="danger-copy">
          Deleting your account removes your reviews everywhere, including the ones
          already posted to Discord. This cannot be undone.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => dialogRef.current?.showModal()}
        >
          Delete account
        </button>
      </div>

      <dialog ref={dialogRef} className="modal">
        <form action={action} className="modal-body">
          <h3 className="pixel modal-title">Delete your account?</h3>
          <p className="modal-sub">
            This permanently removes your account and every review you have written.
            There is no undo.
          </p>

          {state?.message && <div className="form-alert form-alert-error">{state.message}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="password">Your password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmation">
              Type <strong>{username}</strong> to confirm
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="text"
              className="form-input"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              // Belt and braces: the server checks this too.
              disabled={pending || typed !== username}
            >
              {pending ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
