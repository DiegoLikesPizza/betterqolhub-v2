'use client';

import { useTransition } from 'react';
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

export default function ReviewList({
  reviews,
  viewerId,
  viewerIsAdmin,
}: {
  reviews: ReviewItem[];
  viewerId: string | null;
  viewerIsAdmin: boolean;
}) {
  if (reviews.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', marginTop: '2rem' }}>
        No reviews yet — be the first to say whether this one holds up.
      </p>
    );
  }

  return (
    <div className="review-list">
      {reviews.map((review) => (
        <ReviewRow
          key={review.id}
          review={review}
          canDelete={viewerIsAdmin || review.userId === viewerId}
        />
      ))}
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
