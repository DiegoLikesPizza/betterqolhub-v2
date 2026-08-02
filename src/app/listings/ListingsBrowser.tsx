'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CATEGORIES,
  categoryLabel,
  categoryColor,
  linkLabelFor,
} from '@/lib/categories';
import { stars, ratingColor, type RatingSummary } from '@/lib/reviews';
import { PRICING, pricingBadge, pricingColor } from '@/lib/pricing';
import {
  ANY,
  SORTS,
  MAX_QUERY_LENGTH,
  parseFilters,
  serialiseFilters,
  filterListings,
  countByCategory,
  sortListings,
  hasActiveFilters,
  NO_FILTERS,
  type ListingFilters,
} from '@/lib/listing-filters';

type Listing = {
  id: string;
  name: string;
  description: string;
  category: string;
  developer: string | null;
  url: string;
  secondaryUrl: string | null;
  urlLabel: string | null;
  secondaryUrlLabel: string | null;
  isTrusted: boolean;
  pricing: string | null;
  price: string | null;
  createdAt: string;
  rating: RatingSummary;
};

/**
 * How long a pause in typing counts as "done", for the purpose of writing the
 * search term into the URL. Short enough that copying the link straight after
 * typing still captures the search.
 */
const QUERY_WRITE_DELAY = 250;

