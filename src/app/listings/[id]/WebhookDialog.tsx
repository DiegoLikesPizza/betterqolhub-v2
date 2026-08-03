'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  setChangelogWebhook,
  testChangelogWebhook,
  type WebhookFormState,
} from './actions';

/**
 * Where a listing's releases get mirrored to.
 *
 * The configured URL is never sent to the browser — it is a credential, and
 * anyone holding it can post into that channel. What arrives here is a masked
 * form of it, which is enough to recognise *which* webhook is set and useless
 * to anyone reading over a shoulder. Changing it means pasting a new one; there
 * is nothing to edit in place.
 */
export default function WebhookDialog({
  listingId,
  listingName,
  dialogRef,
  currentMask,
}: {
  listingId: string;
  listingName: string;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  currentMask: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<WebhookFormState, FormData>(
    setChangelogWebhook,
    undefined
  );

  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<WebhookFormState>(undefined);

  // Left open on success rather than closed: the next thing to do is send a
  // test, and that button lives here.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  function sendTest() {
    setTestResult(undefined);
    startTest(async () => {
      setTestResult(await testChangelogWebhook(listingId));
    });
  }

  const result = state ?? undefined;

  return (
    <dialog ref={dialogRef} className="modal modal-wide">
      <div className="modal-body">
        <h3 className="pixel modal-title">Discord webhook</h3>
        <p className="modal-sub">
          Every release you publish for <strong>{listingName}</strong> is posted
          into a channel of your own server as an embed. Optional — leave it off
          and releases simply live here.
        </p>

        {result?.message && (
          <div className={`form-alert ${result.ok ? 'form-alert-success' : 'form-alert-error'}`}>
            {result.message}
          </div>
        )}
        {testResult?.message && (
          <div
            className={`form-alert ${testResult.ok ? 'form-alert-success' : 'form-alert-error'}`}
          >
            {testResult.message}
          </div>
        )}

        <p className="webhook-current">
          Currently: <code>{currentMask ?? 'not connected'}</code>
        </p>

        <form action={action}>
          <input type="hidden" name="listingId" value={listingId} />

          <div className="form-group">
            <label className="form-label" htmlFor="webhook-url">Webhook URL</label>
            <input
              id="webhook-url"
              name="webhookUrl"
              className="form-input"
              type="url"
              placeholder="https://discord.com/api/webhooks/…"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="review-rule" style={{ marginTop: '0.5rem' }}>
              In Discord: <strong>Channel settings → Integrations → Webhooks →
              New Webhook → Copy Webhook URL</strong>. Anyone who has this URL can
              post in that channel, so treat it like a password — we only ever
              show it back to you masked.
            </p>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
            {currentMask && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={testing}
                  onClick={sendTest}
                >
                  {testing ? 'Sending…' : 'Send test'}
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="remove"
                  className="btn btn-secondary"
                  disabled={pending}
                >
                  Remove
                </button>
              </>
            )}
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
