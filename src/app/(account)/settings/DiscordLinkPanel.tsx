'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startDiscordLink, confirmDiscordLink, unlinkDiscord, type LinkState } from './actions';

export default function DiscordLinkPanel({
  linkedUsername,
  linkedAt,
  botConfigured,
}: {
  linkedUsername: string | null;
  linkedAt: string | null;
  botConfigured: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [requestState, requestAction, requesting] = useActionState<LinkState, FormData>(
    startDiscordLink,
    undefined
  );
  const [confirmState, confirmAction, confirming] = useActionState<LinkState, FormData>(
    confirmDiscordLink,
    undefined
  );
  const [unlinking, startUnlink] = useTransition();

  // These effects only drive the <dialog> element imperatively — open state
  // lives in the DOM (dialog.open), so there is no React state to keep in sync.
  useEffect(() => {
    if (requestState?.step === 'awaiting-code' && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [requestState]);

  useEffect(() => {
    if (confirmState?.step === 'linked') {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [confirmState, router]);

  function closeDialog() {
    dialogRef.current?.close();
  }

  if (linkedUsername) {
    return (
      <div className="form-card">
        <div className="linked-row">
          <div>
            <div className="linked-label">Linked account</div>
            <div className="linked-name">{linkedUsername}</div>
            {linkedAt && (
              <div className="table-muted">
                since {new Date(linkedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={unlinking}
            onClick={() => startUnlink(async () => {
              await unlinkDiscord();
              router.refresh();
            })}
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <form className="form-card" action={requestAction}>
        {!botConfigured && (
          <div className="form-alert form-alert-error">
            Discord linking is not configured on this site yet.
          </div>
        )}
        {requestState?.step === 'error' && (
          <div className="form-alert form-alert-error">{requestState.message}</div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="discordUsername">Discord username</label>
          <input
            id="discordUsername"
            name="discordUsername"
            type="text"
            className="form-input"
            placeholder="yourname"
            autoComplete="off"
            required
          />
          <p className="field-hint">
            You must already be a member of the Discord server, with DMs from server
            members enabled — the bot sends your code by DM.
          </p>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={requesting || !botConfigured}
          style={{ width: '100%' }}
        >
          {requesting ? 'Sending code…' : 'Send verification code'}
        </button>
      </form>

      <dialog ref={dialogRef} className="modal">
        <form action={confirmAction} className="modal-body">
          <h3 className="pixel modal-title">Enter your code</h3>

          {requestState?.step === 'awaiting-code' && confirmState?.step !== 'awaiting-code' && (
            <p className="modal-sub">{requestState.message}</p>
          )}
          {confirmState?.step === 'awaiting-code' && (
            <div className="form-alert form-alert-error">{confirmState.message}</div>
          )}
          {confirmState?.step === 'error' && (
            <div className="form-alert form-alert-error">{confirmState.message}</div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="code">6-character code</label>
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

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closeDialog}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={confirming}>
              {confirming ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
