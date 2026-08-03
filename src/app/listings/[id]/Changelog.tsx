'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  publishChangelog,
  deleteChangelogEntry,
  type ChangelogFormState,
} from './actions';
import WebhookDialog from './WebhookDialog';
import {
  CHANGELOG_PAGE_SIZE,
  CHANGELOG_RULE,
  MAX_CHANGELOG_LENGTH,
  MAX_VERSION_LENGTH,
} from '@/lib/changelog';
import { renderMarkdown } from '@/lib/markdown';

export type ChangelogEntry = {
  id: string;
  version: string;
  body: string;
  author: string;
  releasedAt: string;
};

/**
 * The version history, under its own heading.
 *
 * Deliberately below the announcements and above the reviews: it is the
 * developer's word like an announcement is, but it is reference material rather
 * than news, and it must not sit between the reader and the community's verdict
 * for longer than a few entries — hence the page size.
 */
export default function Changelog({
  listingId,
  listingName,
  entries,
  canPost,
  isLead,
  webhookMask,
}: {
  listingId: string;
  listingName: string;
  entries: ChangelogEntry[];
  canPost: boolean;
  isLead: boolean;
  webhookMask: string | null;
}) {
  const composerRef = useRef<HTMLDialogElement>(null);
  const webhookRef = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Cleared when the dialog opens rather than after a post — an event, not an
  // effect. Remounting the composer to reset it would destroy the <dialog>
  // element showModal() was just called on.
  const [draft, setDraft] = useState({ version: '', body: '' });

  function openComposer() {
    setDraft({ version: '', body: '' });
    composerRef.current?.showModal();
  }

  // Nothing to show and nothing to add: the section would be a heading over an
  // empty box on most of the catalogue.
  if (entries.length === 0 && !canPost) return null;

  const shown = expanded ? entries : entries.slice(0, CHANGELOG_PAGE_SIZE);
  const hidden = entries.length - shown.length;

  return (
    <section className="changelog-block">
      <div className="announce-head">
        <h2 className="section-title announce-title">Changelog</h2>
        {canPost && (
          <div className="row-actions">
            {isLead && (
              <button
                type="button"
                className="table-btn"
                onClick={() => webhookRef.current?.showModal()}
              >
                {webhookMask ? 'Discord webhook ✓' : 'Discord webhook'}
              </button>
            )}
            <button type="button" className="table-btn" onClick={openComposer}>
              Add release
            </button>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="announce-empty">
          No releases yet. Anything you publish here shows up as a dated version
          history on this page.
        </p>
      ) : (
        <>
          <div className="changelog-list">
            {shown.map((entry) => (
              <EntryCard key={entry.id} entry={entry} canDelete={canPost} />
            ))}
          </div>

          {hidden > 0 && (
            <button
              type="button"
              className="announce-more"
              onClick={() => setExpanded(true)}
            >
              Show {hidden} older release{hidden === 1 ? '' : 's'}
            </button>
          )}
          {expanded && entries.length > CHANGELOG_PAGE_SIZE && (
            <button
              type="button"
              className="announce-more"
              onClick={() => setExpanded(false)}
            >
              Show fewer
            </button>
          )}
        </>
      )}

      {canPost && (
        <Composer
          listingId={listingId}
          dialogRef={composerRef}
          draft={draft}
          onDraftChange={setDraft}
        />
      )}

      {isLead && (
        <WebhookDialog
          listingId={listingId}
          listingName={listingName}
          dialogRef={webhookRef}
          currentMask={webhookMask}
        />
      )}
    </section>
  );
}

function EntryCard({
  entry,
  canDelete,
}: {
  entry: ChangelogEntry;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The action throws when the caller is no longer on the team. The button is
  // only drawn for those who are, but membership can be revoked while a page is
  // open, and that should read as a message rather than an error boundary.
  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteChangelogEntry(entry.id);
        router.refresh();
      } catch {
        setError('Could not delete that.');
        setConfirming(false);
      }
    });
  }

  return (
    <article className="changelog-entry">
      <header className="changelog-meta">
        <span className="changelog-version">{entry.version}</span>
        <time dateTime={entry.releasedAt}>
          {new Date(entry.releasedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </header>

      {/* Markdown as React elements — see src/lib/markdown.tsx for why that
          distinction is what makes developer-authored text safe to render. */}
      <div className="markdown-body changelog-body">{renderMarkdown(entry.body)}</div>

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
              <button type="button" className="table-btn" onClick={() => setConfirming(false)}>
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
  draft,
  onDraftChange,
}: {
  listingId: string;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  draft: { version: string; body: string };
  onDraftChange: (draft: { version: string; body: string }) => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState(false);
  const [state, action, pending] = useActionState<ChangelogFormState, FormData>(
    publishChangelog,
    undefined
  );

  // A release that published but failed to reach Discord keeps the dialog open,
  // because that outcome has something for the reader to act on. A clean success
  // has nothing to say and gets out of the way.
  const stuck = Boolean(state?.ok && state.webhookWarning);

  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
    if (!state.webhookWarning) dialogRef.current?.close();
  }, [state, router, dialogRef]);

  const overBody = draft.body.length > MAX_CHANGELOG_LENGTH;
  const overVersion = draft.version.length > MAX_VERSION_LENGTH;

  return (
    <dialog ref={dialogRef} className="modal modal-wide">
      <form action={action} className="modal-body">
        <h3 className="pixel modal-title">Publish a release</h3>
        <p className="modal-sub">{CHANGELOG_RULE}</p>

        {state?.message && !stuck && (
          <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
            {state.message}
          </div>
        )}
        {stuck && <div className="form-alert form-alert-error">{state!.webhookWarning}</div>}

        <input type="hidden" name="listingId" value={listingId} />

        <div className="changelog-fields">
          <div className="form-group">
            <label className="form-label" htmlFor="changelog-version">Version</label>
            <input
              id="changelog-version"
              name="version"
              className="form-input"
              value={draft.version}
              onChange={(e) => onDraftChange({ ...draft, version: e.target.value })}
              placeholder="v2.4.1"
              maxLength={MAX_VERSION_LENGTH}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="changelog-date">Released</label>
            {/* Optional, so a backlog of old releases can be entered with the
                dates they actually shipped. Empty means today. */}
            <input
              id="changelog-date"
              name="releasedAt"
              type="date"
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="label-row">
            <label className="form-label" htmlFor="changelog-body">What changed</label>
            <button
              type="button"
              className="table-btn"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>

          {preview ? (
            <>
              {/* An unmounted textarea submits nothing, so previewing and then
                  hitting Publish would be refused for an empty body while the
                  writer is looking at their text. Only one of the two is ever
                  mounted, so `body` is never sent twice. */}
              <input type="hidden" name="body" value={draft.body} />
              <div className="markdown-body features-preview">
                {renderMarkdown(draft.body) ?? (
                  <p className="announce-empty">Nothing to preview yet.</p>
                )}
              </div>
            </>
          ) : (
            <textarea
              id="changelog-body"
              name="body"
              className="form-textarea features-input"
              value={draft.body}
              onChange={(e) => onDraftChange({ ...draft, body: e.target.value })}
              placeholder={'- Fixes the dungeon pathfinding crash\n- Adds a /party warp keybind\n- **Removed** the old waypoint format'}
              required
            />
          )}

          <div className={`char-count ${overBody ? 'char-count-over' : ''}`}>
            {draft.body.length} / {MAX_CHANGELOG_LENGTH}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dialogRef.current?.close()}
          >
            {stuck ? 'Close' : 'Cancel'}
          </button>
          {!stuck && (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending || overBody || overVersion}
            >
              {pending ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
