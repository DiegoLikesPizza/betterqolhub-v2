'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteReview } from '../listings/[id]/actions';
import { stars, ratingColor } from '@/lib/reviews';
import EmojiText from '@/app/EmojiText';
import Pager, { pageSlice, pageCount } from './Pager';

type FeedItem = {
  id: string;
  rating: number;
  body: string;
  username: string;
  listingId: string;
  listingName: string;
  createdAt: string;
};

export default function ReviewFeed({ reviews }: { reviews: FeedItem[] }) {
  const [page, setPage] = useState(1);

  if (reviews.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>No reviews posted yet.</p>;
  }

  // Removing the last review on a page would otherwise strand you past the end.
  const currentPage = Math.min(page, pageCount(reviews.length));

  return (
    <>
      <div className="review-feed">
        {pageSlice(reviews, currentPage).map((review) => (
          <FeedRow key={review.id} review={review} />
        ))}
      </div>
      <Pager page={currentPage} total={reviews.length} onPage={setPage} noun="review" />
    </>
  );
}

function FeedRow({ review }: { review: FeedItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <article className="feed-item">
      <header className="feed-head">
        <span style={{ color: ratingColor(review.rating) }}>{stars(review.rating)}</span>
        <Link href={`/listings/${review.listingId}`} className="table-link">
          {review.listingName}
        </Link>
      </header>
      <p className="feed-body"><EmojiText>{review.body}</EmojiText></p>
      <footer className="feed-foot">
        <span className="table-muted">
          {review.username} · {new Date(review.createdAt).toLocaleDateString()}
        </span>
        <button
          type="button"
          className="table-btn table-btn-danger"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await deleteReview(review.id);
              } catch {
                setError('Delete failed.');
              }
            });
          }}
        >
          {pending ? 'Removing…' : 'Remove'}
        </button>
      </footer>
      {error && <div className="table-error">{error}</div>}
    </article>
  );
}
