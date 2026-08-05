import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/authz';
import { isFileKind, BUNDLED_GROUP, DEFAULT_GROUP, type ModpackFileKind } from '@/lib/modpack';
import {
  DOWNLOAD_DIR,
  removeStored,
  storedFilename,
  storeUpload,
  UploadTooLargeError,
} from '@/lib/modpack-storage';
import { parseMrpack, enrichFromModrinth, MrpackError, type ParsedMod } from '@/lib/mrpack';

// Uploading a pack file.
//
// A Route Handler rather than a Server Action, and not by preference: Server
// Actions cap the request body at 1 MB, and raising that limit would apply to
// every action in the app. This route streams the body straight to disk instead,
// so the 91 MB ZIP never has to be held in memory.
//
// nginx also caps request bodies — `client_max_body_size` on this location has
// to be at least as large as the biggest pack, or the upload is rejected before
// Next ever sees it.

/**
 * The upload ceiling, enforced twice: once from `Content-Length` so obvious
 * nonsense is refused before anything is written, and again while the body is
 * streamed, because that header is only a claim the client makes.
 */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/**
 * Re-imports a pack's mod list from its manifest, keeping the curation.
 *
 * Groups, and any name an admin corrected by hand, are matched forward onto the
 * new list — by Modrinth project id where there is one, by name otherwise. That
 * is the whole reason uploading a new version is not a chore: the sorting
 * survives the update, and only genuinely new mods land unsorted.
 */
async function replaceMods(modpackId: string, parsed: ParsedMod[]): Promise<number> {
  const previous = await prisma.modpackMod.findMany({
    where: { modpackId },
    select: { name: true, modrinth: true, group: true },
  });

  const byProject = new Map(
    previous.filter((m) => m.modrinth).map((m) => [m.modrinth!, m])
  );
  const byName = new Map(previous.map((m) => [m.name.toLowerCase(), m]));

  const rows = parsed.map((mod, index) => {
    const carried =
      (mod.modrinth ? byProject.get(mod.modrinth) : undefined) ??
      byName.get(mod.name.toLowerCase());

    return {
      modpackId,
      // A hand-corrected name wins over the imported one: an admin who renamed
      // "Fake Fabric Loader" did not do it so the next upload could undo it.
      name: carried?.name ?? mod.name,
      version: mod.version,
      modrinth: mod.modrinth,
      bundledOnly: mod.bundledOnly,
      group: carried?.group ?? (mod.bundledOnly ? BUNDLED_GROUP : DEFAULT_GROUP),
      sortOrder: index,
    };
  });

  // Replace wholesale rather than diff: the manifest is the truth about what is
  // in the pack, so a mod that is gone from it must not linger on the page.
  await prisma.$transaction([
    prisma.modpackMod.deleteMany({ where: { modpackId } }),
    prisma.modpackMod.createMany({ data: rows }),
  ]);

  return rows.length;
}

export async function POST(request: Request): Promise<Response> {
  // Route Handlers are plain POST endpoints — the admin check has to happen
  // here, it is not inherited from the page that renders the upload button.
  if (!(await isAdmin())) return fail(403, 'Admin access required.');

  const url = new URL(request.url);
  const modpackId = url.searchParams.get('modpackId') ?? '';
  const rawKind = (url.searchParams.get('kind') ?? '').toUpperCase();

  if (!isFileKind(rawKind)) return fail(400, 'Unknown file kind.');
  const kind: ModpackFileKind = rawKind;

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES) {
    return fail(413, `That file is larger than the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.`);
  }
  if (!request.body) return fail(400, 'No file in the request.');

  const pack = await prisma.modpack.findUnique({
    where: { id: modpackId },
    select: { id: true, slug: true, version: true, files: { where: { kind } } },
  });
  if (!pack) return fail(404, 'That pack no longer exists.');

  const filename = storedFilename(pack.slug, kind, pack.version);
  const previous = pack.files[0];

  let bytes: number;
  try {
    bytes = await storeUpload(filename, request.body, MAX_UPLOAD_BYTES);
  } catch (error) {
    // A body that ran past the limit is the client's answer to give, and the
    // partial file is already gone — see storeUpload.
    if (error instanceof UploadTooLargeError) {
      return fail(413, `That file is larger than the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.`);
    }
    console.error('[modpacks] upload failed', error);
    return fail(500, 'Writing the file failed. Check the server has disk space.');
  }

  let imported: number | null = null;
  let manifest: { minecraft: string | null; loader: string | null; version: string | null } | null =
    null;

  if (kind === 'MRPACK') {
    try {
      const buffer = await readFile(path.join(DOWNLOAD_DIR, filename));
      const parsed = parseMrpack(buffer);
      manifest = {
        minecraft: parsed.minecraft,
        loader: parsed.loader,
        version: parsed.version,
      };
      imported = await replaceMods(pack.id, await enrichFromModrinth(parsed.mods));
    } catch (error) {
      // The file is on disk and valid as a download even if the manifest could
      // not be read, so this is reported rather than treated as a failed upload.
      const message =
        error instanceof MrpackError ? error.message : 'Could not read the pack manifest.';
      if (!(error instanceof MrpackError)) console.error('[modpacks] manifest parse failed', error);

      await recordFile(pack.id, kind, filename, bytes, previous?.filename);
      revalidatePath('/admin/modpacks');
      revalidatePath(`/modpacks/${pack.slug}`);
      return Response.json({ filename, bytes, imported: null, warning: message });
    }
  }

  await recordFile(pack.id, kind, filename, bytes, previous?.filename);

  revalidatePath('/admin/modpacks');
  revalidatePath('/modpacks');
  revalidatePath(`/modpacks/${pack.slug}`);

  return Response.json({ filename, bytes, imported, manifest });
}

/** Points the pack at the new file and drops the one it replaced. */
async function recordFile(
  modpackId: string,
  kind: ModpackFileKind,
  filename: string,
  bytes: number,
  previousFilename: string | undefined
): Promise<void> {
  await prisma.modpackFile.upsert({
    where: { modpackId_kind: { modpackId, kind } },
    create: { modpackId, kind, filename, bytes },
    update: { filename, bytes, uploadedAt: new Date() },
  });

  // Only when the name actually changed — a same-version re-upload overwrites in
  // place, and deleting there would delete the file just written.
  if (previousFilename && previousFilename !== filename) {
    await removeStored(previousFilename);
  }
}
