'use client';

import { useState } from 'react';
import { CATEGORIES, MAX_LINK_LABEL_LENGTH } from '@/lib/categories';
import FeaturesField from '@/app/FeaturesField';
import {
  PRICING,
  MAX_PRICE_LENGTH,
  categoryHasPricing,
  pricingHasPrice,
} from '@/lib/pricing';

export type ListingDefaults = {
  name?: string;
  category?: string;
  description?: string;
  url?: string;
  developer?: string | null;
  secondaryUrl?: string | null;
  urlLabel?: string | null;
  secondaryUrlLabel?: string | null;
  features?: string | null;
  isTrusted?: boolean;
  pricing?: string | null;
  price?: string | null;
};

/**
 * The listing form fields, shared by the add form and the edit dialog so the
 * two cannot drift apart — a field added to one is added to both.
 *
 * Uncontrolled with defaults, apart from the two fields that gate others: both
 * parents submit via a server action reading FormData, so there is nothing else
 * to hold in React state.
 */
export default function ListingFields({ defaults = {} }: { defaults?: ListingDefaults }) {
  const idPrefix = defaults.name ? 'edit' : 'add';

  // Category and pricing are controlled so the fields they gate can appear and
  // disappear with them. The server coerces both away regardless, so this is
  // convenience rather than the actual rule.
  const [category, setCategory] = useState(defaults.category ?? '');
  const [pricing, setPricing] = useState(defaults.pricing ?? '');

  const showPricing = category !== '' && categoryHasPricing(category);
  // A price only means something once the listing is known to cost money, so the
  // field stays hidden for Free and for "not specified".
  const showPrice = showPricing && pricingHasPrice(pricing || null);

  return (
    <>
      <div className="form-group">
        <label className="form-label" htmlFor={`${idPrefix}-category`}>Category</label>
        <select
          id={`${idPrefix}-category`}
          name="category"
          className="form-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="" disabled>Select a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {showPricing && (
        <div className="form-group">
          <label className="form-label" htmlFor={`${idPrefix}-pricing`}>
            Pricing{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
          </label>
          <select
            id={`${idPrefix}-pricing`}
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
          <label className="form-label" htmlFor={`${idPrefix}-price`}>
            Price{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
              (optional — {pricing === 'FREEMIUM' ? 'what the paid tier costs' : 'what it costs'})
            </span>
          </label>
          <input
            id={`${idPrefix}-price`}
            name="price"
            type="text"
            className="form-input"
            maxLength={MAX_PRICE_LENGTH}
            placeholder="e.g. 5€ / month, $15 lifetime, from 3€/mo"
            defaultValue={defaults.price ?? ''}
          />
          <p className="form-hint">
            Free text, so any currency and billing period works. Shown next to the
            &ldquo;{pricing === 'FREEMIUM' ? 'Freemium' : 'Paid'}&rdquo; badge — leave it
            empty if the price varies or you are not sure.
          </p>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor={`${idPrefix}-name`}>Name</label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          className="form-input"
          defaultValue={defaults.name ?? ''}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor={`${idPrefix}-description`}>Description</label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          className="form-textarea"
          defaultValue={defaults.description ?? ''}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor={`${idPrefix}-url`}>
          Primary link (Discord invite or website)
        </label>
        <input
          id={`${idPrefix}-url`}
          name="url"
          type="url"
          className="form-input"
          placeholder="https://discord.gg/…"
          defaultValue={defaults.url ?? ''}
          required
        />
        <LinkLabelField
          id={`${idPrefix}-urlLabel`}
          name="urlLabel"
          defaultValue={defaults.urlLabel ?? ''}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor={`${idPrefix}-developer`}>
          Developer <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id={`${idPrefix}-developer`}
          name="developer"
          type="text"
          className="form-input"
          defaultValue={defaults.developer ?? ''}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor={`${idPrefix}-secondaryUrl`}>
          Secondary link{' '}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
            (optional — e.g. website or source)
          </span>
        </label>
        <input
          id={`${idPrefix}-secondaryUrl`}
          name="secondaryUrl"
          type="url"
          className="form-input"
          defaultValue={defaults.secondaryUrl ?? ''}
        />
        <LinkLabelField
          id={`${idPrefix}-secondaryUrlLabel`}
          name="secondaryUrlLabel"
          defaultValue={defaults.secondaryUrlLabel ?? ''}
        />
      </div>

      <FeaturesField
        id={`${idPrefix}-features`}
        defaultValue={defaults.features ?? ''}
      />

      <div className="form-group">
        <label className="form-checkbox">
          <input type="checkbox" name="isTrusted" defaultChecked={defaults.isTrusted ?? true} />
          <span>Mark as trusted</span>
        </label>
      </div>
    </>
  );
}

/**
 * The optional override for what a link button says.
 *
 * Sits under the URL it belongs to rather than in a fields-of-its-own section:
 * the two are one decision, and separating them is how you end up with a label
 * pointing at the wrong link.
 */
function LinkLabelField({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        className="form-input"
        style={{ marginTop: '0.5rem' }}
        maxLength={MAX_LINK_LABEL_LENGTH}
        placeholder="Button text — leave empty to detect it"
        defaultValue={defaultValue}
        aria-label="Custom button label"
      />
      <p className="form-hint">
        Empty means the label is read from the URL (&ldquo;Join Discord&rdquo; for a
        discord.gg link, otherwise &ldquo;Visit&rdquo;). Set it when the URL does not
        say where it goes — a link to your own domain that redirects to Discord, say.
      </p>
    </>
  );
}
