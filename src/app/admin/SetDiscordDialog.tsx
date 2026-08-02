'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { setUserDiscord, type SetDiscordState } from './actions';
import { MAX_DISCORD_USERNAME_LENGTH } from '@/lib/account';

/**
 * Sets or clears a member's Discord link by hand.
 *
 * Worded to make clear this is the exception. The normal path is the member
 * proving the account over DM, and that proof is what reviews and listing
 * ownership are actually leaning on.
 */
export default function SetDiscordDialog({
  userId,
  username,
  discordUsername,
  linkedByAdmin,
}: {
  userId: string;
  username: string;
  discordUsername: string | null;
  linkedByAdmin: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<SetDiscordState, FormData>(
    setUserDiscord,
    undefined
  );

  useEffect(() => {
    if (state?.ok) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        className="table-btn"
        onClick={() => dialogRef.current?.showModal()}
      >
        {discordUsername ? 'Edit Discord' : 'Link Discord'}
      </button>

      <dialog ref={dialogRef} className="modal">
        <form action={action} className="modal-body">
          <h3 className="pixel modal-title">Discord link</h3>
          <p className="modal-sub">
            Setting this by hand skips the DM check that normally proves the account
            belongs to <strong>{username}</strong>. It stays marked as admin-set, so
            a link nobody verified is still recognisable later. Use it when the DM
            path is unavailable, not to save the member a step.
          </p>

          {state?.message && (
            <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
              {state.message}
            </div>
          )}

          {linkedByAdmin && (
            <p className="form-hint" style={{ marginBottom: '1rem' }}>
              The current link was set by an admin, not verified by the member.
            </p>
          )}

          <input type="hidden" name="userId" value={userId} />

          <div className="form-group">
            <label className="form-label" htmlFor={`discordId-${userId}`}>Discord user ID</label>
            <input
              id={`discordId-${userId}`}
              name="discordId"
              type="text"
              inputMode="numeric"
              className="form-input"
              placeholder="Leave empty to remove the link"
              autoComplete="off"
            />
            <p className="form-hint">
              The snowflake, not the @name — Discord settings → Advanced → Developer
              Mode, then right-click the user and &ldquo;Copy User ID&rdquo;.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={`discordUsername-${userId}`}>
              Discord username{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id={`discordUsername-${userId}`}
              name="discordUsername"
              type="text"
              className="form-input"
              maxLength={MAX_DISCORD_USERNAME_LENGTH}
              defaultValue={discordUsername ?? ''}
              autoComplete="off"
            />
            <p className="form-hint">Shown in the members table. Display only.</p>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