export default function ListingsBrowser({ listings }: { listings: Listing[] }) {
  const searchParams = useSearchParams();
  const urlFilters = parseFilters(searchParams);
  const urlKey = searchParams.toString();

  // The search box is the one control that does not read its value straight
  // from the URL: a controlled input waiting on a router-synced write per
  // keystroke is where cursor jumps come from. It filters from local state
  // immediately and the URL catches up on the pause below.
  const [queryDraft, setQueryDraft] = useState(urlFilters.query);
  const filters: ListingFilters = { ...urlFilters, query: queryDraft };

  /**
   * Filter changes go through the History API rather than the router. The
   * client already holds every listing, so filtering is local — a router
   * navigation would re-run the page on the server, re-querying the database
   * and recording a second page hit, for a result the browser can compute.
   * Next syncs these calls into useSearchParams, so the URL stays the state.
   */
  function write(next: ListingFilters) {
    const qs = serialiseFilters(next);
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }

  function setFilter(patch: Partial<ListingFilters>) {
    write({ ...filters, ...patch });
  }

  useEffect(() => {
    if (queryDraft === urlFilters.query) return;
    const timer = setTimeout(
      () => write({ ...urlFilters, query: queryDraft }),
      QUERY_WRITE_DELAY
    );
    return () => clearTimeout(timer);
    // urlKey re-arms the timer whenever another control writes the URL, so a
    // pending search write cannot land on top of a category picked meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft, urlFilters.query, urlKey]);

  function clearFilters() {
    setQueryDraft('');
    write(NO_FILTERS);
  }

  if (listings.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)' }}>
        The chest is empty. Add listings from the admin page.
      </p>
    );
  }

  const counts = countByCategory(listings, filters);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  // Tabs come from the whole catalogue, not from the filtered set. A tab that
  // disappears because of an unrelated filter takes away the control you would
  // use to get back, so empty ones stay put and show a zero instead.
  const tabs = CATEGORIES.filter((c) => listings.some((l) => l.category === c.key));

  const visible = sortListings(filterListings(listings, filters), filters.sort);

  // "All" groups by category so the catalogue still reads as a structured shelf;
  // a chosen category is one flat grid, where a heading would only repeat the tab.
  const groups =
    filters.category === ANY
      ? tabs
          .map((c) => ({
            key: c.key,
            label: c.label,
            items: visible.filter((l) => l.category === c.key),
          }))
          .filter((g) => g.items.length > 0)
      : [{ key: filters.category, label: categoryLabel(filters.category), items: visible }];

  return (
    <div>
      <div className="filter-tabs">
        <button
          type="button"
          className={`filter-tab ${filters.category === ANY ? 'filter-tab-active' : ''}`}
          style={{ '--rarity': 'var(--gold)' } as CSSProperties}
          aria-pressed={filters.category === ANY}
          onClick={() => setFilter({ category: ANY })}
        >
          All <span className="filter-tab-count">{total}</span>
        </button>
        {tabs.map((c) => {
          const count = counts[c.key] ?? 0;
          return (
            <button
              key={c.key}
              type="button"
              className={`filter-tab ${filters.category === c.key ? 'filter-tab-active' : ''} ${
                count === 0 ? 'filter-tab-empty' : ''
              }`}
              style={{ '--rarity': c.color } as CSSProperties}
              aria-pressed={filters.category === c.key}
              onClick={() => setFilter({ category: c.key })}
            >
              {c.label} <span className="filter-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="table-toolbar">
        <input
          type="search"
          className="form-input toolbar-search"
          placeholder="Search name, developer, or what it does…"
          value={queryDraft}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(e) => setQueryDraft(e.target.value)}
          aria-label="Search listings"
        />

        <select
          className="form-input toolbar-select"
          value={filters.pricing}
          onChange={(e) => setFilter({ pricing: e.target.value })}
          aria-label="Filter by pricing"
        >
          <option value={ANY}>Any pricing</option>
          {PRICING.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>

        <select
          className="form-input toolbar-select"
          value={filters.sort}
          onChange={(e) => setFilter({ sort: e.target.value as ListingFilters['sort'] })}
          aria-label="Sort listings"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <label className="form-checkbox toolbar-check">
          <input
            type="checkbox"
            checked={filters.trusted}
            onChange={(e) => setFilter({ trusted: e.target.checked })}
          />
          Trusted only
        </label>

        {hasActiveFilters(filters) && (
          <button type="button" className="table-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          Nothing matches those filters.{' '}
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear them
          </button>{' '}
          to see the whole catalogue.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} style={{ marginBottom: '3.5rem' }}>
            {filters.category === ANY && (
              <h2
                className="pixel"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  margin: '0 0 1.25rem',
                  color: categoryColor(group.key),
                }}
              >
                {group.label}
              </h2>
            )}
            <div className="mod-grid">
              {group.items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const rarity = categoryColor(listing.category);

  return (
    <div className="tooltip-card" style={{ '--rarity': rarity } as CSSProperties}>
      <div className="tooltip-head">
        <div>
          <Link href={`/listings/${listing.id}`} className="tooltip-name tooltip-name-link">
            {listing.name}
          </Link>
          {listing.developer && <div className="tooltip-dev">by {listing.developer}</div>}
        </div>
        <span className={`trust ${listing.isTrusted ? 'trust-yes' : 'trust-no'}`}>
          {listing.isTrusted ? '✓ Trusted' : 'Unverified'}
        </span>
      </div>

      <div className="tooltip-lore">{listing.description}</div>

      <div className="tooltip-category">
        {categoryLabel(listing.category)}
        {/* Short form on cards: "Paid · 5€/mo" has to sit on one line next to the
            rarity, where the full "Free + paid tiers" would wrap. */}
        {pricingBadge(listing.pricing, listing.price, 'short') && (
          <span
            className="price-tag"
            style={{ '--price': pricingColor(listing.pricing) } as CSSProperties}
          >
            {pricingBadge(listing.pricing, listing.price, 'short')}
          </span>
        )}
      </div>

      <Link href={`/listings/${listing.id}`} className="rating-line rating-line-link">
        <span className="rating-stars" style={{ color: ratingColor(listing.rating.average) }}>
          {stars(listing.rating.average)}
        </span>
        <span className="rating-meta">
          {listing.rating.count === 0
            ? 'No reviews — add one'
            : `${listing.rating.average?.toFixed(1)} · ${listing.rating.count} ${
                listing.rating.count === 1 ? 'review' : 'reviews'
              }`}
        </span>
      </Link>

      {/* Through /go/<id> so the click is counted; the label still comes from
          the real URL, so hovering and reading the button is unchanged. */}
      <div className="tooltip-links">
        <a href={`/go/${listing.id}`} target="_blank" rel="noreferrer" className="btn btn-primary">
          {linkLabelFor(listing.url, listing.urlLabel)}
        </a>
        {listing.secondaryUrl && (
          <a
            href={`/go/${listing.id}?to=secondary`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            {linkLabelFor(listing.secondaryUrl, listing.secondaryUrlLabel)}
          </a>
        )}
      </div>
    </div>
  );
}
