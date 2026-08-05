// Where uploaded pack files land on disk.
//
// Deliberately outside Next entirely: nginx serves /downloads/ straight from
// this directory, so a 91 MB ZIP never passes through the Node process on the
// way out. The upload route is the only thing that writes here.

import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { FILE_KINDS, type ModpackFileKind } from '@/lib/modpack';

/**
 * Thrown when an upload runs past the byte limit mid-stream.
 *
 * Its own type so the route can answer 413 rather than the 500 every other
 * write failure earns — "your file is too big" is a different conversation from
 * "the disk is broken".
 */
export class UploadTooLargeError extends Error {
  limit: number;

  constructor(limit: number) {
    super(`Upload exceeded the ${limit} byte limit.`);
    this.name = 'UploadTooLargeError';
    this.limit = limit;
  }
}

/**
 * Absolute path nginx's `location /downloads/` aliases.
 *
 * Overridable so a dev machine does not need the production layout — locally it
 * falls back to a gitignored folder in the project.
 */
export const DOWNLOAD_DIR =
  process.env.MODPACK_DOWNLOAD_DIR ?? path.join(process.cwd(), '.downloads');

/** Public URL nginx serves a stored file at. */
export function downloadHref(filename: string): string {
  return `/downloads/${filename}`;
}

/**
 * The name a pack's file is stored under.
 *
 * Built entirely from values the server controls — a validated slug, a known
 * kind, and a version reduced to the same safe alphabet. Nothing the browser
 * sent reaches the filesystem, so an upload cannot escape the directory or
 * land on top of an unrelated file.
 */
export function storedFilename(slug: string, kind: ModpackFileKind, version: string): string {
  const safeVersion = version
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stem = safeVersion ? `${slug}-${safeVersion}` : slug;
  return `${stem}${FILE_KINDS[kind].extension}`;
}

/**
 * Streams a request body to disk and returns how many bytes landed.
 *
 * Writes to a temporary name and renames on success, so an interrupted upload
 * can never leave a half-file sitting at the URL the download button points at.
 * The rename is atomic within the directory.
 *
 * `maxBytes` is counted here rather than trusted from `Content-Length`, because
 * that header is a claim the client makes: a chunked request need not send one
 * at all, and one that does can lie. The header check upstream is still worth
 * keeping — it refuses an oversized upload before a byte is written — but it
 * cannot be the only limit, or the disk is one dishonest request from full.
 */
export async function storeUpload(
  filename: string,
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<number> {
  await mkdir(DOWNLOAD_DIR, { recursive: true });

  const target = path.join(DOWNLOAD_DIR, filename);
  const temporary = `${target}.part`;

  let written = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      written += chunk.length;
      if (written > maxBytes) {
        // Fails the pipeline, which destroys both ends: the source stops being
        // read and the partial file is removed below.
        done(new UploadTooLargeError(maxBytes));
        return;
      }
      done(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]),
      limit,
      createWriteStream(temporary)
    );
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  const { size } = await stat(target);
  return size;
}

/**
 * Removes a stored file. Never throws: the database row is the source of truth,
 * and failing to delete a leftover file is not a reason to fail the action that
 * replaced it.
 */
export async function removeStored(filename: string): Promise<void> {
  if (!filename) return;
  try {
    await rm(path.join(DOWNLOAD_DIR, filename), { force: true });
  } catch (error) {
    console.error('[modpacks] could not delete stored file', filename, error);
  }
}
