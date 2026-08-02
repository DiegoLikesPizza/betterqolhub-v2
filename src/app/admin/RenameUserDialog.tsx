'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useControlledDialog } from './useControlledDialog';
import { renameUser, type RenameUserState } from './actions';
import { USERNAME_COOLDOWN_DAYS } from '@/lib/account';

/**
 * Renames a member from the admin side.
 *
 * Members can already rename themselves in Settings, subject to a cooldown. This
 * is not that path with the guard removed for convenience — it is for the cases
 * self-service does not cover: a name that has to go now, or an account whose
 * owner cannot reach the setting.
 */
export default function RenameUserDialog({
  userId,
  username,
  openToken,
  onClose,
}: {
  userId: string;
  username: string;
  openToken: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useControlledDialog(openToken, onClose);
  const [state, action, pending] = useActionState<RenameUserState, FormData>(
    renameUser,
    undefined
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, router, onClose]);

  return (
    <dialog ref={dialogRef} className="modal">
      <form action={action} className="modal-body">
        <h3 className="pixel modal-title">Rename member</h3>
        <p className="modal-sub">
          Renaming <strong>{username}</strong> takes effect everywhere at once,
          including on every review they have written. Their own{' '}
          {USERNAME_COOLDOWN_DAYS}-day cooldown is neither used up nor reset by this.
        </p>

        {state?.message && (
          <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
            {state.message}
          </div>
        )}

        <input type="hidden" name="userId" value={userId} />

        <div className="form-group">
          <label className="form-label" htmlFor={`username-${userId}`}>New username</label>
          <input
            id={`username-${userId}`}
            name="username"
            type="text"
            className="form-input"
            defaultValue={username}
            minLength={3}
            maxLength={20}
            autoComplete="off"
            required
          />
          <p className="form-hint">
            3–20 characters: letters, numbers and underscores.
          </p>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
