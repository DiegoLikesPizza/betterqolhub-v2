import { getAdminListings } from '../../queries';
import AddListingDialog from '../../AddListingDialog';
import ListingsTable from '../../ListingsTable';

export const revalidate = 0;

export default async function AdminListingsPage() {
  const listings = await getAdminListings();

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2 className="admin-section-title">All listings</h2>
        <AddListingDialog />
      </div>
      <ListingsTable
        listings={listings.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
      />
    </section>
  );
}
