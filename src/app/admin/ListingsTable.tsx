'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { deleteListing, setListingTrust } from './actions';
import { CATEGORIES, categoryLabel } from '@/lib/categories';
import { stars, ratingColor, type RatingSummary } from '@/lib/reviews';
import {
  PRICING,
  pricingShort,
  pricingColor,
  categoryHasPricing,
  pricingHasPrice,
} from '@/lib/pricing';
import EditListingDialog from './EditListingDialog';
import SetTeamDialog, { type TeamOption } from './SetTeamDialog';
import UnlistDialog from './UnlistDialog';
import RowMenu from './RowMenu';
import Pager, { pageSlice, pageCount } from './Pager';

type Row = {
  id: string;
  name: string;
  category: string;
  isTrusted: boolean;
  createdAt: string;
  rating: RatingSummary;
  description: string;
  developer: string | null;
  url: string;
  secondaryUrl: string | null;
  urlLabel: string | null;
  secondaryUrlLabel: string | null;
  features: string | null;
  pricing: string | null;
  price: string | null;
  teamId: string | null;
  teamName: string | null;
  unlistedAt: string | null;
  unlistedReason: string | null;
};

/**
 * Pricing filter values that are not a Pricing key — they ask a question about
 * completeness rather than matching a state, so they are handled separately.
 */
const PRICING_FILTER_SPECIALS = new Set(['ALL', 'UNSET', 'NO_PRICE']);

type DialogKind = 'edit' | 'team' | 'unlist';

type SortKey = 'newest' | 'oldest' | 'name' | 'rating-desc' | 'rating-asc' | 'reviews';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'rating-desc', label: 'Highest rated' },
  { key: 'rating-asc', label: 'Lowest rated' },
  { key: 'reviews', label: 'Most reviewed' },
];

