// Review rules shared by the server actions, the admin dashboard, and the UI.

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_BODY_LENGTH = 2000;

/**
 * The one rule, shown next to the form.
 *
 * Deliberately not backed by a character or word minimum. Those measure effort
 * rather than usefulness, and they get the judgement wrong in both directions:
 * "Works great, no ban after 3 months." is short and genuinely useful, while
 * padding a joke out to thirty characters is trivial. So the standard is stated
 * plainly and enforced by moderation, which can actually tell the difference.
 */
export const REVIEW_RULE =
  'Write something that helps the next person decide — does it work, is it safe, is support responsive?';

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
