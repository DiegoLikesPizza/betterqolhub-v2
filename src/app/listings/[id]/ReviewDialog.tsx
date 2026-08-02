'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReviewForm from './ReviewForm';
import type { CustomEmoji } from '@/lib/emoji';

/**
 * The review form, behind a button.
 *
 * It used to sit open above the reviews, which put a form between the reader and
 * the thing they came for — other people's verdicts. Most visitors are reading,
 * not writing.
 *
 * The form is only mounted while the dialog is open, so its draft resets between
 * visits rather than holding a half-written review from an hour ago.
 */
export default function ReviewDialog({
  listingId,
  customEmoji,
  existing,
}: {
  listingId: string;
  customEmoji: CustomEmoji[];
  existing: { rating: number; body: string } | null;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        {existing ? 'Edit your review' : 'Leave a review'}
      </button>

      <dialog
        ref={dialogRef}
        className="modal modal-wide"
        // Fires for Escape and for the close() above alike, so the mounted
        // state cannot drift from what the element is actually doing.
        onClose={() => setOpen(false)}
      >
        <div className="modal-body">
          <h3 className="pixel modal-title">
            {existing ? 'Edit your review' : 'Leave a review'}
          </h3>
          <p className="modal-sub">
            Your Discord name is shown with it. Say what you would want to read
            before installing this yourself.
          </p>

          {open && (
            <ReviewForm
              listingId={listingId}
              customEmoji={customEmoji}
              existing={existing}
              onPosted={close}
            />
          )}

          <div className="modal-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={close}>
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
