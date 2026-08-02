// Edits a team proposes to its own listing.
//
// Teams never write to `Listing` directly. The site's entire claim is that
// somebody independent checked these entries, and that claim does not survive a
// developer rewriting their own description after being marked trusted. So a
// proposal is a row an admin reads, compares and applies.
//
// Note which fields are absent: category, trust status and the unlisting state.
// Those are the *verdict* — what we say about a client — as opposed to the
// description of it, which is the developer's to keep current.

import { pricingLabel, type PricingKey } from '@/lib/pricing';

/** The fields a team may propose changes to, in the order the diff shows them. */
export const CHANGE_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'developer', label: 'Developer' },
  { key: 'description', label: 'Description' },
  { key: 'url', label: 'Primary link' },
  { key: 'urlLabel', label: 'Primary button text' },
  { key: 'secondaryUrl', label: 'Secondary link' },
  { key: 'secondaryUrlLabel', label: 'Secondary button text' },
  { key: 'features', label: 'Feature list' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'price', label: 'Price' },
] as const;

export type ChangeField = (typeof CHANGE_FIELDS)[number]['key'];

export type ChangeSnapshot = {
  name: string;
  developer: string | null;
  description: string;
  url: string;
  secondaryUrl: string | null;
  urlLabel: string | null;
  secondaryUrlLabel: string | null;
  /// Markdown. Compared and shown as plain text in the review table — an admin
  /// deciding on a change needs to see what was written, not what it renders to.
  features: string | null;
  /// A Pricing key, matching the enum the listing column uses.
  pricing: PricingKey | null;
  price: string | null;
};

export const MAX_CHANGE_NOTE_LENGTH = 500;
export const MAX_DECISION_NOTE_LENGTH = 500;

/** How a value reads in the review table. */
export function displayValue(field: ChangeField, value: string | null): string {
  if (value === null || value === '') return '—';
  if (field === 'pricing') return pricingLabel(value) ?? value;
  return value;
}

export type FieldDiff = {
  key: ChangeField;
  label: string;
  before: string | null;
  after: string | null;
  changed: boolean;
};

/**
 * Compares a proposal against the listing as it stands *now*, not as it stood
 * when the proposal was written.
 *
 * That is the point. A proposal is stored as a full snapshot, so approving it
 * writes every field — including ones an admin edited in the meantime. Diffing
 * against the current row is what puts those collisions in front of the person
 * deciding, rather than letting an approval quietly undo their own edit.
 */
export function diffChange(current: ChangeSnapshot, proposed: ChangeSnapshot): FieldDiff[] {
  return CHANGE_FIELDS.map(({ key, label }) => {
    const before = current[key];
    const after = proposed[key];
    return {
      key,
      label,
      before,
      after,
      // Empty string and null both mean "not set", so a proposal that only
      // swapped one for the other is not shown as a change.
      changed: (before ?? '') !== (after ?? ''),
    };
  });
}

export function changedCount(diffs: FieldDiff[]): number {
  return diffs.filter((d) => d.changed).length;
}
