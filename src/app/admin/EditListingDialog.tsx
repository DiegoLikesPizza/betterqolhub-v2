'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useControlledDialog } from './useControlledDialog';
import { editListing, type EditListingState } from './actions';
import ListingFields, { type ListingDefaults } from './ListingFields';

export type EditableListing = ListingDefaults & { id: string; name: string; category: string };

/**
 * Opened by the row's actions menu rather than by a trigger of its own.
 *
 * Closing that menu unmounts everything inside it, and an open <dialog> that
 * gets unmounted takes the modal with it — so the trigger lives in the menu and
 * the dialog is rendered by the row.
 */
export default function EditListingDialog({
  listing,
  openToken,
  onClose,
}: {
  listing: EditableListing;
  openToken: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useControlledDialog(openToken, onClose);
  const [state, action, pending] = useActionState<EditListingState, FormData>(
    editListing,
    undefined
  );

  // Close and refresh once saved, so the table reflects the new values.
  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, router, onClose]);


  return (
    <dialog ref={dialogRef} className="modal modal-wide">
      <form action={action} className="modal-body">
        <h3 className="pixel modal-title">Edit listing</h3>
        <p className="modal-sub">
          Saving updates the Discord post too. Changing the category moves it to
          another forum, which starts a new thread.
        </p>

        {state?.message && (
          <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
            {state.message}
          </div>
        )}

        <input type="hidden" name="listingId" value={listing.id} />
        <ListingFields defaults={listing} />

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
