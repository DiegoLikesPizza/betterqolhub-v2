'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FILE_KINDS, formatBytes, type ModpackFileKind } from '@/lib/modpack';

type Existing = { filename: string; bytes: number } | undefined;

type Result = { imported: number | null; warning?: string; filename: string; bytes: number };

/**
 * One upload slot — the .mrpack or the ZIP of a single pack.
 *
 * Uses XMLHttpRequest rather than fetch, which is a deliberate step backwards:
 * fetch cannot report upload progress, and a 91 MB file posted with no feedback
 * is indistinguishable from a hung page. XHR still exposes `upload.onprogress`.
 */
export default function ModpackFileUpload({
  modpackId,
  kind,
  existing,
}: {
  modpackId: string;
  kind: ModpackFileKind;
  existing: Existing;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const copy = FILE_KINDS[kind];
  const busy = progress !== null;

  function upload(file: File) {
    setError(null);
    setResult(null);
    setProgress(0);

    const request = new XMLHttpRequest();
    request.open(
      'POST',
      `/api/admin/modpack-upload?modpackId=${encodeURIComponent(modpackId)}&kind=${kind}`
    );

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';

      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(request.responseText) as Record<string, unknown>;
      } catch {
        // Falls through to the status check below.
      }

      if (request.status >= 200 && request.status < 300) {
        setResult(payload as unknown as Result);
        // The card above shows the filename and size from the server.
        router.refresh();
      } else {
        setError(
          typeof payload.error === 'string'
            ? payload.error
            : `Upload failed (${request.status}).`
        );
      }
    };

    request.onerror = () => {
      setProgress(null);
      // The most common cause by far is nginx's client_max_body_size, which
      // rejects the body before Next can answer with anything readable.
      setError('The upload was cut off. If the file is large, the server may be refusing its size.');
    };

    request.send(file);
  }

  return (
    <div className="upload-slot">
      <div className="upload-head">
        <span className="upload-label pixel">{copy.label}</span>
        {existing ? (
          <span className="upload-current">
            {existing.filename} · {formatBytes(existing.bytes)}
          </span>
        ) : (
          <span className="upload-missing">Not uploaded</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={copy.extension}
        className="form-input upload-input"
        disabled={busy}
        aria-label={`Upload ${copy.label}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      {busy && (
        <div className="upload-progress" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          <span className="upload-progress-text">{progress}%</span>
        </div>
      )}

      {error && <div className="form-alert form-alert-error">{error}</div>}

      {result && (
        <div className="form-alert form-alert-success">
          Uploaded {formatBytes(result.bytes)}
          {result.imported !== null && ` — imported ${result.imported} mods from the manifest`}
          {result.warning && ` — but: ${result.warning}`}
        </div>
      )}
    </div>
  );
}
