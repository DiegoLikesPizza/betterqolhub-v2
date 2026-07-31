import { currentUser } from '@/lib/authz';
import { getAdminMembers } from '../../queries';
import MembersTable from '../../MembersTable';

export const revalidate = 0;

export default async function AdminMembersPage() {
  // The layout already guarantees an admin; this is only for viewerId, which the
  // table uses to stop you removing your own admin access.
  const [user, members] = await Promise.all([currentUser(), getAdminMembers()]);

  return (
    <section className="admin-section">
      <h2 className="admin-section-title">Members</h2>
      <MembersTable
        members={members.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          discordLinkedAt: m.discordLinkedAt ? m.discordLinkedAt.toISOString() : null,
        }))}
        viewerId={user?.id ?? ''}
      />
    </section>
  );
}
