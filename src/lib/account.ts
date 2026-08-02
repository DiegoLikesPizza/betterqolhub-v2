// Account rules shared by registration, password changes, and the forms that
// mirror them client-side. Kept out of the 'use server' action files because
// those may only export async functions.

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * A Discord snowflake: digits only. 17 today, 18-19 in practice, with room to
 * grow — the id is a timestamp-derived integer, so it gets longer over time.
 * Checked because the field is normally written by the bot, and a hand-typed
 * "@someone" or a profile URL would otherwise be stored as if it were an id.
 */
export const DISCORD_ID_PATTERN = /^\d{17,20}$/;

/** Discord's own cap on a username. */
export const MAX_DISCORD_USERNAME_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 8;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

/** A username may be changed once per this many days. */
export const USERNAME_COOLDOWN_DAYS = 14;

/**
 * When the user may next change their name, or null if they can right now.
 * Lives here rather than in the action file because `'use server'` modules may
 * only export async functions, and the settings page needs this synchronously.
 */
export function usernameAvailableAt(changedAt: Date | null): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  return next > new Date() ? next : null;
}

/**
 * Cap on the admin-facing note attached to a review ban. Long enough for "spam
 * reviews on 6 listings, 12 Jul", short enough that nobody writes a case file
 * into a table cell.
 */
export const MAX_REVIEW_BAN_REASON_LENGTH = 300;

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) {
    return 'Passwords do not match.';
  }
  return null;
}
