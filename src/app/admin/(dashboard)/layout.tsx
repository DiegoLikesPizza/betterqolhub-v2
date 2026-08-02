import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/authz';
import { logout } from '../actions';
import AdminTabs from '../AdminTabs';
import { countPendingChangeRequests } from '@/lib/team-queries';

// A route group, so /admin/login — which is only a redirect for old bookmarks —
// stays outside this layout and does not get wrapped in dashboard chrome or run
// the admin check.

export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  // Proxy only knows that *some* session cookie exists; this is the check that
  // actually keeps members out. It lives here so every admin page inherits it
  // and none can be added later that forgets it.
  if (!user) redirect('/login?callbackUrl=/admin');
  if (user.role !== 'ADMIN') redirect('/');

  // One COUNT, after the admin check so it never runs for a visitor. In the
  // layout rather than on the Teams page because the whole point is to be
  // visible from the other tabs.
  const pendingChanges = await countPendingChangeRequests();

  return (
    <div className="container admin-page">
      <header className="admin-header">
        <div>
          <h1 className="pixel page-title">Dashboard</h1>
          <p className="page-sub">Signed in as {user.name}.</p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn btn-secondary">Log out</button>
        </form>
      </header>

      <AdminTabs pendingChanges={pendingChanges} />

      {children}
    </div>
  );
}
