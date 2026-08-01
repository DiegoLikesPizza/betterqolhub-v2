// Developer announcements: the one place a listing's owner speaks on their own
// page.
//
// Kept deliberately narrow. The site's value is an independent verdict, so
// vendor-authored text has to be obviously vendor-authored and must never touch
// the rating — see the Announcement model, which is a separate table from
// Review for exactly that reason.

/**
 * Long enough for a real changelog, short enough that the listing page does not
 * turn into a blog. Matches the review limit so the two forms behave alike.
 */
export const MAX_ANNOUNCEMENT_LENGTH = 2000;

/**
 * How many the history dialog loads.
 *
 * The page itself only ever renders the newest one; everything older sits
 * behind "View all", which is what keeps a two-year-old "v1.2 released" from
 * being the first thing a visitor reads.
 */
export const ANNOUNCEMENT_HISTORY_LIMIT = 50;

/** Shown above the composer, in the same spirit as the review rule. */
export const ANNOUNCEMENT_RULE =
  'Posted publicly under your name as this listing’s developer. Use it for releases, outages and warnings about fake copies — not for replying to reviews.';
