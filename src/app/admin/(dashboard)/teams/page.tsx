import { getTeams, getChangeRequests } from '@/lib/team-queries';
import TeamsPanel, { AddTeamDialog } from '../../TeamsPanel';
import ChangeRequestQueue from '../../ChangeRequestQueue';

export const revalidate = 0;

export default async function AdminTeamsPage() {
  const [teams, requests] = await Promise.all([getTeams(), getChangeRequests()]);
  const pending = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <>
      {/* The queue sits above the teams themselves: it is the part with work
          waiting in it, and a team list nobody has to act on should not be what
          you scroll past to find it. */}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="admin-section-title">
            Proposed changes{pending > 0 && <span className="cr-badge">{pending}</span>}
          </h2>
        </div>
        <ChangeRequestQueue requests={requests} />
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="admin-section-title">Teams</h2>
          <AddTeamDialog />
        </div>
        <TeamsPanel teams={teams} />
      </section>
    </>
  );
}
