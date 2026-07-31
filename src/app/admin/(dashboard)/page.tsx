import Link from 'next/link';
import { categoryLabel } from '@/lib/categories';
import { stars, ratingColor } from '@/lib/reviews';
import { getOverviewData } from '../queries';
import StatTile from '../StatTile';
import CategoryBars from '../CategoryBars';

export const revalidate = 0;

export default async function AdminOverviewPage() {
  const { totals, categoryBreakdown, needsAttention } = await getOverviewData();

  return (
    <>
      <section className="stat-row">
        <StatTile label="Listings" value={totals.listings} />
        <StatTile label="Members" value={totals.members} hint={`${totals.admins} admin`} />
        <StatTile label="Reviews" value={totals.reviews} />
        <StatTile
          label="Average rating"
          value={totals.averageRating === null ? '—' : totals.averageRating.toFixed(1)}
          hint={totals.averageRating === null ? 'No reviews yet' : 'across all listings'}
        />
      </section>

      {needsAttention.length > 0 && (
        <section className="admin-section">
          <h2 className="admin-section-title">Needs attention</h2>
          <p className="admin-section-sub">
            Entries the community rates below 3 stars, plus anything still unverified.
          </p>
          <ul className="attention-list">
            {needsAttention.map((listing) => (
              <li key={listing.id} className="attention-item">
                <Link href={`/listings/${listing.id}`} className="attention-name">
                  {listing.name}
                </Link>
                <span className="attention-meta">{categoryLabel(listing.category)}</span>
                {listing.rating.count > 0 && (
                  <span style={{ color: ratingColor(listing.rating.average) }}>
                    {stars(listing.rating.average)} {listing.rating.average?.toFixed(1)}
                  </span>
                )}
                {!listing.isTrusted && <span className="trust trust-no">Unverified</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="admin-section">
        <h2 className="admin-section-title">Listings by category</h2>
        <CategoryBars
          data={categoryBreakdown}
          totalListings={totals.listings}
          unreviewed={totals.unreviewed}
        />
      </section>
    </>
  );
}
