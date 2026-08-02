'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveMods, type ModpackState } from './modpack-actions';
import { MOD_GROUPS, DEFAULT_GROUP, modrinthUrl } from '@/lib/modpack';

export type EditableMod = {
  id: string;
  name: string;
  version: string;
  modrinth: string | null;
  bundledOnly: boolean;
  group: string;
};

function groupsOf(mods: EditableMod[]): Record<string, string> {
  return Object.fromEntries(mods.map((m) => [m.id, m.group]));
}

/**
 * The mod list of one pack.
 *
 * Everything here arrived from the uploaded .mrpack, so this is a correction
 * surface rather than a data-entry form — the one field that is genuinely a
 * decision is `group`, which no manifest can tell you.
 */
export default function ModsEditor({
  modpackId,
  mods,
}: {
  modpackId: string;
  mods: EditableMod[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ModpackState, FormData>(saveMods, undefined);
  // Mirrors the selects so the "unsorted" count reacts as you sort, rather than
  // only after a save.
  const [groups, setGroups] = useState<Record<string, string>>(() => groupsOf(mods));

  // Reset when the server sends a new list — after a save, or after an upload
  // re-imported the manifest. Done during render rather than in an effect: this
  // is React's documented way to adjust state when a prop changes, and it avoids
  // the extra render pass (and the cascading-render lint error) an effect costs.
  const [seen, setSeen] = useState(mods);
  if (seen !== mods) {
    setSeen(mods);
    setGroups(groupsOf(mods));
  }

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const unsorted = useMemo(
    () => Object.values(groups).filter((g) => g === DEFAULT_GROUP).length,
    [groups]
  );

  if (mods.length === 0) {
    return (
      <p className="table-muted">
        No mods yet — upload a .mrpack and its manifest will fill this in.
      </p>
    );
  }

  return (
    <form action={action} className="mods-editor">
      <input type="hidden" name="modpackId" value={modpackId} />

      <div className="mods-editor-head">
        <span className="table-muted">
          {mods.length} mods
          {unsorted > 0 && ` · ${unsorted} still unsorted`}
        </span>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save mods'}
        </button>
      </div>

      {state?.message && (
        <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
          {state.message}
        </div>
      )}

      <div className="table-scroll">
        <table className="admin-table mods-table">
          <thead>
            <tr>
              <th>Mod</th>
              <th>Version</th>
              <th>Group</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {mods.map((mod) => (
              <tr key={mod.id}>
                <td>
                  <input type="hidden" name="modId" value={mod.id} />
                  <input
                    type="text"
                    name={`name:${mod.id}`}
                    defaultValue={mod.name}
                    className="form-input mods-input"
                    aria-label={`Name of ${mod.name}`}
                    maxLength={60}
                    required
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name={`version:${mod.id}`}
                    defaultValue={mod.version}
                    className="form-input mods-input mods-input-short"
                    aria-label={`Version of ${mod.name}`}
                    maxLength={60}
                  />
                </td>
                <td>
                  <select
                    name={`group:${mod.id}`}
                    value={groups[mod.id] ?? DEFAULT_GROUP}
                    onChange={(e) =>
                      setGroups((g) => ({ ...g, [mod.id]: e.target.value }))
                    }
                    className="form-input mods-select"
                    aria-label={`Group of ${mod.name}`}
                  >
                    {MOD_GROUPS.map((group) => (
                      <option key={group.key} value={group.key}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="table-muted">
                  {mod.modrinth ? (
                    <a
                      href={modrinthUrl(mod.modrinth)}
                      target="_blank"
                      rel="noreferrer"
                      className="table-link"
                    >
                      Modrinth
                    </a>
                  ) : (
                    <span title="Shipped as a file in the pack's overrides">bundled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
