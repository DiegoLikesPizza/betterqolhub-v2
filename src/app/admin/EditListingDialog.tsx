'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { editListing, type EditListingState } from './actions';
import ListingFields, { type ListingDefaults } from './ListingFields';

export type EditableListing = ListingDefaults & { id: string; name: string; category: string };

export default function EditListingDialog({ listing }: { listing: EditableListing }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<EditListingState, FormData>(
    editListing,
    undefined
  );

  // Close and refresh once saved, so the table reflects the new values.
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
        Edit
      </button>

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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
