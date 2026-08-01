// Review rules shared by the server actions, the admin dashboard, and the UI.

import { displayLength, stripCustomEmoji } from './emoji';

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_BODY_LENGTH = 2000;

/**
 * The bar a review has to clear to be worth reading.
 *
 * Tuned against real submissions rather than picked round: a one-star review
 * reading "not enough femboys" (18 characters, three words) passed the old
 * 3-character minimum, while an genuinely useful short review like "Works
 * great, no ban after 3 months." is 35 characters and seven words. Both limits
 * exist because either alone is trivially satisfied — length alone invites
 * padding, word count alone invites "a a a a a".
 */
export const MIN_BODY_LENGTH = 30;
export const MIN_BODY_WORDS = 5;

/** Longest run of one repeated character before a body reads as keysmash. */
const MAX_REPEATED_RUN = 8;

/**
 * The rules as a reader sees them, shown next to the form.
 *
 * Only the first two are machine-checkable; the rest are what moderators point
 * at when removing a review. Stating them all in one place means the standard
 * being enforced is the standard that was published.
 */
export const REVIEW_RULES = [
  'Write about the listing itself — does it work, is it safe, is support responsive?',
  'At least a full sentence. One-liners and in-jokes get removed.',
  'Rate what you actually used, not the developer or the Discord drama around it.',
  'No spam, no copy-paste, no reviews posted to settle a score.',
] as const;

/**
 * Checks a body against the rules that can be checked, returning the message to
 * show or null when it passes. Shared so the form can warn while typing and the
 * server action can enforce, without the two drifting apart.
 */
export function checkReviewBody(body: string): string | null {
  const trimmed = body.trim();

  // Measured as rendered: `<:emoji:123…>` is one glyph on screen but ~25
  // characters of markup, so raw length would let two emoji clear the minimum.
  if (displayLength(trimmed) < MIN_BODY_LENGTH) {
    return `Reviews need at least ${MIN_BODY_LENGTH} characters — say what actually happened.`;
  }

  if (countWords(trimmed) < MIN_BODY_WORDS) {
    return `Write at least ${MIN_BODY_WORDS} words about the listing itself.`;
  }

  if (new RegExp(`(.)\\1{${MAX_REPEATED_RUN},}`).test(trimmed)) {
    return 'That reads as spam. Write it out properly.';
  }

  return null;
}

/**
 * Words that carry meaning: custom emoji are stripped first, and a token counts
 * only if it contains a letter — so "🔥 🔥 🔥 🔥 🔥" and "... ... ..." do not
 * add up to a review.
 */
function countWords(body: string): number {
  return stripCustomEmoji(body)
    .split(/\s+/)
    .filter((token) => /\p{L}/u.test(token)).length;
}

export function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_RATING &&
    value <= MAX_RATING
  );
}

export type RatingSummary = {
  average: number | null;
  count: number;
};

export function summarise(ratings: number[]): RatingSummary {
  if (ratings.length === 0) return { average: null, count: 0 };
  const total = ratings.reduce((sum, r) => sum + r, 0);
  return {
    // One decimal place is all the precision a 1-5 scale earns.
    average: Math.round((total / ratings.length) * 10) / 10,
    count: ratings.length,
  };
}

/**
 * Renders a rating as five Minecraft-ish stars. Half-stars are not used: on a
 * 1-5 scale with few reviews they imply more precision than exists, so the
 * average is shown as a number alongside the rounded stars.
 */
export function stars(average: number | null): string {
  if (average === null) return '☆☆☆☆☆';
  const filled = Math.round(average);
  return '★'.repeat(filled) + '☆'.repeat(MAX_RATING - filled);
}

/** Colour ramp for a rating, reusing the rarity palette's semantics. */
export function ratingColor(average: number | null): string {
  if (average === null) return '#9c92b8';
  if (average >= 4) return '#55ff55';
  if (average >= 3) return '#ffaa00';
  return '#ff5555';
}
