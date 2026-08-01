'use client';

import { useOptimistic, useState, useTransition } from 'react';
import Link from 'next/link';
import { setFollowing } from './actions';

/**
 * Following is optimistic: the label flips immediately and only rolls back if
 * the action fails. It is a one-bit, reversible change, so making people wait
 * on a round trip to see it buys nothing.
 */
export default function FollowButton({
  listingId,
  signedIn,
  following,
  followers,
}: {
  listingId: string;
  signedIn: boolean;
  following: boolean;
  followers: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(
    { following, followers },
    (_state, next: { following: boolean; followers: number }) => next
  );

  if (!signedIn) {
    return (
      <Link href={`/login?callbackUrl=/listings/${listingId}`} className="follow-btn">
        Follow for updates
      </Link>
    );
  }

  function toggle() {
    const next = !optimistic.following;
    setError(null);

    startTransition(async () => {
      setOptimistic({
        following: next,
        followers: optimistic.followers + (next ? 1 : -1),
      });
      try {
        await setFollowing(listingId, next);
      } catch {
        // useOptimistic reverts to the server value when the transition ends,
        // so there is nothing to undo by hand — only something to say.
        setError('Could not save that.');
      }
    });
  }

  return (
    <div className="follow-wrap">
      <button
        type="button"
        className={`follow-btn${optimistic.following ? ' follow-btn-on' : ''}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={optimistic.following}
      >
        {optimistic.following ? '✓ Following' : '+ Follow'}
        {optimistic.followers > 0 && (
          <span className="follow-count">{optimistic.followers}</span>
        )}
      </button>
      {error && <span className="follow-error">{error}</span>}
    </div>
  );
}
