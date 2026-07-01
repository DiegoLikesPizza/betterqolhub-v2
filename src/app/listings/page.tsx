import { prisma } from '@/lib/prisma';
import ListingsBrowser from './ListingsBrowser';

export const revalidate = 0;

export default async function ListingsPage() {
  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
  });

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

      <ListingsBrowser listings={listings} />
    </div>
  );
}
