'use client';

import { useState } from 'react';
import { renderMarkdown, MAX_FEATURES_LENGTH } from '@/lib/markdown';

/**
 * The Markdown feature list, with a preview.
 *
 * The preview is not a nicety: this is the one field on the site whose input is
 * not what gets shown, so without it the writer finds out their list was
 * mangled only after an admin has approved it. It renders through the same
 * function the public page uses, so what it shows is what will appear.
 *
 * Shared by the admin form and the team's proposal form — the two must not
 * drift, or a team would be composing against different rules than the ones
 * their listing is rendered with.
 */
export default function FeaturesField({
  id = 'features',
  defaultValue = '',
}: {
  id?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [showPreview, setShowPreview] = useState(false);

  const over = value.length > MAX_FEATURES_LENGTH;

  return (
    <div className="form-group">
      <div className="label-row">
        <label className="form-label" htmlFor={id}>
          Feature list{' '}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
        </label>
        {value.trim() && (
          <button
            type="button"
            className="table-btn"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        )}
      </div>

      {showPreview ? (
        <>
          {/* The textarea is unmounted while previewing, and an unmounted field
              sends nothing — so without this, saving from the preview submitted
              no `features` at all and silently wiped the list the writer was
              looking at. Only one of the two is ever mounted, so the name is
              never duplicated. */}
          <input type="hidden" name="features" value={value} />
          <div className="markdown-body features-preview">{renderMarkdown(value)}</div>
        </>
      ) : (
        <textarea
          id={id}
          name="features"
          className="form-textarea features-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={'## Dungeons\n- Secret waypoints\n- **Auto** terminal solver\n\n## Mining\n- Commission tracker'}
        />
      )}

      <p className={`form-hint ${over ? 'form-hint-error' : ''}`}>
        {over
          ? `${value.length} / ${MAX_FEATURES_LENGTH} characters — too long to save.`
          : 'Markdown: ## headings, - bullets, **bold**, *italic*, `code`, [links](https://…). No images or HTML.'}
      </p>
    </div>
  );
}
