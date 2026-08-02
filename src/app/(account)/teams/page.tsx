import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/authz';
import { getTeamsForUser, getChangeRequests } from '@/lib/team-queries';
import MyTeams, { type MyTeam } from './MyTeams';

export const revalidate = 0;

// Not something to index: every visit resolves to a different, signed-in view.
export const metadata: Metadata = {
  title: 'Your teams',
  robots: { index: false, follow: false },
};

/**
 * The member-facing counterpart to the admin Teams tab.
 *
 * Leads can already manage their own membership — the server actions have
 * allowed it since teams were added — but the only screen for it lived behind
 * /admin, which is exactly where a team lead cannot go. This is that screen.
 *
 * What it deliberately does not offer: creating a team, deleting one, or
 * assigning listings. Those decide who the site vouches for, and they stay with
 * the admins.
 */
export default async function TeamsPage() {
  const user = await currentUser();
  if (!user) redirect('/login?callbackUrl=/teams');

  const teams = await getTeamsForUser(user.id);

  const listingIds = teams.flatMap((t) => t.listings.map((l) => l.id));
  const proposals = listingIds.length
    ? await getChangeRequests({ listingIds })
    : [];

  const mine: MyTeam[] = teams.map((team) => {
    const ids = new Set(team.listings.map((l) => l.id));
    return {
      ...team,
      viewerRole: team.members.find((m) => m.userId === user.id)?.role ?? 'MEMBER',
      proposals: proposals.filter((p) => ids.has(p.listingId)),
    };
  });

  return (
    <div className="container narrow-page">
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="pixel page-title">Your teams</h1>
        <p className="page-sub">
          {mine.length === 0
            ? 'You are not on a development team.'
            : 'Manage who develops with you, and see what is waiting for review.'}
        </p>
      </div>

      {mine.length === 0 ? (
        <div className="form-card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Teams are set up by an admin and assigned to a listing. If you develop
            something in the{' '}
            <Link href="/listings" style={{ color: 'var(--gold)' }}>
              catalogue
            </Link>{' '}
            and it is not claimed yet, ask an admin on Discord.
          </p>
        </div>
      ) : (
        <MyTeams teams={mine} viewerId={user.id} />
      )}
    </div>
  );
}
