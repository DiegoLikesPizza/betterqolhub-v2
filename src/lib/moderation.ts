// Pulling a listing from the catalogue while something is looked into.
//
// Separate from deletion on purpose. Deleting a listing throws away its
// reviews, its stats and its history, which is exactly the evidence you want
// kept while an accusation is unresolved — and it is irreversible, which a
// suspicion should not be.

/**
 * Cap on the admin-only note explaining why a listing was pulled. Long enough
 * for "three reports of stolen code, thread in #mod-log", short enough that it
 * stays a note rather than a case file.
 */
export const MAX_UNLIST_REASON_LENGTH = 300;

/**
 * What visitors are told on the detail page of an unlisted listing.
 *
 * Deliberately says nothing about what the accusation is. It is unproven —
 * repeating it under the hub's name would do the damage the review is meant to
 * establish is warranted. The reason an admin typed stays admin-only.
 */
export const UNLISTED_NOTICE =
  'This listing has been temporarily removed from the catalogue while we look into reports about it. It is not currently vetted — treat anything you download with caution until this is resolved.';
