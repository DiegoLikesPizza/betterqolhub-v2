// What a listing looks like to someone who is not on its team.
//
// Prisma returns every scalar column when a query names neither `select` nor a
// field list, which makes "public" the default for any column added later. That
// is backwards: `changelogWebhookUrl` is a credential and `unlistedReason` is an
// unproven accusation, and both reached a public response that way. These
// projections are allowlists so the default for a new column is to stay in.
//
// Anything sensitive must be fetched deliberately, in a server-only path, by
// naming it — see the webhook reads in src/app/listings/[id]/actions.ts.

/**
 * The public API shape for a listing.
 *
 * Deliberately every field `GET /api/listings` returned before the credential
 * leak was closed, minus the two that were never meant to be public: the Discord
 * bot reads this endpoint, and narrowing the shape further is a separate change
 * from stopping the disclosure.
 */
export const PUBLIC_LISTING_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  developer: true,
  url: true,
  secondaryUrl: true,
  urlLabel: true,
  secondaryUrlLabel: true,
  features: true,
  isTrusted: true,
  pricing: true,
  price: true,
  createdAt: true,
  updatedAt: true,
  teamId: true,
  unlistedAt: true,
} as const;

/**
 * The subset the catalogue grid renders.
 *
 * Tighter than the API shape because this one crosses into a client component:
 * every field here is serialised into the RSC payload and is readable in the
 * page source by anyone. It matches the `Listing` type in ListingsBrowser.tsx —
 * that type described these fields already, but a type cannot stop the
 * serialiser from sending columns the query happened to fetch.
 */
export const CATALOGUE_LISTING_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  developer: true,
  url: true,
  secondaryUrl: true,
  urlLabel: true,
  secondaryUrlLabel: true,
  isTrusted: true,
  pricing: true,
  price: true,
  createdAt: true,
} as const;
