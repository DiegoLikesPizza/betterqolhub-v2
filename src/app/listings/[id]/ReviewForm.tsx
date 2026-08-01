'use client';

import { useActionState, useRef, useState } from 'react';
import { submitReview, type ReviewFormState } from './actions';
import {
  MAX_BODY_LENGTH,
  MAX_RATING,
  REVIEW_RULES,
  checkReviewBody,
} from '@/lib/reviews';
import { displayLength, type CustomEmoji } from '@/lib/emoji';
import EmojiPicker from './EmojiPicker';

type Existing = { rating: number; body: string } | null;

export default function ReviewForm({
  listingId,
  existing,
  customEmoji,
}: {
  listingId: string;
  existing: Existing;
  customEmoji: CustomEmoji[];
}) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(
    submitReview,
    undefined
  );

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState(existing?.body ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Insert at the caret rather than appending, and restore the caret after —
  // otherwise picking an emoji mid-sentence jumps the cursor to the end.
  function insert(text: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + text);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);

    requestAnimationFrame(() => {
      el.focus();
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
    });
  }

  const used = displayLength(body);
  const over = used > MAX_BODY_LENGTH;

  // The same check the server runs, so the button state and the eventual answer
  // agree. Only surfaced once there is something to judge — an untouched form
  // should not open with a complaint.
  const problem = checkReviewBody(body);
  const showProblem = body.trim().length > 0 && problem !== null;

  return (
    <form className="form-card" action={action}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="rating" value={rating} />

      {state?.message && (
        <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
          {state.message}
        </div>
      )}

      {existing && !state?.ok && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          You already reviewed this — posting again updates your review.
        </p>
      )}

      <div className="form-group">
        <span className="form-label">Rating</span>
        <div
          className="star-picker"
          role="radiogroup"
          aria-label="Rating out of 5"
          onMouseLeave={() => setHovered(0)}
        >
          {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              className={`star-btn ${value <= (hovered || rating) ? 'star-on' : ''}`}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onBlur={() => setHovered(0)}
              onClick={() => setRating(value)}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <div className="label-row">
          <label className="form-label" htmlFor="body">Your review</label>
          <EmojiPicker customEmoji={customEmoji} onPick={insert} />
        </div>
        <ul className="review-rules">
          {REVIEW_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <textarea
          ref={textareaRef}
          id="body"
          name="body"
          className="form-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Does it work? Did it get you banned? Is support responsive?"
          required
        />
        <div className="count-row">
          {showProblem ? <span className="rule-warning">{problem}</span> : <span />}
          <span className={`char-count ${over ? 'char-count-over' : ''}`}>
            {used} / {MAX_BODY_LENGTH}
          </span>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending || rating === 0 || over || problem !== null}
        style={{ width: '100%' }}
      >
        {pending ? 'Posting…' : existing ? 'Update Review' : 'Post Review'}
      </button>
    </form>
  );
}
