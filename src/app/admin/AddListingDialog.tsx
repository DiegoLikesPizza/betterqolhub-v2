'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addListing, type AddListingState } from './actions';
import ListingFields from './ListingFields';

/**
 * Adding a listing behind a button rather than a form that is always open.
 *
 * Same `<dialog>` pattern as EditListingDialog, deliberately: the two do nearly
 * the same job, and the modal styling here already accounts for this app's
 * global `* { margin: 0 }` (which otherwise pins a dialog to the top-left).
 */
export default function AddListingDialog() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<AddListingState, FormData>(
    addListing,
    undefined
  );

  // Close and refresh once saved, so the table below shows the new listing.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => dialogRef.current?.showModal()}
      >
        + Add listing
      </button>

      <dialog ref={dialogRef} className="modal modal-wide">
        <form ref={formRef} action={action} className="modal-body">
          <h3 className="pixel modal-title">Add a listing</h3>
          <p className="modal-sub">
            Saving publishes it to the Discord forum too.
          </p>

          {state?.message && !state.ok && (
            <div className="form-alert form-alert-error">{state.message}</div>
          )}

          <ListingFields />

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Adding…' : 'Add listing'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
