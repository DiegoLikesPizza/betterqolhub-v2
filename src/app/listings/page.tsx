import { Suspense } from 'react';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { summarise } from '@/lib/reviews';
import { recordPageHitFor, PAGE_KEYS } from '@/lib/stats';
import { categoryLabel, isCategoryKey } from '@/lib/categories';
import { SITE_DESCRIPTION } from '@/lib/site';
import { parseFilters, PARAM } from '@/lib/listing-filters';
import ListingsBrowser from './ListingsBrowser';

export const revalidate = 0;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Metadata follows the category filter.
 *
 * A `?category=LEGIT_MOD` link posted into a legit-mod community should
 * announce itself as that catalogue rather than as the whole site — the
 * filtered view is the thing being shared, so it is the thing the embed and the
 * search result should describe. Only category is reflected: a search term or a
 * sort order is one reader's session, not a page worth indexing separately.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { category } = parseFilters(await searchParams);

  if (!isCategoryKey(category)) {
    return { title: 'Listings', description: SITE_DESCRIPTION };
  }

  const label = categoryLabel(category);
  const description = `Community-vetted ${label.toLowerCase()} for Hypixel Skyblock. Every listing checked before it lands.`;

  return {
    title: label,
    description,
    // Points the unfiltered and filtered URLs at distinct canonicals, so the
    // category views can rank on their own instead of competing with /listings.
    alternates: { canonical: `/listings?${PARAM.category}=${category}` },
    openGraph: { title: label, description },
  };
}

export default async function ListingsPage() {
  await recordPageHitFor(PAGE_KEYS.listings, (await headers()).get('user-agent'));

  const listings = await prisma.listing.findMany({
    // Unlisted entries are pulled while something is looked into — the whole
    // point is that the hub stops surfacing them, so they leave the catalogue
    // entirely rather than appearing with a warning.
    where: { unlistedAt: null },
    orderBy: { createdAt: 'desc' },
    // Only the ratings are needed for the grid; review bodies are loaded on the
    // detail page.
    include: { reviews: { select: { rating: true } } },
  });

  // Filtering happens in the browser against the whole catalogue, so the page
  // is fetched once and every later filter change is instant. createdAt comes
  // along as an ISO string because "newest first" is now a client-side sort.
  const withRatings = listings.map(({ reviews, createdAt, ...listing }) => ({
    ...listing,
    createdAt: createdAt.toISOString(),
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

      {/* The browser reads its state from the URL. This page is dynamic, so
          useSearchParams resolves during the server render, but the boundary is
          what keeps a future static build from failing on it. */}
      <Suspense fallback={null}>
        <ListingsBrowser listings={withRatings} />
      </Suspense>
    </div>
  );
}
