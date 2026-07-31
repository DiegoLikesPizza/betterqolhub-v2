import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { summarise } from '@/lib/reviews';
import { recordPageHitFor, PAGE_KEYS } from '@/lib/stats';
import ListingsBrowser from './ListingsBrowser';

export const revalidate = 0;

export default async function ListingsPage() {
  await recordPageHitFor(PAGE_KEYS.listings, (await headers()).get('user-agent'));

  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
    // Only the ratings are needed for the grid; review bodies are loaded on the
    // detail page.
    include: { reviews: { select: { rating: true } } },
  });

  const withRatings = listings.map(({ reviews, ...listing }) => ({
    ...listing,
    rating: summarise(reviews.map((r) => r.rating)),
  }));

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="pixel" style={{ fontSize: 'clamp(2.5rem, 6vw, 3.75rem)', fontWeight: 700, marginBottom: '1rem' }}>
          Listings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
          Cheat clients, macros, legit mods, and shops — every entry vetted for the community.
        </p>
      </div>

      <ListingsBrowser listings={withRatings} />
    </div>
  );
}
