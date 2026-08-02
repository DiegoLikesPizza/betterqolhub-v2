'use client';

import Link from 'next/link';
import { useRef } from 'react';

export type ReviewGate = 'signed-out' | 'own-listing' | 'banned' | 'no-discord';

/**
 * The "Leave a review" button for people who cannot, yet.
 *
 * The button is always there and always in the same place. The reason used to be
 * a notice card sitting where the button belongs, which made the section
 * jump around depending on who was looking at it — and told signed-out visitors
 * why they were being refused before they had asked for anything.
 */
export default function ReviewGateDialog({
  gate,
  listingId,
}: {
  gate: ReviewGate;
  listingId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  const copy = {
    'signed-out': {
      title: 'Oops…',
      body: 'It seems like you’re not logged in. Log in or create an account to leave a review.',
    },
    'own-listing': {
      title: 'That’s your own listing',
      body: 'You are on this listing’s team, so you cannot review it. Use “Post announcement” above to say something to the people following it.',
    },
    banned: {
      // The reason behind the ban is an admin note and stays one.
      title: 'Reviews are closed for your account',
      body: 'Your account cannot post reviews. If you think that is a mistake, reach out to an admin on Discord.',
    },
    'no-discord': {
      title: 'One step first',
      body: 'Reviews here are tied to a verified Discord account — it is what keeps them worth reading. Link yours in Settings and you are good to go.',
    },
  }[gate];

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => dialogRef.current?.showModal()}
      >
        Leave a review
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-body">
          <h3 className="pixel modal-title">{copy.title}</h3>
          <p className="modal-sub">{copy.body}</p>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={close}>
              Close
            </button>

            {gate === 'signed-out' && (
              <>
                <Link
                  href={`/register?callbackUrl=/listings/${listingId}`}
                  className="btn btn-secondary"
                >
                  Create account
                </Link>
                {/* The primary action is signing in: someone who already has an
                    account is the far more common case here. */}
                <Link
                  href={`/login?callbackUrl=/listings/${listingId}`}
                  className="btn btn-primary"
                >
                  Log in
                </Link>
              </>
            )}

            {gate === 'no-discord' && (
              <Link href="/settings" className="btn btn-primary">
                Open Settings
              </Link>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
