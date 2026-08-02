import { getAdminListings } from '../../queries';
import { getTeams } from '@/lib/team-queries';
import AddListingDialog from '../../AddListingDialog';
import ListingsTable from '../../ListingsTable';

export const revalidate = 0;

export default async function AdminListingsPage() {
  const [listings, teams] = await Promise.all([getAdminListings(), getTeams()]);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2 className="admin-section-title">All listings</h2>
        <AddListingDialog />
      </div>
      <ListingsTable
        listings={listings.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
          unlistedAt: l.unlistedAt?.toISOString() ?? null,
        }))}
        teams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          memberCount: t.members.length,
        }))}
      />
    </section>
  );
}
