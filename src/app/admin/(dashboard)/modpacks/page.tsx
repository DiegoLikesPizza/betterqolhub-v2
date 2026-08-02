import { getAdminModpacks } from '@/lib/modpacks';
import ModpacksPanel, { AddModpackDialog } from '../../ModpacksPanel';

export const revalidate = 0;

export default async function AdminModpacksPage() {
  const packs = await getAdminModpacks();

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2 className="admin-section-title">Modpacks</h2>
        <AddModpackDialog />
      </div>
      <ModpacksPanel packs={packs} />
    </section>
  );
}
