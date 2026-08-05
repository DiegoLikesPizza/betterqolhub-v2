// Filter state for the public catalogue, defined once and shared.
//
// Filters live in the query string rather than in component state so that every
// view is a link: `/listings?category=LEGIT_MOD` can be posted into a legit-mod
// community and lands the reader on exactly that catalogue, with page metadata
// scoped to match. That only holds if the page (which reads the params to build
// metadata) and the browser (which applies them) agree on what each param
// means, so both import from here.

import { isCategoryKey } from './categories';
import { isPricingKey } from './pricing';
import type { RatingSummary } from './reviews';

/** Sentinel for "no constraint", shared by the category and pricing filters. */
export const ANY = 'ALL';

/**
 * Query-string keys. Short and readable, because these URLs are meant to be
 * pasted into chat by hand.
 */
export const PARAM = {
  category: 'category',
  query: 'q',
  pricing: 'pricing',
  trusted: 'trusted',
  sort: 'sort',
} as const;

/**
 * The sorts worth offering publicly. The admin table also carries "oldest" and
 * "lowest rated", which are data-quality tools rather than ways anyone browses.
 */
export const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'reviews', label: 'Most reviewed' },
] as const;

export type SortKey = (typeof SORTS)[number]['key'];

export const DEFAULT_SORT: SortKey = 'rating';

/**
 * How much evidence a listing's own average must outweigh before it is believed.
 *
 * The ranking is a Bayesian average: every listing starts out assumed to be an
 * ordinary listing, and its own reviews pull it away from that assumption in
 * proportion to how many there are. This is the weight of that assumption,
 * measured in reviews — at five, a listing with five reviews is ranked half on
 * its own average and half on the catalogue's.
 *
 * It replaced a hard floor of three reviews, which had a cliff at exactly the
 * wrong place: a third review could vault a listing over everything below it
 * without a word of new information being added.
 */
export const RATING_PRIOR_WEIGHT = 5;

/**
 * A listing's rank under "highest rated".
 *
 * `(count / (count + weight)) * average + (weight / (count + weight)) * mean` —
 * the listing's own average and the catalogue's, mixed in proportion to how much
 * evidence there is. One 5-star review barely moves off the catalogue mean;
 * twenty reviews are believed almost entirely.
 *
 * Deliberately *not* `(average / 5) * sqrt(count)`, which was the other
 * candidate. That grows without bound in the review count, so it ranks by
 * popularity wearing a rating's clothes — on this catalogue it puts Taunahi
 * (3.67 across 6) above Aether, GoofyAddons and NoammAddons, all sitting on a
 * clean 5.00. Whatever "highest rated" means, it cannot mean that. This formula
 * stays on the 1-5 scale, so the number it sorts by is still a rating someone
 * could read out loud.
 */
export function ratingScore(
  rating: RatingSummary,
  catalogueMean: number,
  weight: number = RATING_PRIOR_WEIGHT
): number {
  if (rating.average === null || rating.count === 0) return 0;
  return (
    (rating.count * rating.average + weight * catalogueMean) / (rating.count + weight)
  );
}

/**
 * The average review across the listings being ranked, weighted by review count.
 *
 * Read from the catalogue rather than fixed at 3.0, so the prior is whatever
 * "ordinary" actually is here and moves as the catalogue does.
 */
export function catalogueMean(ratings: RatingSummary[]): number {
  let reviews = 0;
  let total = 0;
  for (const r of ratings) {
    if (r.average === null) continue;
    reviews += r.count;
    total += r.average * r.count;
  }
  // Nothing rated yet: the prior has nothing to say, and every score is 0
  // regardless because each listing returns early above.
  return reviews === 0 ? 0 : total / reviews;
}

function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && SORTS.some((s) => s.key === value);
}

/**
 * Long enough for any real search, short enough that a pasted essay cannot bloat
 * the URL or end up echoed into the page description.
 */
export const MAX_QUERY_LENGTH = 64;

export type ListingFilters = {
  /** A category key, or ANY. */
  category: string;
  query: string;
  /** A pricing key, or ANY. */
  pricing: string;
  trusted: boolean;
  sort: SortKey;
};

/**
 * Params arrive as `URLSearchParams` on the client and as a plain object on the
 * server, so the parser accepts either and neither side needs its own copy.
 */
