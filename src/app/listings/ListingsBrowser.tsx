'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  CATEGORIES,
  categoryLabel,
  categoryColor,
  linkLabel,
} from '@/lib/categories';
import { stars, ratingColor, type RatingSummary } from '@/lib/reviews';
import { pricingBadge, pricingColor } from '@/lib/pricing';

type Listing = {
  id: string;
  name: string;
  description: string;
  category: string;
  developer: string | null;
  url: string;
  secondaryUrl: string | null;
  isTrusted: boolean;
  pricing: string | null;
  price: string | null;
  rating: RatingSummary;
};

export default function ListingsBrowser({ listings }: { listings: Listing[] }) {
  const [active, setActive] = useState<string>('ALL');

  // Only show tabs for categories that actually have listings.
  const availableCategories = CATEGORIES.filter((c) =>
    listings.some((l) => l.category === c.key)
  );

  const visible = active === 'ALL' ? listings : listings.filter((l) => l.category === active);

  if (listings.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)' }}>
        The chest is empty. Add listings from the admin page.
      </p>
    );
  }

  // "All" groups by category; a specific tab shows one flat grid.
  const groups =
    active === 'ALL'
      ? availableCategories.map((c) => ({
          key: c.key,
          label: c.label,
          items: listings.filter((l) => l.category === c.key),
        }))
      : [{ key: active, label: categoryLabel(active), items: visible }];

  return (
    <div>
      <div className="filter-tabs">
        <button
          className={`filter-tab ${active === 'ALL' ? 'filter-tab-active' : ''}`}
          style={{ '--rarity': 'var(--gold)' } as CSSProperties}
          onClick={() => setActive('ALL')}
        >
          All
        </button>
        {availableCategories.map((c) => (
          <button
            key={c.key}
            className={`filter-tab ${active === c.key ? 'filter-tab-active' : ''}`}
            style={{ '--rarity': c.color } as CSSProperties}
            onClick={() => setActive(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.key} style={{ marginBottom: '3.5rem' }}>
          {active === 'ALL' && (
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
      ))}
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
          {linkLabel(listing.url)}
        </a>
        {listing.secondaryUrl && (
          <a
            href={`/go/${listing.id}?to=secondary`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            {linkLabel(listing.secondaryUrl)}
          </a>
        )}
      </div>
    </div>
  );
}
