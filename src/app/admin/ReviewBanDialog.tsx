'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useControlledDialog } from './useControlledDialog';
import { setReviewBan, type ReviewBanState } from './actions';
import { MAX_REVIEW_BAN_REASON_LENGTH } from '@/lib/account';

/**
 * Bars a member from posting reviews, or lifts the ban.
 *
 * The copy is explicit that existing reviews stay: the ban and the reviews the
 * account already wrote are separate decisions, and it should not be possible to
 * change a listing's rating by accident while moderating a person.
 */
export default function ReviewBanDialog({
  userId,
  username,
  banned,
  reason,
  bannedAt,
  openToken,
  onClose,
}: {
  userId: string;
  username: string;
  banned: boolean;
  reason: string | null;
  bannedAt: string | null;
  openToken: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useControlledDialog(openToken, onClose);
  const [state, action, pending] = useActionState<ReviewBanState, FormData>(
    setReviewBan,
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
        <h3 className="pixel modal-title">{banned ? 'Review ban' : 'Ban from reviewing'}</h3>
        <p className="modal-sub">
          {banned ? (
            <>
              <strong>{username}</strong> cannot post or edit reviews
              {bannedAt && <> since {new Date(bannedAt).toLocaleDateString()}</>}. Lifting
              the ban lets them post again immediately.
            </>
          ) : (
            <>
              <strong>{username}</strong> will not be able to post or edit reviews.
              Reviews they have already written stay up and keep counting towards
              ratings — remove those individually if they are the problem.
            </>
          )}
        </p>

        {state?.message && (
          <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
            {state.message}
          </div>
        )}

        <input type="hidden" name="userId" value={userId} />

        <label className="form-checkbox" style={{ marginBottom: '1rem' }}>
          <input type="checkbox" name="banned" defaultChecked={banned} />
          Banned from posting reviews
        </label>

        <div className="form-group">
          <label className="form-label" htmlFor={`banReason-${userId}`}>
            Reason{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id={`banReason-${userId}`}
            name="reason"
            className="form-textarea"
            maxLength={MAX_REVIEW_BAN_REASON_LENGTH}
            defaultValue={reason ?? ''}
            placeholder="e.g. Fake reviews on 6 listings after a refund dispute"
          />
          <p className="form-hint">
            For admins only. Never shown to the member or on the site — an unproven
            accusation is not something to publish under the hub&rsquo;s name.
          </p>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
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
