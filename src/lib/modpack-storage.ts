// Where uploaded pack files land on disk.
//
// Deliberately outside Next entirely: nginx serves /downloads/ straight from
// this directory, so a 91 MB ZIP never passes through the Node process on the
// way out. The upload route is the only thing that writes here.

import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { FILE_KINDS, type ModpackFileKind } from '@/lib/modpack';

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
 */
export async function storeUpload(
  filename: string,
  body: ReadableStream<Uint8Array>
): Promise<number> {
  await mkdir(DOWNLOAD_DIR, { recursive: true });

  const target = path.join(DOWNLOAD_DIR, filename);
  const temporary = `${target}.part`;

  try {
    await pipeline(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(temporary));
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
