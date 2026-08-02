'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitChangeRequest,
  type ChangeRequestState,
} from '@/app/admin/change-request-actions';
import { MAX_CHANGE_NOTE_LENGTH, displayValue } from '@/lib/change-requests';
import { PRICING, MAX_PRICE_LENGTH, categoryHasPricing, pricingHasPrice } from '@/lib/pricing';
import type { FieldDiff } from '@/lib/change-requests';

export type ProposeDefaults = {
  name: string;
  developer: string | null;
  description: string;
  url: string;
  secondaryUrl: string | null;
  pricing: string | null;
  price: string | null;
};

export type PendingProposal = {
  authorUsername: string;
  createdAt: string;
  note: string | null;
  diffs: FieldDiff[];
};

/**
 * Lets a listing's team propose an edit to it.
 *
 * Deliberately not the admin's listing form: category and trust status are
 * missing, and their absence is the feature. Those are the verdict this site
 * publishes about a client, and a developer editing their own verdict is exactly
 * what the review step exists to prevent.
 */
export default function ProposeChanges({
  listingId,
  category,
  defaults,
  pending: pendingProposal,
  lastDecision,
}: {
  listingId: string;
  category: string;
  defaults: ProposeDefaults;
  pending: PendingProposal | null;
  lastDecision: { status: string; decisionNote: string | null; reviewedAt: string | null } | null;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, submitting] = useActionState<ChangeRequestState, FormData>(
    submitChangeRequest,
    undefined
  );

  const [pricing, setPricing] = useState(defaults.pricing ?? '');
  const showPricing = categoryHasPricing(category);
  const showPrice = showPricing && pricingHasPrice(pricing || null);

  useEffect(() => {
    if (state?.ok) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router]);

  const changed = pendingProposal?.diffs.filter((d) => d.changed) ?? [];

  return (
    <div className="propose-box">
      <div className="propose-head">
        <div>
          <h3 className="pixel propose-title">Your listing</h3>
          <p className="propose-sub">
            You are on this listing&rsquo;s team. Edits go to an admin for review before
            they appear — the category and the trusted badge stay ours to set.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => dialogRef.current?.showModal()}
        >
          {pendingProposal ? 'Edit proposal' : 'Propose changes'}
        </button>
      </div>

      {pendingProposal && (
        <div className="propose-pending">
          <strong>Waiting for review</strong> — {changed.length}{' '}
          {changed.length === 1 ? 'field' : 'fields'}, sent by {pendingProposal.authorUsername} on{' '}
          {new Date(pendingProposal.createdAt).toLocaleDateString()}.
          <ul className="propose-diff">
            {changed.map((diff) => (
              <li key={diff.key}>
                <span className="propose-field">{diff.label}:</span>{' '}
                <span className="cr-before">{displayValue(diff.key, diff.before)}</span> →{' '}
                <span className="cr-after">{displayValue(diff.key, diff.after)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Only shown when nothing is pending — once a new proposal is in flight,
          the previous rejection is no longer the thing to act on. */}
      {!pendingProposal && lastDecision?.status === 'REJECTED' && (
        <div className="propose-rejected">
          <strong>Your last proposal was rejected</strong>
          {lastDecision.reviewedAt &&
            ` on ${new Date(lastDecision.reviewedAt).toLocaleDateString()}`}
          .
          {lastDecision.decisionNote && <p>“{lastDecision.decisionNote}”</p>}
        </div>
      )}

      <dialog ref={dialogRef} className="modal modal-wide">
        <form action={action} className="modal-body">
          <h3 className="pixel modal-title">Propose changes</h3>
          <p className="modal-sub">
            Nothing changes on the site until an admin approves this. Sending a new
            proposal replaces the one waiting, if any.
          </p>

          {state?.message && (
            <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
              {state.message}
            </div>
          )}

          <input type="hidden" name="listingId" value={listingId} />

          <div className="form-group">
            <label className="form-label" htmlFor="pc-name">Name</label>
            <input
              id="pc-name"
              name="name"
              type="text"
              className="form-input"
              defaultValue={defaults.name}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pc-developer">
              Developer{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="pc-developer"
              name="developer"
              type="text"
              className="form-input"
              defaultValue={defaults.developer ?? ''}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pc-description">Description</label>
            <textarea
              id="pc-description"
              name="description"
              className="form-textarea"
              defaultValue={defaults.description}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pc-url">Primary link</label>
            <input
              id="pc-url"
              name="url"
              type="url"
              className="form-input"
              defaultValue={defaults.url}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pc-secondary">
              Secondary link{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="pc-secondary"
              name="secondaryUrl"
              type="url"
              className="form-input"
              defaultValue={defaults.secondaryUrl ?? ''}
            />
          </div>

          {showPricing && (
            <div className="form-group">
              <label className="form-label" htmlFor="pc-pricing">Pricing</label>
              <select
                id="pc-pricing"
                name="pricing"
                className="form-input"
                value={pricing}
                onChange={(e) => setPricing(e.target.value)}
              >
                <option value="">Not specified</option>
                {PRICING.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {showPrice && (
            <div className="form-group">
              <label className="form-label" htmlFor="pc-price">Price</label>
              <input
                id="pc-price"
                name="price"
                type="text"
                className="form-input"
                maxLength={MAX_PRICE_LENGTH}
                defaultValue={defaults.price ?? ''}
                placeholder="e.g. 5€ / month"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="pc-note">
              What changed and why{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="pc-note"
              name="note"
              className="form-textarea"
              maxLength={MAX_CHANGE_NOTE_LENGTH}
              defaultValue={pendingProposal?.note ?? ''}
              placeholder="Helps whoever reviews this decide quickly"
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send for review'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