export default function ListingsTable({
  listings,
  teams,
}: {
  listings: Row[];
  teams: TeamOption[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [pricing, setPricing] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = listings.filter((l) => {
      if (category !== 'ALL' && l.category !== category) return false;
      if (status === 'TRUSTED' && !l.isTrusted) return false;
      if (status === 'UNVERIFIED' && l.isTrusted) return false;
      if (status === 'UNREVIEWED' && l.rating.count > 0) return false;
      // "Not specified" means *needs* a value — categories where pricing never
      // applies are excluded, so the filter is a to-do list rather than noise.
      if (pricing === 'UNSET' && (l.pricing || !categoryHasPricing(l.category))) return false;
      // Same, one level down: paid listings whose price nobody has filled in.
      if (pricing === 'NO_PRICE' && (l.price || !pricingHasPrice(l.pricing))) return false;
      if (!PRICING_FILTER_SPECIALS.has(pricing) && l.pricing !== pricing) return false;
      if (!q) return true;
      // Developer is searchable too — it is often how you remember a listing.
      return (
        l.name.toLowerCase().includes(q) ||
        (l.developer ?? '').toLowerCase().includes(q)
      );
    });

    // Unrated listings sort last in both rating directions: they are "no data",
    // not "zero stars", and burying them under 1-star entries would be a lie.
    const rank = (r: RatingSummary, worst: boolean) =>
      r.average === null ? (worst ? -Infinity : Infinity) : r.average;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.createdAt.localeCompare(b.createdAt);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating-desc':
          return rank(b.rating, true) - rank(a.rating, true);
        case 'rating-asc':
          return rank(a.rating, false) - rank(b.rating, false);
        case 'reviews':
          return b.rating.count - a.rating.count;
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [listings, query, category, status, pricing, sort]);

  // Changing a filter can shrink the list past the current page.
  const currentPage = Math.min(page, pageCount(visible.length));
  const rows = pageSlice(visible, currentPage);

  function update<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  if (listings.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>No listings yet.</p>;
  }

  return (
    <div>
      <div className="table-toolbar">
        <input
          type="search"
          className="form-input toolbar-search"
          placeholder="Search name or developer…"
          value={query}
          onChange={(e) => update(setQuery)(e.target.value)}
          aria-label="Search listings"
        />

        <select
          className="form-input toolbar-select"
          value={category}
          onChange={(e) => update(setCategory)(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="ALL">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        <select
          className="form-input toolbar-select"
          value={status}
          onChange={(e) => update(setStatus)(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="ALL">Any status</option>
          <option value="TRUSTED">Trusted</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="UNREVIEWED">No reviews</option>
        </select>

        <select
          className="form-input toolbar-select"
          value={pricing}
          onChange={(e) => update(setPricing)(e.target.value)}
          aria-label="Filter by pricing"
        >
          <option value="ALL">Any pricing</option>
          {PRICING.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
          <option value="UNSET">Not specified</option>
          <option value="NO_PRICE">Paid, no price set</option>
        </select>

        <select
          className="form-input toolbar-select"
          value={sort}
          onChange={(e) => update(setSort as (v: string) => void)(e.target.value)}
          aria-label="Sort listings"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          No listings match those filters.
        </p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Pricing</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((listing) => (
                  <ListingRow key={listing.id} listing={listing} teams={teams} />
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={currentPage} total={visible.length} onPage={setPage} noun="listing" />
        </>
      )}
    </div>
  );
}

function ListingRow({ listing, teams }: { listing: Row; teams: TeamOption[] }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which dialog the row's menu opened, if any. Held here rather than in the
  // dialogs so they survive the menu closing. The counter makes every request a
  // new value — see useControlledDialog for why a boolean is not enough.
  const [dialog, setDialog] = useState<{ kind: DialogKind; n: number } | null>(null);
  const openDialog = useCallback(
    (kind: DialogKind) => setDialog((d) => ({ kind, n: (d?.n ?? 0) + 1 })),
    []
  );
  const closeDialog = useCallback(() => setDialog(null), []);
  const tokenFor = (kind: DialogKind) => (dialog?.kind === kind ? dialog.n : null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        setError('Action failed.');
      }
    });
  }

  return (
    <tr>
      <td>
        <Link href={`/listings/${listing.id}`} className="table-link">{listing.name}</Link>
        {listing.developer && <div className="table-muted">by {listing.developer}</div>}
        {error && <div className="table-error">{error}</div>}
      </td>
      <td>{categoryLabel(listing.category)}</td>
      <td>
        {listing.pricing ? (
          <>
            <span style={{ color: pricingColor(listing.pricing) }}>
              {pricingShort(listing.pricing)}
            </span>
            {/* A paid listing with no price is the gap this column now surfaces,
                so say so rather than leaving the cell looking complete. */}
            {listing.price ? (
              <div className="table-muted">{listing.price}</div>
            ) : pricingHasPrice(listing.pricing) ? (
              <div className="table-muted">no price set</div>
            ) : null}
          </>
        ) : categoryHasPricing(listing.category) ? (
          // Applicable but not filled in yet — actionable.
          <span style={{ color: 'var(--text-secondary)' }}>—</span>
        ) : (
          // Never applicable for this category, so not a gap to chase.
          <span className="table-muted" title="Pricing does not apply to this category">n/a</span>
        )}
      </td>
      <td>
        {listing.rating.count === 0 ? (
          <span style={{ color: 'var(--text-secondary)' }}>—</span>
        ) : (
          <span style={{ color: ratingColor(listing.rating.average) }}>
            {stars(listing.rating.average)}{' '}
            <span className="table-muted">({listing.rating.count})</span>
          </span>
        )}
      </td>
      <td>
        <span className={`trust ${listing.isTrusted ? 'trust-yes' : 'trust-no'}`}>
          {listing.isTrusted ? '✓ Trusted' : 'Unverified'}
        </span>
      </td>
      <td className="col-actions">
        {/* The flex row lives here rather than on the cell: `display: flex` on a
            <td> stops it being a table-cell, so it no longer stretches to the
            row height and vertical-align is ignored — which left the button
            pinned to the top of every taller row. */}
        <div className="row-actions">
        {/* Delete keeps its two-step guard in the open rather than inside the
            menu: a destructive confirm that appears where the menu just was,
            under the cursor, is how people delete the wrong row. */}
        {confirming ? (
          <>
            <button
              type="button"
              className="table-btn table-btn-danger"
              disabled={pending}
              onClick={() => run(() => deleteListing(listing.id))}
            >
              {pending ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button type="button" className="table-btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <RowMenu
            label={`Actions for ${listing.name}`}
            items={[
              { label: 'Edit', onSelect: () => openDialog('edit') },
              {
                label: listing.teamName ? `Team: ${listing.teamName}` : 'Assign team',
                onSelect: () => openDialog('team'),
              },
              {
                label: listing.unlistedAt ? 'Unlisted — put back' : 'Unlist',
                onSelect: () => openDialog('unlist'),
              },
              {
                label: listing.isTrusted ? 'Mark unverified' : 'Mark trusted',
                disabled: pending,
                onSelect: () => run(() => setListingTrust(listing.id, !listing.isTrusted)),
              },
              {
                label: 'Delete',
                danger: true,
                disabled: pending,
                onSelect: () => setConfirming(true),
              },
            ]}
          />
        )}
        </div>

        {/* Outside the menu on purpose — see RowMenu. */}
        <EditListingDialog
          listing={listing}
          openToken={tokenFor('edit')}
          onClose={closeDialog}
        />
        <SetTeamDialog
          listingId={listing.id}
          listingName={listing.name}
          teamId={listing.teamId}
          teams={teams}
          openToken={tokenFor('team')}
          onClose={closeDialog}
        />
        <UnlistDialog
          listingId={listing.id}
          listingName={listing.name}
          unlisted={listing.unlistedAt !== null}
          reason={listing.unlistedReason}
          openToken={tokenFor('unlist')}
          onClose={closeDialog}
        />
      </td>
    </tr>
  );
}
