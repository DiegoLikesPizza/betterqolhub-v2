'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTeam,
  addTeamMember,
  removeTeamMember,
  setTeamMemberRole,
  deleteTeam,
  renameTeam,
  type TeamState,
  type MemberState,
} from './team-actions';
import { TEAM_ROLES, MAX_TEAM_NAME_LENGTH } from '@/lib/teams';
import type { TeamRow } from '@/lib/team-queries';

export default function TeamsPanel({ teams }: { teams: TeamRow[] }) {
  return (
    <div className="teams-panel">
      {teams.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          No teams yet. Create one, then assign it to a listing from the Listings tab.
        </p>
      ) : (
        teams.map((team) => <TeamCard key={team.id} team={team} />)
      )}
    </div>
  );
}

export function AddTeamDialog() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<TeamState, FormData>(createTeam, undefined);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => dialogRef.current?.showModal()}
      >
        + New team
      </button>

      <dialog ref={dialogRef} className="modal">
        <form ref={formRef} action={action} className="modal-body">
          <h3 className="pixel modal-title">New team</h3>
          <p className="modal-sub">
            A team is who may speak for a listing. Verify over Discord that these are
            really the developers before you assign them anything — nothing here checks
            that for you.
          </p>

          {state?.message && !state.ok && (
            <div className="form-alert form-alert-error">{state.message}</div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="team-name">Team name</label>
            <input
              id="team-name"
              name="name"
              type="text"
              className="form-input"
              maxLength={MAX_TEAM_NAME_LENGTH}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="team-lead">
              Lead{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                (optional)
              </span>
            </label>
            <input
              id="team-lead"
              name="leadUsername"
              type="text"
              className="form-input"
              placeholder="Username"
              autoComplete="off"
            />
            <p className="form-hint">
              Must have linked their Discord, the same bar reviews already clear. The
              lead can add the rest of the team themselves.
            </p>
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
              {pending ? 'Creating…' : 'Create team'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function TeamCard({ team }: { team: TeamRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const renameRef = useRef<HTMLDialogElement>(null);

  function run(fn: () => Promise<TeamState | void>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result && result.ok === false) setError(result.message ?? 'Action failed.');
        else router.refresh();
      } catch {
        setError('Action failed.');
      }
    });
  }

  return (
    <section className="team-card">
      <header className="team-head">
        <div>
          <h3 className="pixel team-title">{team.name}</h3>
          <p className="table-muted">
            {team.members.length} {team.members.length === 1 ? 'member' : 'members'} ·{' '}
            {team.listings.length === 0
              ? 'no listings'
              : team.listings.map((l) => l.name).join(', ')}
          </p>
        </div>

        <div className="team-actions">
          <button
            type="button"
            className="table-btn"
            onClick={() => renameRef.current?.showModal()}
          >
            Rename
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                className="table-btn table-btn-danger"
                disabled={pending}
                onClick={() => run(() => deleteTeam(team.id))}
              >
                {pending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button type="button" className="table-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="table-btn table-btn-danger"
              disabled={pending}
              onClick={() => setConfirming(true)}
              title="Listings stay up — they just become unclaimed"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      {error && <div className="form-alert form-alert-error">{error}</div>}

      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Discord</th>
              <th>Role</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((member) => (
              <tr key={member.userId}>
                <td>{member.username}</td>
                <td className="table-muted">{member.discordUsername ?? '—'}</td>
                <td>
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
                </td>
                <td className="col-actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="table-btn table-btn-danger"
                      disabled={pending}
                      onClick={() => run(() => removeTeamMember(team.id, member.userId))}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {team.members.length === 0 && (
              <tr>
                <td colSpan={4} className="table-muted">
                  Nobody on this team yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddMemberForm teamId={team.id} />

      {team.listings.length > 0 && (
        <p className="table-muted">
          Speaks for:{' '}
          {team.listings.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ', '}
              <Link href={`/listings/${l.id}`} className="table-link">
                {l.name}
              </Link>
            </span>
          ))}
        </p>
      )}

      <RenameTeamDialog dialogRef={renameRef} team={team} />
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
        placeholder="Add a member by username…"
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

function RenameTeamDialog({
  dialogRef,
  team,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  team: TeamRow;
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
          <label className="form-label" htmlFor={`rename-${team.id}`}>Team name</label>
          <input
            id={`rename-${team.id}`}
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
