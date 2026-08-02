'use client';

import { useId } from 'react';
import { MAX_NAME_LENGTH, MAX_SUMMARY_LENGTH, MAX_SLUG_LENGTH } from '@/lib/modpack';

export type PackDefaults = {
  slug?: string;
  name?: string;
  summary?: string;
  minecraft?: string;
  loader?: string;
  version?: string;
};

/** Shared by the create and edit dialogs so the two cannot drift apart. */
export default function ModpackFields({ defaults = {} }: { defaults?: PackDefaults }) {
  // Both dialogs can be in the DOM at once — one per pack card — so the ids
  // have to be unique per instance or the labels point at the wrong inputs.
  const id = useId();
  const editing = Boolean(defaults.slug);

  return (
    <>
      <div className="form-group">
        <label className="form-label" htmlFor={`${id}-name`}>Name</label>
        <input
          id={`${id}-name`}
          name="name"
          type="text"
          className="form-input"
          maxLength={MAX_NAME_LENGTH}
          defaultValue={defaults.name ?? ''}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor={`${id}-summary`}>Summary</label>
        <input
          id={`${id}-summary`}
          name="summary"
          type="text"
          className="form-input"
          maxLength={MAX_SUMMARY_LENGTH}
          placeholder="The one line under the title"
          defaultValue={defaults.summary ?? ''}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor={`${id}-slug`}>
          URL slug{' '}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
            (optional)
          </span>
        </label>
        <input
          id={`${id}-slug`}
          name="slug"
          type="text"
          className="form-input"
          maxLength={MAX_SLUG_LENGTH}
          placeholder="Leave blank to build it from the name"
          defaultValue={defaults.slug ?? ''}
        />
        <p className="form-hint">
          {editing
            ? 'Changing this changes the pack’s public URL — links people already have will stop working.'
            : 'Becomes /modpacks/<slug>, and part of the download filename.'}
        </p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-version`}>Pack version</label>
          <input
            id={`${id}-version`}
            name="version"
            type="text"
            className="form-input"
            placeholder="26.1.2"
            defaultValue={defaults.version ?? ''}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-minecraft`}>Minecraft</label>
          <input
            id={`${id}-minecraft`}
            name="minecraft"
            type="text"
            className="form-input"
            placeholder="26.1.2"
            defaultValue={defaults.minecraft ?? ''}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-loader`}>Loader</label>
          <input
            id={`${id}-loader`}
            name="loader"
            type="text"
            className="form-input"
            placeholder="Fabric 0.19.3"
            defaultValue={defaults.loader ?? ''}
            required
          />
        </div>
      </div>

      <p className="form-hint">
        The pack version becomes part of the download filename, so a file is named from
        whatever the version is at the moment it is uploaded.
      </p>
    </>
  );
}
