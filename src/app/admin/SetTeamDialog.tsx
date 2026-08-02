'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useControlledDialog } from './useControlledDialog';
import { setListingTeam, type SetTeamState } from './team-actions';

export type TeamOption = { id: string; name: string; memberCount: number };

/**
 * Assigns a listing to a development team.
 *
 * Its own dialog rather than a field on the edit form: this is the step where an
 * admin vouches that the people on the other end really are the developers, and
 * it should not be something you change by accident while fixing a typo in a
 * description.
 *
 * A picker rather than a username box — teams are created deliberately, and
 * choosing from what exists makes it obvious when the right one does not.
 */
export default function SetTeamDialog({
  listingId,
  listingName,
  teamId,
  teams,
  openToken,
  onClose,
}: {
  listingId: string;
  listingName: string;
  teamId: string | null;
  teams: TeamOption[];
  openToken: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useControlledDialog(openToken, onClose);
  const [state, action, pending] = useActionState<SetTeamState, FormData>(
    setListingTeam,
    undefined
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, router, onClose]);

  return (
    <dialog ref={dialogRef} className="modal">
      <form action={action} className="modal-body">
        <h3 className="pixel modal-title">Development team</h3>
        <p className="modal-sub">
          The team that can post announcements on <strong>{listingName}</strong> and
          propose edits to it. Verify over Discord that they really are the developers
          before assigning this — nothing here checks that for you.
        </p>

        {state?.message && (
          <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
            {state.message}
          </div>
        )}

        <input type="hidden" name="listingId" value={listingId} />

        <div className="form-group">
          <label className="form-label" htmlFor={`team-${listingId}`}>Team</label>
          <select
            id={`team-${listingId}`}
            name="teamId"
            className="form-input"
            defaultValue={teamId ?? ''}
          >
            <option value="">Nobody — unclaimed</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.memberCount}{' '}
                {team.memberCount === 1 ? 'member' : 'members'})
              </option>
            ))}
          </select>
          <p className="form-hint">
            Teams are created on the Teams tab. Assigning one here does not change who
            is on it.
          </p>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
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
