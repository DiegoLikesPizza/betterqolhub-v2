'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useControlledDialog } from './useControlledDialog';
import { setListingUnlisted, type UnlistState } from './actions';
import { MAX_UNLIST_REASON_LENGTH } from '@/lib/moderation';

/**
 * Pulls a listing from the catalogue while something is looked into, or puts it
 * back. Separate from Delete, and worded so the two are not confused at a
 * glance — one is reversible and keeps everything, the other is neither.
 */
export default function UnlistDialog({
  listingId,
  listingName,
  unlisted,
  reason,
  openToken,
  onClose,
}: {
  listingId: string;
  listingName: string;
  unlisted: boolean;
  reason: string | null;
  openToken: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useControlledDialog(openToken, onClose);
  const [state, action, pending] = useActionState<UnlistState, FormData>(
    setListingUnlisted,
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
          <h3 className="pixel modal-title">
            {unlisted ? 'Put back in the catalogue' : 'Unlist temporarily'}
          </h3>
          <p className="modal-sub">
            {unlisted ? (
              <>
                <strong>{listingName}</strong> is hidden from /listings and from the
                API, and its Discord post was removed. Listing it again restores the
                post.
              </>
            ) : (
              <>
                Hides <strong>{listingName}</strong> from /listings and the API and
                deletes its Discord post. Reviews, stats and announcements are kept,
                so this is reversible — use Delete only when it should be gone for
                good.
              </>
            )}
          </p>

          {state?.message && (
            <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
              {state.message}
            </div>
          )}

          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="unlist" value={unlisted ? '0' : '1'} />

          {unlisted ? (
            reason && (
              <p className="form-hint">
                Pulled because: <em>{reason}</em>
              </p>
            )
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor={`reason-${listingId}`}>Reason</label>
              <textarea
                id={`reason-${listingId}`}
                name="reason"
                className="form-textarea"
                maxLength={MAX_UNLIST_REASON_LENGTH}
                placeholder="e.g. three reports of stolen code, thread in #mod-log"
                required
              />
              <p className="form-hint">
                Admin-only. Visitors are told the listing is being looked into and
                nothing more — the accusation is unproven, and repeating it under the
                hub&rsquo;s name would do the damage before it is established.
              </p>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Saving…' : unlisted ? 'List again' : 'Unlist'}
            </button>
          </div>
    </form>
    </dialog>
  );
}
