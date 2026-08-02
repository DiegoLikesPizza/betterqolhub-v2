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
 * How many reviews a listing needs before its average is treated as a ranking.
 *
 * Without a floor, "highest rated" is trivially gamed: one 5-star review would
 * outrank a listing holding 4.9 across fifty. Below the floor a listing is not
 * demoted for being *bad* — it is set aside for not being *known yet*, and still
 * sorts among its peers by rating.
 */
export const RATING_CONFIDENCE_MIN = 3;

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
  // Thinly reviewed listings sort after well-reviewed ones under "highest
  // rated", and unrated ones last of all. No reviews is missing data, not a zero
  // score, and ranking those beneath 1-star entries would read as a judgement
  // nobody made — but neither should a single 5-star review top the catalogue.
  // Within each tier the average still decides.
  const tier = (r: RatingSummary) =>
    r.average === null ? 0 : r.count >= RATING_CONFIDENCE_MIN ? 2 : 1;
  const rank = (r: RatingSummary) => r.average ?? 0;

  return [...listings].sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'rating':
        return (
          tier(b.rating) - tier(a.rating) ||
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