export type ParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | null {
  if (typeof (source as URLSearchParams).get === 'function') {
    return (source as URLSearchParams).get(key);
  }
  const value = (source as Record<string, string | string[] | undefined>)[key];
  // A repeated param (`?category=A&category=B`) arrives as an array; take the
  // first rather than rejecting, so a hand-mangled URL still resolves.
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * Unknown or malformed values fall back to "no constraint" instead of 404ing.
 * These links get edited by hand and outlive category renames, and a stale key
 * should still open a usable catalogue rather than an error page.
 */
export function parseFilters(source: ParamSource): ListingFilters {
  const category = read(source, PARAM.category);
  const pricing = read(source, PARAM.pricing);
  const sort = read(source, PARAM.sort);

  return {
    category: isCategoryKey(category) ? category : ANY,
    pricing: isPricingKey(pricing) ? pricing : ANY,
    trusted: read(source, PARAM.trusted) === '1',
    sort: isSortKey(sort) ? sort : DEFAULT_SORT,
    query: (read(source, PARAM.query) ?? '').slice(0, MAX_QUERY_LENGTH),
  };
}

/**
 * The query string for a filter set, with defaults omitted so an unfiltered
 * catalogue stays at a bare `/listings` and a shared link carries only the parts
 * that were deliberately chosen.
 */
export function serialiseFilters(filters: ListingFilters): string {
  const params = new URLSearchParams();
  if (filters.category !== ANY) params.set(PARAM.category, filters.category);
  if (filters.query.trim()) params.set(PARAM.query, filters.query.trim());
  if (filters.pricing !== ANY) params.set(PARAM.pricing, filters.pricing);
  if (filters.trusted) params.set(PARAM.trusted, '1');
  if (filters.sort !== DEFAULT_SORT) params.set(PARAM.sort, filters.sort);
  return params.toString();
}

/** True when anything is narrowing the catalogue — drives the "Clear" control. */
export function hasActiveFilters(filters: ListingFilters): boolean {
  return serialiseFilters(filters) !== '';
}

export const NO_FILTERS: ListingFilters = {
  category: ANY,
  query: '',
  pricing: ANY,
  trusted: false,
  sort: DEFAULT_SORT,
};

export type FilterableListing = {
  name: string;
  description: string;
  category: string;
  developer: string | null;
  isTrusted: boolean;
  pricing: string | null;
  createdAt: string;
  rating: RatingSummary;
};

/**
 * Every filter except category, which is applied separately so the same
 * predicate can also count what each category tab *would* show.
 */
function matchesBase(listing: FilterableListing, filters: ListingFilters): boolean {
  if (filters.trusted && !listing.isTrusted) return false;
  if (filters.pricing !== ANY && listing.pricing !== filters.pricing) return false;

  const q = filters.query.trim().toLowerCase();
  if (!q) return true;

  // The description is searched too. People arrive looking for a capability —
  // "dungeon", "auction", "routes" — far more often than for a name they
  // already know, and those words only ever appear in the description.
  return (
    listing.name.toLowerCase().includes(q) ||
    (listing.developer ?? '').toLowerCase().includes(q) ||
    listing.description.toLowerCase().includes(q)
  );
}

export function filterListings<T extends FilterableListing>(
  listings: T[],
  filters: ListingFilters
): T[] {
  return listings.filter(
    (l) =>
      matchesBase(l, filters) &&
      (filters.category === ANY || l.category === filters.category)
  );
}

/**
 * How many listings each category holds under the *other* active filters.
 *
 * Counting with the category constraint dropped is what makes the numbers worth
 * showing: they say where to go next, rather than restating the size of the tab
 * you are already looking at.
 */
export function countByCategory(
  listings: FilterableListing[],
  filters: ListingFilters
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const listing of listings) {
    if (!matchesBase(listing, filters)) continue;
    counts[listing.category] = (counts[listing.category] ?? 0) + 1;
  }
  return counts;
}

export function sortListings<T extends FilterableListing>(
  listings: T[],
  sort: SortKey
): T[] {
  // Unrated listings stay last under "highest rated". No reviews is missing
  // data, not a zero score, and ranking those beneath 1-star entries would read
  // as a judgement nobody made. Everything that *has* been rated is ordered by
  // one continuous score, so there is no longer a rank cliff at the nth review.
  const mean = catalogueMean(listings.map((l) => l.rating));
  const rated = (r: RatingSummary) => (r.average === null || r.count === 0 ? 0 : 1);
  const rank = (r: RatingSummary) => ratingScore(r, mean);

  return [...listings].sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'rating':
        return (
          rated(b.rating) - rated(a.rating) ||
          rank(b.rating) - rank(a.rating) ||
          // A tie on both is broken by review count, so the better-evidenced of
          // two equally rated listings comes first.
          b.rating.count - a.rating.count
        );
      case 'reviews':
        return b.rating.count - a.rating.count;
      default:
        // createdAt is an ISO string, so lexical order is chronological order.
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
}
