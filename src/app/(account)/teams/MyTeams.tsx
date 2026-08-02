'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addTeamMember,
  removeTeamMember,
  setTeamMemberRole,
  renameTeam,
  leaveTeam,
  type TeamState,
  type MemberState,
} from '@/app/admin/team-actions';
import { TEAM_ROLES, MAX_TEAM_NAME_LENGTH, teamRoleLabel } from '@/lib/teams';
import type { TeamRow, ChangeRequestRow } from '@/lib/team-queries';

export type MyTeam = TeamRow & {
  /** The viewer's own role on this team. */
  viewerRole: string;
  proposals: ChangeRequestRow[];
};

export default function MyTeams({ teams, viewerId }: { teams: MyTeam[]; viewerId: string }) {
  return (
    <div className="teams-panel">
      {teams.map((team) => (
        <TeamCard key={team.id} team={team} viewerId={viewerId} />
      ))}
    </div>
  );
}

function TeamCard({ team, viewerId }: { team: MyTeam; viewerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const renameRef = useRef<HTMLDialogElement>(null);

  const isLead = team.viewerRole === 'LEAD';
  const openProposals = team.proposals.filter((p) => p.status === 'PENDING');

  function run(fn: () => Promise<TeamState | void>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result && result.ok === false) setError(result.message ?? 'That did not work.');
        else router.refresh();
      } catch {
        setError('That did not work.');
      }
    });
  }

  return (
    <section className="team-card">
      <header className="team-head">
        <div>
          <h2 className="pixel team-title">{team.name}</h2>
          <p className="table-muted">
            You are {isLead ? 'a lead' : 'a developer'} here ·{' '}
            {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        <div className="team-actions">
          {isLead && (
            <button
              type="button"
              className="table-btn"
              onClick={() => renameRef.current?.showModal()}
            >
              Rename
            </button>
          )}
          {leaving ? (
            <>
              <button
                type="button"
                className="table-btn table-btn-danger"
                disabled={pending}
                onClick={() => run(() => leaveTeam(team.id))}
              >
                {pending ? 'Leaving…' : 'Confirm leave'}
              </button>
              <button type="button" className="table-btn" onClick={() => setLeaving(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="table-btn table-btn-danger"
              disabled={pending}
              onClick={() => setLeaving(true)}
            >
              Leave team
            </button>
          )}
        </div>
      </header>

      {error && <div className="form-alert form-alert-error">{error}</div>}

      {team.listings.length > 0 ? (
        <div className="my-team-listings">
          <h3 className="my-team-subtitle">Listings</h3>
          <ul className="my-team-list">
            {team.listings.map((listing) => {
              const proposal = openProposals.find((p) => p.listingId === listing.id);
              return (
                <li key={listing.id}>
                  <Link href={`/listings/${listing.id}`} className="table-link">
                    {listing.name}
                  </Link>
                  {proposal && (
                    <span className="my-team-flag" title="Waiting for an admin to review">
                      {proposal.diffs.filter((d) => d.changed).length} change
                      {proposal.diffs.filter((d) => d.changed).length === 1 ? '' : 's'} awaiting
                      review
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="table-muted">
          This team does not speak for any listing yet. An admin assigns those.
        </p>
      )}

      {/* Rejections are the one thing a team has to act on, and the listing page
          only shows the most recent one per listing. */}
      {team.proposals.some((p) => p.status === 'REJECTED') && (
        <details className="cr-history">
          <summary className="pack-mods-summary">Past proposals</summary>
          <div className="cr-history-body">
            {team.proposals
              .filter((p) => p.status !== 'PENDING')
              .map((p) => (
                <div key={p.id} className="cr-decided">
                  <span
                    className={`pack-state ${p.status === 'APPROVED' ? 'pack-live' : 'pack-draft'}`}
                  >
                    {p.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                  </span>
                  <span>{p.listingName}</span>
                  <span className="table-muted">
                    by {p.authorUsername}
                    {p.reviewedAt && ` · ${new Date(p.reviewedAt).toLocaleDateString()}`}
                  </span>
                  {p.decisionNote && <span className="cr-note-inline">“{p.decisionNote}”</span>}
                </div>
              ))}
          </div>
        </details>
      )}

      <h3 className="my-team-subtitle">Members</h3>
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Discord</th>
              <th>Role</th>
              {isLead && <th className="col-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {team.members.map((member) => (
              <tr key={member.userId}>
                <td>
                  {member.username}
                  {member.userId === viewerId && <span className="table-muted"> (you)</span>}
                </td>
                <td className="table-muted">{member.discordUsername ?? '—'}</td>
                <td>
                  {isLead ? (
                    <select
                      className="form-input mods-select"
                      value={member.role}
                      disabled={pending}
                      aria-label={`Role of ${member.username}`}
                      onChange={(e) =>
                        run(() => setTeamMemberRole(team.id, member.userId, e.target.value))
                      }
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role.key} value={role.key}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    teamRoleLabel(member.role)
                  )}
                </td>
                {isLead && (
                  <td className="col-actions">
                    {member.userId === viewerId ? (
                      <span className="table-muted">—</span>
                    ) : (
                      <button
                        type="button"
                        className="table-btn table-btn-danger"
                        disabled={pending}
                        onClick={() => run(() => removeTeamMember(team.id, member.userId))}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLead && <AddMemberForm teamId={team.id} />}

      {isLead && <RenameDialog dialogRef={renameRef} team={team} />}
    </section>
  );
}

function AddMemberForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<MemberState, FormData>(
    addTeamMember,
    undefined
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="team-add-form">
      <input type="hidden" name="teamId" value={teamId} />
      <input
        name="username"
        type="text"
        className="form-input"
        placeholder="Add a teammate by their site username…"
        aria-label="Username to add"
        autoComplete="off"
        required
      />
      <select name="role" className="form-input mods-select" defaultValue="MEMBER" aria-label="Role">
        {TEAM_ROLES.map((role) => (
          <option key={role.key} value={role.key}>
            {role.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-secondary" disabled={pending}>
        {pending ? 'Adding…' : 'Add'}
      </button>

      {state?.message && (
        <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
          {state.message}
        </div>
      )}
    </form>
  );
}

function RenameDialog({
  dialogRef,
  team,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  team: MyTeam;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<TeamState, FormData>(renameTeam, undefined);

  useEffect(() => {
    if (state?.ok) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router, dialogRef]);

  return (
    <dialog ref={dialogRef} className="modal">
      <form action={action} className="modal-body">
        <h3 className="pixel modal-title">Rename team</h3>
        {state?.message && !state.ok && (
          <div className="form-alert form-alert-error">{state.message}</div>
        )}

        <input type="hidden" name="teamId" value={team.id} />
        <div className="form-group">
          <label className="form-label" htmlFor={`my-rename-${team.id}`}>Team name</label>
          <input
            id={`my-rename-${team.id}`}
            name="name"
            type="text"
            className="form-input"
            defaultValue={team.name}
            maxLength={MAX_TEAM_NAME_LENGTH}
            required
          />
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
