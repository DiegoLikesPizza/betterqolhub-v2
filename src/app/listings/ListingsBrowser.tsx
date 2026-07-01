'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  CATEGORIES,
  categoryLabel,
  categoryColor,
  categoryRarity,
  linkLabel,
} from '@/lib/categories';

type Listing = {
  id: string;
  name: string;
  description: string;
  category: string;
  developer: string | null;
  url: string;
  secondaryUrl: string | null;
  isTrusted: boolean;
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
          <div className="tooltip-name">{listing.name}</div>
          {listing.developer && <div className="tooltip-dev">by {listing.developer}</div>}
        </div>
        <span className={`trust ${listing.isTrusted ? 'trust-yes' : 'trust-no'}`}>
          {listing.isTrusted ? '✓ Trusted' : 'Unverified'}
        </span>
      </div>

      <div className="tooltip-lore">{listing.description}</div>

      <div className="tooltip-rarity">
        {categoryRarity(listing.category)} · {categoryLabel(listing.category)}
      </div>

      <div className="tooltip-links">
        <a href={listing.url} target="_blank" rel="noreferrer" className="btn btn-primary">
          {linkLabel(listing.url)}
        </a>
        {listing.secondaryUrl && (
          <a href={listing.secondaryUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
            {linkLabel(listing.secondaryUrl)}
          </a>
        )}
      </div>
    </div>
  );
}
