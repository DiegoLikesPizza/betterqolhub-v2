'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveChangeRequest,
  rejectChangeRequest,
  type ChangeRequestState,
} from './change-request-actions';
import { displayValue, MAX_DECISION_NOTE_LENGTH } from '@/lib/change-requests';
import type { ChangeRequestRow } from '@/lib/team-queries';

export default function ChangeRequestQueue({ requests }: { requests: ChangeRequestRow[] }) {
  const pending = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING');

  return (
    <div className="cr-queue">
      {pending.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          Nothing waiting. Teams&rsquo; proposed edits land here.
        </p>
      ) : (
        pending.map((request) => <RequestCard key={request.id} request={request} />)
      )}

      {decided.length > 0 && (
        <details className="cr-history">
          <summary className="pack-mods-summary">Decided ({decided.length})</summary>
          <div className="cr-history-body">
            {decided.map((request) => (
              <DecidedRow key={request.id} request={request} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function RequestCard({ request }: { request: ChangeRequestRow }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [approveState, approve, approving] = useActionState<ChangeRequestState, FormData>(
    approveChangeRequest,
    undefined
  );
  const [rejectState, reject, rejecting] = useActionState<ChangeRequestState, FormData>(
    rejectChangeRequest,
    undefined
  );

  const state = approveState ?? rejectState;

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const changed = request.diffs.filter((d) => d.changed);

  return (
    <section className="cr-card">
      <header className="cr-head">
        <div>
          <h3 className="pixel cr-title">
            <Link href={`/listings/${request.listingId}`} className="table-link">
              {request.listingName}
            </Link>
          </h3>
          <p className="table-muted">
            by {request.authorUsername} · {new Date(request.createdAt).toLocaleString()} ·{' '}
            {changed.length} {changed.length === 1 ? 'field' : 'fields'} changed
          </p>
        </div>
      </header>

      {request.note && <p className="cr-note">“{request.note}”</p>}

      {state?.message && (
        <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
          {state.message}
        </div>
      )}

      {changed.length === 0 ? (
        <p className="table-muted">
          Nothing differs from the listing as it stands now — approving would change
          nothing.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="admin-table cr-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Now</th>
                <th>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {changed.map((diff) => (
                <tr key={diff.key}>
                  <td className="cr-field">{diff.label}</td>
                  <td className="cr-before">{displayValue(diff.key, diff.before)}</td>
                  <td className="cr-after">{displayValue(diff.key, diff.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* One note field feeding both buttons. On a rejection it is the feedback
          the team reads; on an approval it is just a record. */}
      <div className="form-group">
        <label className="form-label" htmlFor={`note-${request.id}`}>
          Note to the team{' '}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id={`note-${request.id}`}
          className="form-textarea"
          maxLength={MAX_DECISION_NOTE_LENGTH}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why this was rejected, or anything they should know"
        />
      </div>

      <div className="cr-actions">
        <form action={reject}>
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="decisionNote" value={note} />
          <button type="submit" className="btn btn-secondary" disabled={approving || rejecting}>
            {rejecting ? 'Rejecting…' : 'Reject'}
          </button>
        </form>

        <form action={approve}>
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="decisionNote" value={note} />
          <button type="submit" className="btn btn-primary" disabled={approving || rejecting}>
            {approving ? 'Applying…' : 'Approve & apply'}
          </button>
        </form>
      </div>
    </section>
  );
}

function DecidedRow({ request }: { request: ChangeRequestRow }) {
  const approved = request.status === 'APPROVED';
  return (
    <div className="cr-decided">
      <span className={`pack-state ${approved ? 'pack-live' : 'pack-draft'}`}>
        {approved ? 'Approved' : 'Rejected'}
      </span>
      <Link href={`/listings/${request.listingId}`} className="table-link">
        {request.listingName}
      </Link>
      <span className="table-muted">
        by {request.authorUsername}
        {request.reviewedBy && ` · decided by ${request.reviewedBy}`}
        {request.reviewedAt && ` · ${new Date(request.reviewedAt).toLocaleDateString()}`}
      </span>
      {request.decisionNote && <span className="cr-note-inline">“{request.decisionNote}”</span>}
    </div>
  );
}
