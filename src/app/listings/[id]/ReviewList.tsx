'use client';

import { useState, useTransition } from 'react';
import { deleteReview } from './actions';
import { stars, ratingColor } from '@/lib/reviews';
import EmojiText from '@/app/EmojiText';

type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  username: string;
  userId: string;
  createdAt: string;
};

/**
 * How many reviews show before asking.
 *
 * Enough to judge the consensus at a glance, few enough that a listing with
 * forty reviews does not bury everything below it.
 */
const INITIAL = 5;

export default function ReviewList({
  reviews,
  viewerId,
  viewerIsAdmin,
}: {
  reviews: ReviewItem[];
  viewerId: string | null;
  viewerIsAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (reviews.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', marginTop: '2rem' }}>
        No reviews yet — be the first to say whether this one holds up.
      </p>
    );
  }

  const shown = expanded ? reviews : reviews.slice(0, INITIAL);
  const hidden = reviews.length - shown.length;

  return (
    <div className="review-list">
      {shown.map((review) => (
        <ReviewRow
          key={review.id}
          review={review}
          canDelete={viewerIsAdmin || review.userId === viewerId}
        />
      ))}

      {hidden > 0 && (
        <button type="button" className="btn btn-secondary review-more" onClick={() => setExpanded(true)}>
          Show {hidden} more {hidden === 1 ? 'review' : 'reviews'}
        </button>
      )}

      {/* Only offered once expanded, and only when it saves real scrolling —
          collapsing a list of seven is a control nobody needs. */}
      {expanded && reviews.length > INITIAL * 2 && (
        <button type="button" className="btn btn-secondary review-more" onClick={() => setExpanded(false)}>
          Show fewer
        </button>
      )}
    </div>
  );
}

function ReviewRow({ review, canDelete }: { review: ReviewItem; canDelete: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <article className="review-item">
      <header className="review-head">
        <div>
          <span className="review-author">{review.username}</span>
          <span className="review-date">
            {new Date(review.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
        <span className="rating-stars" style={{ color: ratingColor(review.rating) }}>
          {stars(review.rating)}
        </span>
      </header>

      <p className="review-body"><EmojiText>{review.body}</EmojiText></p>

      {canDelete && (
        <button
          type="button"
          className="review-delete"
          disabled={pending}
          onClick={() => startTransition(() => { void deleteReview(review.id); })}
        >
          {pending ? 'Deleting…' : 'Delete'}
        </button>
      )}
    </article>
  );
}
