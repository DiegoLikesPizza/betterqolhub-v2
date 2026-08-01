'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  postAnnouncement,
  deleteAnnouncement,
  type AnnouncementFormState,
} from './actions';
import { MAX_ANNOUNCEMENT_LENGTH, ANNOUNCEMENT_RULE } from '@/lib/announcements';

export type Announcement = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

/**
 * The listing page shows the newest announcement and nothing else; the rest sit
 * behind "View all". A listing that shipped weekly for two years would otherwise
 * open with a wall of stale release notes above the thing people came to read.
 */
export default function Announcements({
  listingId,
  announcements,
  canPost,
}: {
  listingId: string;
  announcements: Announcement[];
  canPost: boolean;
}) {
  const historyRef = useRef<HTMLDialogElement>(null);
  const composerRef = useRef<HTMLDialogElement>(null);

  // The draft lives here rather than in the composer so it can be cleared when
  // the dialog opens — an event, not an effect. Remounting the composer to
  // clear it would destroy the <dialog> element showModal() was just called on,
  // and the dialog would never appear.
  const [draft, setDraft] = useState('');

  function openComposer() {
    setDraft('');
    composerRef.current?.showModal();
  }

  const [latest, ...older] = announcements;

  if (!latest && !canPost) return null;

  return (
    <section className="announce-block">
      <div className="announce-head">
        <h2 className="section-title announce-title">From the developer</h2>
        {canPost && (
          <button
            type="button"
            className="table-btn"
            onClick={openComposer}
          >
            Post announcement
          </button>
        )}
      </div>

      {latest ? (
        <>
          <AnnouncementCard announcement={latest} canDelete={canPost} />
          {older.length > 0 && (
            <button
              type="button"
              className="announce-more"
              onClick={() => historyRef.current?.showModal()}
            >
              View all announcements ({announcements.length})
            </button>
          )}
        </>
      ) : (
        <p className="announce-empty">
          Nothing posted yet. Anything you post here appears above the reviews.
        </p>
      )}

      <dialog ref={historyRef} className="modal modal-wide">
        <div className="modal-body">
          <h3 className="pixel modal-title">Announcements</h3>
          <p className="modal-sub">
            Posted by the listing&rsquo;s developer. These are their words, not a
            statement from Better QOLHub, and they do not affect the rating.
          </p>

          <div className="announce-history">
            {announcements.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} canDelete={canPost} />
            ))}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => historyRef.current?.close()}
            >
              Close
            </button>
          </div>
        </div>
      </dialog>

      {canPost && (
        <Composer
          listingId={listingId}
          dialogRef={composerRef}
          body={draft}
          onBodyChange={setDraft}
        />
      )}
    </section>
  );
}

function AnnouncementCard({
  announcement,
  canDelete,
}: {
  announcement: Announcement;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The action throws when the caller is not the owner. The button is only
  // rendered for those who are, but a stale page after ownership was revoked
  // would otherwise surface as an error boundary rather than a message.
  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAnnouncement(announcement.id);
        router.refresh();
      } catch {
        setError('Could not delete that.');
        setConfirming(false);
      }
    });
  }

  return (
    <article className="announce-card">
      <header className="announce-meta">
        <span className="announce-author">{announcement.author}</span>
        <time dateTime={announcement.createdAt}>
          {new Date(announcement.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </header>

      {/* Plain text on purpose — no markdown, no HTML. This is the one surface
          where someone outside the team writes onto a listing page. */}
      <p className="announce-body">{announcement.body}</p>

      {error && <p className="table-error">{error}</p>}

      {canDelete && (
        <div className="announce-actions">
          {confirming ? (
            <>
              <button
                type="button"
                className="table-btn table-btn-danger"
                disabled={pending}
                onClick={remove}
              >
                {pending ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                type="button"
                className="table-btn"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="table-btn table-btn-danger"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function Composer({
  listingId,
  dialogRef,
  body,
  onBodyChange,
}: {
  listingId: string;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  body: string;
  onBodyChange: (value: string) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AnnouncementFormState, FormData>(
    postAnnouncement,
    undefined
  );

  // Close and refresh only — the field is cleared when the dialog is opened.
  useEffect(() => {
    if (state?.ok) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router, dialogRef]);

  const over = body.length > MAX_ANNOUNCEMENT_LENGTH;

  return (
    <dialog ref={dialogRef} className="modal modal-wide">
      <form action={action} className="modal-body">
        <h3 className="pixel modal-title">Post an announcement</h3>
        <p className="modal-sub">{ANNOUNCEMENT_RULE}</p>

        {state?.message && (
          <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
            {state.message}
          </div>
        )}

        <input type="hidden" name="listingId" value={listingId} />

        <div className="form-group">
          <label className="form-label" htmlFor="announcement-body">Announcement</label>
          <textarea
            id="announcement-body"
            name="body"
            className="form-textarea"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="v2.4 is out — fixes the dungeon pathfinding crash."
            required
          />
          <div className={`char-count ${over ? 'char-count-over' : ''}`}>
            {body.length} / {MAX_ANNOUNCEMENT_LENGTH}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || over}>
            {pending ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
