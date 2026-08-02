'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createModpack,
  updateModpack,
  deleteModpack,
  setModpackPublished,
  type ModpackState,
} from './modpack-actions';
import ModpackFields from './ModpackFields';
import ModpackFileUpload from './ModpackFileUpload';
import ModsEditor from './ModsEditor';
import { MODPACK_FILE_KINDS, formatBytes, type ModpackFileKind } from '@/lib/modpack';
import type { AdminPack } from '@/lib/modpacks';

export default function ModpacksPanel({ packs }: { packs: AdminPack[] }) {
  return (
    <div className="modpacks-panel">
      {packs.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          No packs yet. Create one, then upload its .mrpack — the mod list comes out of
          the manifest by itself.
        </p>
      ) : (
        packs.map((pack) => <PackCard key={pack.id} pack={pack} />)
      )}
    </div>
  );
}

export function AddModpackDialog() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ModpackState, FormData>(
    createModpack,
    undefined
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => dialogRef.current?.showModal()}
      >
        + New pack
      </button>

      <dialog ref={dialogRef} className="modal modal-wide">
        <form ref={formRef} action={action} className="modal-body">
          <h3 className="pixel modal-title">New modpack</h3>
          <p className="modal-sub">
            Created unpublished. Upload its files, sort the mods, then publish.
          </p>

          {state?.message && !state.ok && (
            <div className="form-alert form-alert-error">{state.message}</div>
          )}

          <ModpackFields />

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Creating…' : 'Create pack'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function PackCard({ pack }: { pack: AdminPack }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const editRef = useRef<HTMLDialogElement>(null);

  const fileFor = (kind: ModpackFileKind) => pack.files.find((f) => f.kind === kind);

  function run(fn: () => Promise<ModpackState | void>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result && result.ok === false) setError(result.message ?? 'Action failed.');
      } catch {
        setError('Action failed.');
      }
    });
  }

  return (
    <section className="pack-admin-card">
      <header className="pack-admin-head">
        <div>
          <h3 className="pixel pack-admin-title">
            {pack.name}
            <span className={`pack-state ${pack.isPublished ? 'pack-live' : 'pack-draft'}`}>
              {pack.isPublished ? 'Live' : 'Draft'}
            </span>
          </h3>
          <p className="table-muted">
            v{pack.version} · MC {pack.minecraft} · {pack.loader} · {pack.mods.length} mods
          </p>
          <p className="table-muted">
            {pack.isPublished ? (
              <Link href={`/modpacks/${pack.slug}`} className="table-link">
                /modpacks/{pack.slug}
              </Link>
            ) : (
              <span>/modpacks/{pack.slug}</span>
            )}
          </p>
        </div>

        <div className="pack-admin-actions">
          <button
            type="button"
            className="table-btn"
            onClick={() => editRef.current?.showModal()}
          >
            Edit
          </button>
          <button
            type="button"
            className="table-btn"
            disabled={pending}
            onClick={() => run(() => setModpackPublished(pack.id, !pack.isPublished))}
          >
            {pack.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                className="table-btn table-btn-danger"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await deleteModpack(pack.id);
                    router.refresh();
                  })
                }
              >
                {pending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button type="button" className="table-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="table-btn table-btn-danger"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          )}
        </div>
      </header>

      {error && <div className="form-alert form-alert-error">{error}</div>}

      <p className="pack-admin-summary">{pack.summary}</p>

      <div className="upload-grid">
        {MODPACK_FILE_KINDS.map((kind) => (
          <ModpackFileUpload
            key={kind}
            modpackId={pack.id}
            kind={kind}
            existing={fileFor(kind)}
          />
        ))}
      </div>

      <details className="pack-mods">
        <summary className="pack-mods-summary">
          Mods ({pack.mods.length})
          {pack.files.some((f) => f.kind === 'MRPACK') || pack.mods.length > 0 ? '' : ' — upload a .mrpack to fill this in'}
        </summary>
        <ModsEditor modpackId={pack.id} mods={pack.mods} />
      </details>

      <EditPackDialog dialogRef={editRef} pack={pack} />
    </section>
  );
}

function EditPackDialog({
  dialogRef,
  pack,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  pack: AdminPack;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ModpackState, FormData>(
    updateModpack,
    undefined
  );

  useEffect(() => {
    if (state?.ok) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router, dialogRef]);

  return (
    <dialog ref={dialogRef} className="modal modal-wide">
      <form action={action} className="modal-body">
        <h3 className="pixel modal-title">Edit pack</h3>

        {state?.message && !state.ok && (
          <div className="form-alert form-alert-error">{state.message}</div>
        )}

        <input type="hidden" name="modpackId" value={pack.id} />
        <ModpackFields defaults={pack} />

        <p className="form-hint">
          Files on disk:{' '}
          {pack.files.length === 0
            ? 'none yet'
            : pack.files.map((f) => `${f.filename} (${formatBytes(f.bytes)})`).join(', ')}
        </p>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
