'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useControlledDialog } from './useControlledDialog';
import { setListingOwner, type SetOwnerState } from './actions';

/**
 * Grants a member the right to post announcements on one listing.
 *
 * Its own dialog rather than a field on the edit form: this is the step where
 * an admin vouches that the person on the other end really is the developer,
 * and it should not be something you change by accident while fixing a typo in
 * a description.
 */
export default function SetOwnerDialog({
  listingId,
  listingName,
  ownerUsername,
  openToken,
  onClose,
}: {
  listingId: string;
  listingName: string;
  ownerUsername: string | null;
  openToken: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useControlledDialog(openToken, onClose);
  const [state, action, pending] = useActionState<SetOwnerState, FormData>(
    setListingOwner,
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
          <h3 className="pixel modal-title">Listing owner</h3>
          <p className="modal-sub">
            The account that can post announcements on <strong>{listingName}</strong>.
            Verify over Discord that they really are the developer before granting
            this — nothing here checks that for you.
          </p>

          {state?.message && (
            <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
              {state.message}
            </div>
          )}

          <input type="hidden" name="listingId" value={listingId} />

          <div className="form-group">
            <label className="form-label" htmlFor={`owner-${listingId}`}>Username</label>
            <input
              id={`owner-${listingId}`}
              name="ownerUsername"
              type="text"
              className="form-input"
              defaultValue={ownerUsername ?? ''}
              placeholder="Leave empty to remove the owner"
              autoComplete="off"
            />
            <p className="form-hint">
              Must be a member who has linked their Discord, the same bar reviews
              already clear.
            </p>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
    </form>
    </dialog>
  );
}
